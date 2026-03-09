import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import type { AIEstimateResult } from '../services/aiService';
import { setIO } from './ioInstance';
import { childLogger } from '../utils/logger';

const log = childLogger('socket');

// ─── Special vote sentinels ─────────────────────────────────────────────────────
const SCORE_UNDECIDED = -1; // ?
const SCORE_COFFEE    = -2; // ☕

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
  /** userIds of participants currently on coffee break — persists across resets/navigations */
  coffeeBreaks: Set<string>;
}

// ─── In-memory state ──────────────────────────────────────────────────────────

const rooms = new Map<string, RoomState>();
// socketId -> displayName per retro room code
const retroRooms = new Map<string, Map<string, string>>();

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
      coffeeBreaks: new Set(),
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
    log.info('client connected', { socketId: socket.id });

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

      log.info('user joined room', { displayName, roomCode: code });
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
      // coffeeBreaks intentionally preserved across navigations

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

      // Restore coffee-break votes before broadcasting
      for (const [sid, p] of room.participants) {
        if (room.coffeeBreaks.has(p.userId)) {
          room.votes.set(p.userId, { userId: p.userId, displayName: p.displayName, score: SCORE_COFFEE });
        }
      }

      io.to(code).emit('session:start_scoring', {
        workItem: room.currentWorkItem,
      });

      // If any coffee-break votes were restored, broadcast the updated vote list
      if (room.coffeeBreaks.size > 0) {
        io.to(code).emit('vote:update', { votes: serializeVotes(room, false) });
      }
    });

    // ── vote:cast ─────────────────────────────────────────────────────────────
    // User submits a score; other participants see only that they voted (no value).
    // Also allowed after reveal so users can update their vote.
    socket.on('vote:cast', (data: { code: string; score: number }) => {
      const { code, score } = data;
      const room = rooms.get(code);
      if (!room || !room.scoringActive) return;

      const participant = room.participants.get(socket.id);
      if (!participant) return;

      room.votes.set(participant.userId, {
        userId: participant.userId,
        displayName: participant.displayName,
        score,
      });

      // Track / clear coffee-break status
      if (score === SCORE_COFFEE) {
        room.coffeeBreaks.add(participant.userId);
      } else {
        room.coffeeBreaks.delete(participant.userId);
      }

      if (room.revealed) {
        // Re-broadcast the full revealed state with updated vote & recalculated stats
        const votes = serializeVotes(room, true);
        // Exclude special sentinels (? and ☕) from numeric stats
        const numericScores = votes
          .map((v) => v.score as number)
          .filter((s) => s > 0);
        const avg = numericScores.length ? numericScores.reduce((a, b) => a + b, 0) / numericScores.length : 0;
        const sorted = [...numericScores].sort((a, b) => a - b);

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
      } else {
        // Send hidden vote list (no scores) to all participants
        io.to(code).emit('vote:update', {
          votes: serializeVotes(room, false),
        });
      }
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
      // Exclude special sentinels (? and ☕) from numeric stats
      const numericScores = votes
        .map((v) => v.score as number)
        .filter((s) => s > 0);
      const avg = numericScores.length ? numericScores.reduce((a, b) => a + b, 0) / numericScores.length : 0;
      const sorted = [...numericScores].sort((a, b) => a - b);

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
      // coffeeBreaks intentionally preserved across resets

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

    // ── retro:join ────────────────────────────────────────────────────────────
    // Any participant (authenticated or future guest) joins a retro socket room.
    socket.on('retro:join', (data: { code: string; displayName?: string }) => {
      const { code, displayName } = data;
      if (!code) return;
      socket.join(`retro:${code}`);
      // Track participant
      if (!retroRooms.has(code)) retroRooms.set(code, new Map());
      retroRooms.get(code)!.set(socket.id, displayName ?? 'Guest');
      io.to(`retro:${code}`).emit('retro:participants_changed', {
        participants: Array.from(retroRooms.get(code)!.values()),
      });
      log.info('joined retro room', { socketId: socket.id, roomCode: code });
    });

    // ── retro:leave ───────────────────────────────────────────────────────────
    socket.on('retro:leave', (data: { code: string }) => {
      const { code } = data;
      if (!code) return;
      socket.leave(`retro:${code}`);
      retroRooms.get(code)?.delete(socket.id);
      if (retroRooms.get(code)?.size === 0) retroRooms.delete(code);
      else {
        io.to(`retro:${code}`).emit('retro:participants_changed', {
          participants: Array.from(retroRooms.get(code)!.values()),
        });
      }
    });

    // ── disconnect ────────────────────────────────────────────────────────────
    socket.on('disconnect', () => {
      handleLeave(socket, io);
      log.info('client disconnected', { socketId: socket.id });
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
  // Clean up retro rooms
  for (const [code, participants] of retroRooms) {
    if (participants.has(socket.id)) {
      participants.delete(socket.id);
      if (participants.size === 0) {
        retroRooms.delete(code);
      } else {
        io.to(`retro:${code}`).emit('retro:participants_changed', {
          participants: Array.from(participants.values()),
        });
      }
      break;
    }
  }
}
