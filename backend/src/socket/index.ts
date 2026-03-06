import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import type { AIEstimateResult } from '../services/aiService';
import { setIO } from './ioInstance';

// ─── Domain types ─────────────────────────────────────────────────────────────

export interface AdoWorkItemSnapshot {
  id: number;
  title: string;
  description: string;
  state: string;
  storyPoints: number | null;
  workItemType: string;
  assignedTo: string | null;
  acceptanceCriteria: string | null;
}

interface Participant {
  userId: string;
  displayName: string;
  socketId: string;
}

interface Vote {
  userId: string;
  displayName: string;
  score: number;
}

interface RoomState {
  code: string;
  moderatorId: string;
  /** socketId → Participant */
  participants: Map<string, Participant>;
  currentWorkItem: AdoWorkItemSnapshot | null;
  scoringActive: boolean;
  /** userId → score */
  votes: Map<string, Vote>;
  revealed: boolean;
  aiEstimate: AIEstimateResult | null;
  /** userId of the participant temporarily holding moderator control, or null */
  delegatedModerator: string | null;
}

// ─── In-memory state ──────────────────────────────────────────────────────────

const rooms = new Map<string, RoomState>();

function getOrCreateRoom(code: string, moderatorId: string): RoomState {
  let state = rooms.get(code);
  if (!state) {
    state = {
      code,
      moderatorId,
      participants: new Map(),
      currentWorkItem: null,
      scoringActive: false,
      votes: new Map(),
      revealed: false,
      aiEstimate: null,
      delegatedModerator: null,
    };
    rooms.set(code, state);
  }
  return state;
}

// ─── Permission helper ────────────────────────────────────────────────────────

function isActiveModerator(room: RoomState, userId: string): boolean {
  return userId === (room.delegatedModerator ?? room.moderatorId);
}

// ─── Helper serialisers ───────────────────────────────────────────────────────

function serializeParticipants(room: RoomState) {
  return Array.from(room.participants.values()).map(({ socketId: _s, ...rest }) => rest);
}

function serializeVotes(room: RoomState, reveal: boolean) {
  return Array.from(room.votes.values()).map((v) => ({
    userId: v.userId,
    displayName: v.displayName,
    hasVoted: true,
    score: reveal ? v.score : null,
  }));
}

/** Build the full room snapshot sent on join / reconnect */
function buildRoomSnapshot(room: RoomState) {
  return {
    moderatorId: room.moderatorId,
    participants: serializeParticipants(room),
    currentWorkItem: room.currentWorkItem,
    scoringActive: room.scoringActive,
    votes: serializeVotes(room, room.revealed),
    revealed: room.revealed,
    aiEstimate: room.revealed ? room.aiEstimate : null,
    delegatedModerator: room.delegatedModerator,
  };
}

// ─── Socket initialisation ────────────────────────────────────────────────────

