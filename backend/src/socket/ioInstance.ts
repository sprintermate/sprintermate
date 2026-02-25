import { Server as SocketIOServer } from 'socket.io';

let _io: SocketIOServer | null = null;

export function setIO(io: SocketIOServer): void {
  _io = io;
}

export function getIO(): SocketIOServer {
  if (!_io) throw new Error('Socket.IO not yet initialized');
  return _io;
}
