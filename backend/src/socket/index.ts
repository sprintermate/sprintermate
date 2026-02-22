import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';

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
    };
    rooms.set(code, state);
  }
  return state;
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
  };
}

// ─── Socket initialisation ────────────────────────────────────────────────────

export function initSocket(httpServer: HttpServer): SocketIOServer {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL ?? 'http://localhost:3000',
      credentials: true,
    },
  });

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

      // Only moderator may force navigation
      const participant = room.participants.get(socket.id);
      if (!participant || participant.userId !== room.moderatorId) return;

      room.currentWorkItem = workItem;
      room.scoringActive   = false;
      room.votes           = new Map();
      room.revealed        = false;

      io.to(code).emit('session:navigate', { workItem });
    });

    // ── session:start_scoring ─────────────────────────────────────────────────
    // Moderator clicks "Start Scoring" → transitions all users to scoring mode
    socket.on('session:start_scoring', (data: { code: string }) => {
      const { code } = data;
      const room = rooms.get(code);
      if (!room) return;

      const participant = room.participants.get(socket.id);
      if (!participant || participant.userId !== room.moderatorId) return;

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
    // Moderator reveals all scores
    socket.on('vote:reveal', (data: { code: string }) => {
      const { code } = data;
      const room = rooms.get(code);
      if (!room) return;

      const participant = room.participants.get(socket.id);
      if (!participant || participant.userId !== room.moderatorId) return;

      room.revealed = true;

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
      });
    });

    // ── session:reset ─────────────────────────────────────────────────────────
    // Moderator resets the round (goes back to list)
    socket.on('session:reset', (data: { code: string }) => {
      const { code } = data;
      const room = rooms.get(code);
      if (!room) return;

      const participant = room.participants.get(socket.id);
      if (!participant || participant.userId !== room.moderatorId) return;

      room.currentWorkItem = null;
      room.scoringActive   = false;
      room.votes           = new Map();
      room.revealed        = false;

      io.to(code).emit('session:reset', {});
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
      room.participants.delete(socket.id);
      socket.leave(code);
      io.to(code).emit('room:participants_changed', {
        participants: serializeParticipants(room),
      });
      // Clean up empty rooms (keep if moderator may rejoin)
      break;
    }
  }
}