export function initSocket(httpServer: HttpServer): SocketIOServer {
  const frontendUrls = (process.env.FRONTEND_URL ?? 'http://localhost:3000')
    .split(',').map(s => s.trim()).filter(Boolean);
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: frontendUrls.length === 1 ? frontendUrls[0] : frontendUrls,
      credentials: true,
    },
  });

  setIO(io);

  io.on('connection', (socket: Socket) => {
    console.log(`[socket] client connected: ${socket.id}`);

    // ── room:join ─────────────────────────────────────────────────────────────
    socket.on('room:join', (data: { code: string; userId: string; displayName: string; moderatorId: string }) => {
      const { code, userId, displayName, moderatorId } = data;
      if (!code || !userId || !displayName) return;

      const room = getOrCreateRoom(code, moderatorId);

      // Evict any stale socket for this user (reconnect / tab reopen)
      for (const [sid, p] of room.participants) {
        if (p.userId === userId && sid !== socket.id) {
          room.participants.delete(sid);
          // Notify the displaced socket so the old tab shows a clear message
          io.to(sid).emit('room:replaced', {
            message: 'You joined this room from another window. This session is no longer active.',
          });
        }
      }

      room.participants.set(socket.id, { userId, displayName, socketId: socket.id });
      socket.join(code);

      // Send current room state to the joiner
      socket.emit('room:state', buildRoomSnapshot(room));

      // Broadcast updated participant list to all others
      io.to(code).emit('room:participants_changed', {
        participants: serializeParticipants(room),
      });

      console.log(`[socket] ${displayName} joined room ${code}`);
    });

    // ── room:leave ────────────────────────────────────────────────────────────
    socket.on('room:leave', (_data: { code: string }) => {
      handleLeave(socket, io);
    });

    // ── session:navigate ──────────────────────────────────────────────────────
    // Moderator opens a work item → all users are navigated to that item
    socket.on('session:navigate', (data: { code: string; workItem: AdoWorkItemSnapshot }) => {
      const { code, workItem } = data;
      const room = rooms.get(code);
      if (!room) return;

      // Only moderators may force navigation
      const participant = room.participants.get(socket.id);
      if (!participant || !isActiveModerator(room, participant.userId)) return;

      room.currentWorkItem = workItem;
      room.scoringActive   = false;
      room.votes           = new Map();
      room.revealed        = false;
      room.aiEstimate      = null;

      io.to(code).emit('session:navigate', { workItem });
    });

    // ── session:start_scoring ─────────────────────────────────────────────────
    // Moderator clicks "Start Scoring" → transitions all users to scoring mode
    socket.on('session:start_scoring', (data: { code: string }) => {
      const { code } = data;
      const room = rooms.get(code);
      if (!room) return;

      const participant = room.participants.get(socket.id);
      if (!participant || !isActiveModerator(room, participant.userId)) return;

      room.scoringActive = true;
      room.votes         = new Map();
      room.revealed      = false;

      io.to(code).emit('session:start_scoring', {
        workItem: room.currentWorkItem,
      });
    });

    // ── vote:cast ─────────────────────────────────────────────────────────────
    // User submits a score; other participants see only that they voted (no value)
    socket.on('vote:cast', (data: { code: string; score: number }) => {
      const { code, score } = data;
      const room = rooms.get(code);
      if (!room || !room.scoringActive || room.revealed) return;

      const participant = room.participants.get(socket.id);
      if (!participant) return;

      room.votes.set(participant.userId, {
        userId: participant.userId,
        displayName: participant.displayName,
        score,
      });

      // Send hidden vote list (no scores) to all participants
      io.to(code).emit('vote:update', {
        votes: serializeVotes(room, false),
      });
    });

    // ── vote:reveal ───────────────────────────────────────────────────────────
    // Moderator reveals all scores (optionally includes AI estimate)
    socket.on('vote:reveal', (data: { code: string; aiEstimate?: AIEstimateResult }) => {
      const { code } = data;
      const room = rooms.get(code);
      if (!room) return;

      const participant = room.participants.get(socket.id);
      if (!participant || !isActiveModerator(room, participant.userId)) return;

      room.revealed = true;
      if (data.aiEstimate) {
        room.aiEstimate = data.aiEstimate;
      }

      const votes = serializeVotes(room, true);
      const scores = votes.map((v) => v.score as number);
      const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
      const sorted = [...scores].sort((a, b) => a - b);

      io.to(code).emit('vote:revealed', {
        votes,
        stats: {
          average: Math.round(avg * 10) / 10,
          median: sorted[Math.floor(sorted.length / 2)] ?? 0,
          highest: sorted[sorted.length - 1] ?? 0,
          lowest: sorted[0] ?? 0,
        },
        aiEstimate: room.aiEstimate,
      });
    });

    // ── session:reset ─────────────────────────────────────────────────────────
    // Moderator resets the round (goes back to list)
    socket.on('session:reset', (data: { code: string }) => {
      const { code } = data;
      const room = rooms.get(code);
      if (!room) return;

      const participant = room.participants.get(socket.id);
      if (!participant || !isActiveModerator(room, participant.userId)) return;

      room.currentWorkItem = null;
      room.scoringActive   = false;
      room.votes           = new Map();
      room.revealed        = false;
      room.aiEstimate      = null;

      io.to(code).emit('session:reset', {});
    });

    // ── moderator:grant ───────────────────────────────────────────────────────
    // Main moderator grants temporary moderator rights to a participant
    socket.on('moderator:grant', (data: { code: string; userId: string }) => {
      const { code, userId } = data;
      const room = rooms.get(code);
      if (!room) return;

      const caller = room.participants.get(socket.id);
      // Only the main moderator can grant (not a self-moderator)
      if (!caller || caller.userId !== room.moderatorId) return;

      room.delegatedModerator = userId;
      io.to(code).emit('moderator:updated', { delegatedModerator: userId });
    });

    // ── moderator:revoke ──────────────────────────────────────────────────────
    // Main moderator revokes temporary moderator rights from a participant
    socket.on('moderator:revoke', (data: { code: string; userId: string }) => {
      const { code, userId } = data;
      const room = rooms.get(code);
      if (!room) return;

      const caller = room.participants.get(socket.id);
      // Only the main moderator can revoke
      if (!caller || caller.userId !== room.moderatorId) return;

      room.delegatedModerator = null;
      io.to(code).emit('moderator:updated', { delegatedModerator: null });
    });

    // ── disconnect ────────────────────────────────────────────────────────────
    socket.on('disconnect', () => {
      handleLeave(socket, io);
      console.log(`[socket] client disconnected: ${socket.id}`);
    });
  });

  return io;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function handleLeave(socket: Socket, io: SocketIOServer) {
  for (const [code, room] of rooms) {
    if (room.participants.has(socket.id)) {
      const leaving = room.participants.get(socket.id)!;
      room.participants.delete(socket.id);
      const wasDelegated = room.delegatedModerator === leaving.userId;
      if (wasDelegated) {
        room.delegatedModerator = null;
        io.to(code).emit('moderator:updated', { delegatedModerator: null });
      }
      socket.leave(code);
      io.to(code).emit('room:participants_changed', {
        participants: serializeParticipants(room),
      });
      // Clean up empty rooms (keep if moderator may rejoin)
      break;
    }
  }
}
