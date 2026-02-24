'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
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
  const t = useTranslations('guestJoin');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [joined, setJoined] = useState(false);
  const [guestUser, setGuestUser] = useState<{ id: string; displayName: string; email: string; isGuest: true } | null>(null);

  function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      setError(t('errorTooShort'));
      return;
    }
    if (trimmed.length > 63) {
      setError(t('errorTooLong'));
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
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-cyan-600 dark:bg-indigo-600 flex items-center justify-center shadow-lg shadow-cyan-600/30 dark:shadow-indigo-600/30">
            <span className="text-white font-bold text-lg">SP</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-8">
          <div className="text-center mb-6">
            <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-1">{t('title')}</h1>
            <p className="text-gray-500 dark:text-slate-400 text-sm">
              {t('roomLabel')}{' '}
              <span className="font-mono font-bold text-cyan-600 dark:text-indigo-400 tracking-widest">
                {room.code}
              </span>
            </p>
            {room.sprintName && (
              <p className="text-gray-400 dark:text-slate-500 text-xs mt-1">{room.sprintName}</p>
            )}
          </div>

          <form onSubmit={handleJoin} className="space-y-4">
            <div>
              <label htmlFor="guest-name" className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">
                {t('nameLabel')}
              </label>
              <input
                id="guest-name"
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setError(null);
                }}
                placeholder={t('namePlaceholder')}
                maxLength={63}
                autoFocus
                className="w-full px-4 py-2.5 rounded-lg bg-gray-100 border border-gray-300 text-gray-900 placeholder-gray-400 dark:bg-slate-800 dark:border-slate-700 dark:text-white dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 dark:focus:ring-indigo-500 focus:border-transparent text-sm transition"
              />
              {error && (
                <p className="mt-1.5 text-xs text-red-500 dark:text-red-400">{error}</p>
              )}
            </div>

            <button
              type="submit"
              className="w-full py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white font-semibold text-sm transition focus:outline-none focus:ring-2 focus:ring-cyan-500 dark:focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-slate-900"
            >
              {t('joinButton')}
            </button>
          </form>
        </div>

        <p className="text-center text-gray-400 dark:text-slate-600 text-xs mt-6">
          {t('moderatorPrompt')}{' '}
          <a href={`/${locale}/login`} className="text-cyan-600 hover:text-cyan-500 dark:text-indigo-400 dark:hover:text-indigo-300 transition">
            {t('signInLink')}
          </a>
        </p>
      </div>
    </div>
  );
}
