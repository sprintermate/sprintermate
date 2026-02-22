'use client';

import { useState } from 'react';
import RoomClient from './RoomClient';

interface RoomInfo {
  id: string;
  code: string;
  moderatorId: string;
  isModerator: boolean;
  projectName: string;
  organization: string;
  sprintName: string;
}

interface Props {
  room: RoomInfo;
  locale: string;
}

export default function GuestJoinClient({ room, locale }: Props) {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [joined, setJoined] = useState(false);
  const [guestUser, setGuestUser] = useState<{ id: string; displayName: string; email: string; isGuest: true } | null>(null);

  function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      setError('Name must be at least 2 characters.');
      return;
    }
    if (trimmed.length > 63) {
      setError('Name must be less than 64 characters.');
      return;
    }
    // Generate a stable guest ID for this session
    const guestId = crypto.randomUUID();
    setGuestUser({ id: guestId, displayName: trimmed, email: '', isGuest: true });
    setJoined(true);
  }

  if (joined && guestUser) {
    return <RoomClient room={room} user={guestUser} locale={locale} />;
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-600/30">
            <span className="text-white font-bold text-lg">SP</span>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8">
          <div className="text-center mb-6">
            <h1 className="text-xl font-bold text-white mb-1">Join Room</h1>
            <p className="text-slate-400 text-sm">
              Room{' '}
              <span className="font-mono font-bold text-indigo-400 tracking-widest">
                {room.code}
              </span>
            </p>
            {room.sprintName && (
              <p className="text-slate-500 text-xs mt-1">{room.sprintName}</p>
            )}
          </div>

          <form onSubmit={handleJoin} className="space-y-4">
            <div>
              <label htmlFor="guest-name" className="block text-sm font-medium text-slate-300 mb-1.5">
                Your name
              </label>
              <input
                id="guest-name"
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setError(null);
                }}
                placeholder="Enter your display name"
                maxLength={63}
                autoFocus
                className="w-full px-4 py-2.5 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm transition"
              />
              {error && (
                <p className="mt-1.5 text-xs text-red-400">{error}</p>
              )}
            </div>

            <button
              type="submit"
              className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-900"
            >
              Join Room
            </button>
          </form>
        </div>

        <p className="text-center text-slate-600 text-xs mt-6">
          Are you the moderator?{' '}
          <a href={`/${locale}/login`} className="text-indigo-400 hover:text-indigo-300 transition">
            Sign in with Azure DevOps
          </a>
        </p>
      </div>
    </div>
  );
}
