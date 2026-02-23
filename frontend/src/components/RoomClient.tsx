'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import WorkItemList, { type WorkItem } from './WorkItemList';
import WorkItemDetail, { type VoteInfo, type VoteStats, type AIEstimateResult } from './WorkItemDetail';

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? '';

// ─── Props ────────────────────────────────────────────────────────────────────

interface Participant {
  userId: string;
  displayName: string;
}

interface RoomInfo {
  id: string;
  code: string;
  moderatorId: string;
  isModerator: boolean;
  projectName: string;
  organization: string;
  sprintName: string;
}

interface UserSession {
  id: string;
  displayName: string;
  email: string;
  isGuest?: true;
}

interface Props {
  room: RoomInfo;
  user: UserSession;
  locale: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function RoomClient({ room, user, locale }: Props) {
  const socketRef = useRef<Socket | null>(null);

  // Work items from backend REST
  const [workItems, setWorkItems] = useState<WorkItem[]>([]);
  const [itemsLoading, setItemsLoading] = useState(true);
  const [itemsError, setItemsError] = useState<string | null>(null);

  // Room live state (driven by socket events)
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [currentWorkItem, setCurrentWorkItem] = useState<WorkItem | null>(null);
  const [scoringActive, setScoringActive] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [votes, setVotes] = useState<VoteInfo[]>([]);
  const [stats, setStats] = useState<VoteStats | null>(null);
  const [myScore, setMyScore] = useState<number | null>(null);

  // AI estimation state
  const [aiEstimate, setAiEstimate] = useState<AIEstimateResult | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // Copy URL state (for moderator)
  const [urlCopied, setUrlCopied] = useState(false);

  // Set when this session is displaced by a newer connection with the same userId
  const [replacedMessage, setReplacedMessage] = useState<string | null>(null);

  // View: 'list' or 'item'
  const view = currentWorkItem ? 'item' : 'list';

  // ── Fetch work items (moderator / authenticated participants only) ─────────
  useEffect(() => {
    // Guests don't fetch the item list — they see whatever the moderator navigates to via socket
    if (user.isGuest) {
      setItemsLoading(false);
      return;
    }
    async function load() {
      setItemsLoading(true);
      setItemsError(null);
      try {
        const res = await fetch(`${BACKEND}/api/rooms/${room.code}/work-items`, {
          credentials: 'include',
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({ error: 'Unknown error' })) as { error?: string };
          throw new Error(body.error ?? `HTTP ${res.status}`);
        }
        const data = await res.json() as WorkItem[];
        setWorkItems(data);
      } catch (err: unknown) {
        setItemsError(err instanceof Error ? err.message : 'Failed to load work items');
      } finally {
        setItemsLoading(false);
      }
    }
    void load();
  }, [room.code, user.isGuest]);

  // ── Socket connection ──────────────────────────────────────────────────────
  useEffect(() => {
    const socket = io(BACKEND || undefined, { withCredentials: true });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('room:join', {
        code: room.code,
        userId: user.id,
        displayName: user.displayName,
        moderatorId: room.moderatorId,
      });
    });

    // Full state sync (on join)
    socket.on('room:state', (data: {
      moderatorId: string;
      participants: Participant[];
      currentWorkItem: WorkItem | null;
      scoringActive: boolean;
      votes: VoteInfo[];
      revealed: boolean;
      aiEstimate?: AIEstimateResult | null;
    }) => {
      setParticipants(data.participants);
      setCurrentWorkItem(data.currentWorkItem);
      setScoringActive(data.scoringActive);
      setVotes(data.votes);
      setRevealed(data.revealed);
      setAiEstimate(data.aiEstimate ?? null);
      setMyScore(null);
    });

    socket.on('room:participants_changed', (data: { participants: Participant[] }) => {
      setParticipants(data.participants);
    });

    socket.on('session:navigate', (data: { workItem: WorkItem }) => {
      setCurrentWorkItem(data.workItem);
      setScoringActive(false);
      setVotes([]);
      setRevealed(false);
      setStats(null);
      setMyScore(null);
      setAiEstimate(null);
      setAiError(null);
    });

    socket.on('session:start_scoring', () => {
      setScoringActive(true);
      setVotes([]);
      setRevealed(false);
      setStats(null);
      setMyScore(null);
      setAiError(null);
    });

    socket.on('vote:update', (data: { votes: VoteInfo[] }) => {
      setVotes(data.votes);
    });

    socket.on('vote:revealed', (data: { votes: VoteInfo[]; stats: VoteStats; aiEstimate?: AIEstimateResult | null }) => {
      setVotes(data.votes);
      setStats(data.stats);
      setRevealed(true);
      setAiEstimate(data.aiEstimate ?? null);
    });

    socket.on('session:reset', () => {
      setCurrentWorkItem(null);
      setScoringActive(false);
      setVotes([]);
      setRevealed(false);
      setStats(null);
      setMyScore(null);
      setAiEstimate(null);
      setAiError(null);
    });

    socket.on('room:replaced', (data: { message: string }) => {
      setReplacedMessage(data.message);
      socket.disconnect();
    });

    return () => {
      socket.emit('room:leave', { code: room.code });
      socket.disconnect();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room.code, user.id]);

  // ── Socket action handlers ─────────────────────────────────────────────────

  const handleSelectItem = useCallback((item: WorkItem) => {
    if (!room.isModerator) {
      // Non-moderators can open items freely (local only, not broadcasted)
      setCurrentWorkItem(item);
      setScoringActive(false);
      setVotes([]);
      setRevealed(false);
      setStats(null);
      setMyScore(null);
      return;
    }
    // Moderator: broadcast to all participants
    socketRef.current?.emit('session:navigate', {
      code: room.code,
      workItem: item,
    });
  }, [room.isModerator, room.code]);

  const handleStartScoring = useCallback(() => {
    socketRef.current?.emit('session:start_scoring', { code: room.code });
  }, [room.code]);

  const handleCastVote = useCallback((score: number) => {
    setMyScore(score);
    socketRef.current?.emit('vote:cast', { code: room.code, score });
  }, [room.code]);

  const handleReveal = useCallback(() => {
    socketRef.current?.emit('vote:reveal', {
      code: room.code,
      ...(aiEstimate ? { aiEstimate } : {}),
    });
  }, [room.code, aiEstimate]);

  const handleAIEstimate = useCallback(async () => {
    if (!currentWorkItem) return;
    setAiLoading(true);
    setAiError(null);
    try {
      const res = await fetch(`${BACKEND}/api/ai/estimate`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomCode: room.code, workItemId: currentWorkItem.id, locale }),
      });
      const data = await res.json() as { 'story-point'?: number; reason?: string; 'similar-items'?: string[]; error?: string };
      if (!res.ok) {
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      setAiEstimate(data as AIEstimateResult);
    } catch (err: unknown) {
      setAiError(err instanceof Error ? err.message : 'AI estimation failed');
    } finally {
      setAiLoading(false);
    }
  }, [currentWorkItem, room.code]);

  const handleReset = useCallback(() => {
    socketRef.current?.emit('session:reset', { code: room.code });
  }, [room.code]);

  const handleUpdateWorkItem = useCallback(async (score: number) => {
    if (!currentWorkItem) return;
    const res = await fetch(`${BACKEND}/api/rooms/${room.code}/work-items/${currentWorkItem.id}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ storyPoints: score }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: 'Unknown error' })) as { error?: string };
      throw new Error(body.error ?? `HTTP ${res.status}`);
    }
    // Update local state so the UI reflects the new score immediately
    const updated = { ...currentWorkItem, storyPoints: score };
    setCurrentWorkItem(updated);
    setWorkItems((prev) => prev.map((wi) => wi.id === currentWorkItem.id ? updated : wi));
  }, [currentWorkItem, room.code]);

  const handleBack = useCallback(() => {
    if (room.isModerator) {
      // Moderator going back resets everyone
      socketRef.current?.emit('session:reset', { code: room.code });
    } else {
      // Non-moderator local navigation only
      setCurrentWorkItem(null);
      setScoringActive(false);
      setVotes([]);
      setRevealed(false);
      setStats(null);
      setMyScore(null);
    }
  }, [room.isModerator, room.code]);

  // ── Render ─────────────────────────────────────────────────────────────────

  if (replacedMessage) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
        <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center mx-auto">
            <span className="text-amber-400 text-xl">⚠</span>
          </div>
          <h2 className="text-white font-semibold text-lg">Session Replaced</h2>
          <p className="text-slate-400 text-sm">{replacedMessage}</p>
          <a
            href={`/${locale}/dashboard`}
            className="inline-block mt-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors"
          >
            Back to Dashboard
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      {/* ── Header ── */}
      <header className="border-b border-slate-800/60 bg-slate-950/80 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <a href={user.isGuest ? `/${locale}` : `/${locale}/dashboard`} className="flex items-center gap-2 hover:opacity-80 transition-opacity shrink-0">
              <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
                <span className="text-white font-bold text-sm">SP</span>
              </div>
            </a>
            <div className="min-w-0 hidden sm:block">
              <div className="text-white font-semibold text-sm truncate">{room.projectName}</div>
              <div className="text-slate-500 text-xs truncate">{room.sprintName}</div>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {/* Participant count */}
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800">
              <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="text-slate-400 text-xs">{participants.length}</span>
            </div>

            {/* Room code + Copy URL (moderator only) */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800">
                <span className="text-slate-500 text-xs hidden sm:inline">Room</span>
                <span className="font-mono font-bold text-indigo-400 tracking-widest text-sm">{room.code}</span>
              </div>
              {room.isModerator && (
                <button
                  onClick={() => {
                    const url = `${window.location.origin}/${locale}/room/${room.code}`;
                    void navigator.clipboard.writeText(url).then(() => {
                      setUrlCopied(true);
                      setTimeout(() => setUrlCopied(false), 2000);
                    });
                  }}
                  title="Copy invite URL"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:border-indigo-500/50 hover:bg-slate-800 transition text-xs text-slate-400 hover:text-indigo-300 shrink-0"
                >
                  {urlCopied ? (
                    <>
                      <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="hidden sm:inline text-emerald-400">Copied!</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                      </svg>
                      <span className="hidden sm:inline">Copy URL</span>
                    </>
                  )}
                </button>
              )}
            </div>

            {/* Moderator badge */}
            {room.isModerator && (
              <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-600/20 border border-indigo-500/30 text-indigo-300 text-xs font-medium">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M9.664 1.319a.75.75 0 01.672 0 41.059 41.059 0 018.198 5.424.75.75 0 01-.254 1.285 31.372 31.372 0 00-7.86 3.83.75.75 0 01-.84 0 31.508 31.508 0 00-2.08-1.287V9.48a31.525 31.525 0 00-5.78-2.257.75.75 0 01-.254-1.285A41.059 41.059 0 019.664 1.319zM10 3.017L2.592 7.5c1.43.485 2.797 1.09 4.08 1.8A33.15 33.15 0 0110 7.655a33.15 33.15 0 013.328 1.645 29.944 29.944 0 014.08-1.8L10 3.017zM10 9.23a31.608 31.608 0 00-3.843 2.076 32.024 32.024 0 00-3.843-2.076V16.5A.5.5 0 003 17h14a.5.5 0 00.314-.9L10 9.23z" clipRule="evenodd" />
                </svg>
                Moderator
              </span>
            )}
          </div>
        </div>
      </header>

      {/* ── Participants strip ── */}
      {participants.length > 0 && (
        <div className="border-b border-slate-800/40 bg-slate-900/30">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 flex items-center gap-2 overflow-x-auto">
            <span className="text-slate-600 text-xs shrink-0">Online:</span>
            {participants.map((p) => (
              <span
                key={p.userId}
                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs border shrink-0 ${
                  p.userId === room.moderatorId
                    ? 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                {p.displayName}
                {p.userId === room.moderatorId && <span className="opacity-60"> ★</span>}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Main content ── */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col">
        {view === 'list' ? (
          <>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h1 className="text-lg font-bold text-white">{room.sprintName}</h1>
                <p className="text-slate-500 text-sm">{room.organization} · {room.projectName}</p>
              </div>
              {!room.isModerator && !user.isGuest && (
                <span className="text-slate-500 text-xs">Click any item to view details</span>
              )}
              {room.isModerator && (
                <span className="text-slate-500 text-xs">Click an item to navigate everyone to it</span>
              )}
            </div>
            {user.isGuest ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center py-20">
                <div className="w-12 h-12 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center mb-4">
                  <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z" />
                  </svg>
                </div>
                <p className="text-slate-400 font-medium">Waiting for moderator</p>
                <p className="text-slate-600 text-sm mt-1">The moderator will select a work item to begin voting.</p>
              </div>
            ) : (
              <WorkItemList
                items={workItems}
                loading={itemsLoading}
                error={itemsError}
                onSelectItem={handleSelectItem}
              />
            )}
          </>
        ) : currentWorkItem ? (
          <WorkItemDetail
            workItem={currentWorkItem}
            isModerator={room.isModerator}
            userId={user.id}
            scoringActive={scoringActive}
            revealed={revealed}
            votes={votes}
            stats={stats}
            myScore={myScore}
            onStartScoring={handleStartScoring}
            onCastVote={handleCastVote}
            onReveal={handleReveal}
            onReset={handleReset}
            onBack={handleBack}
            onUpdateWorkItem={room.isModerator ? handleUpdateWorkItem : undefined}
            aiEstimate={room.isModerator ? aiEstimate : (revealed ? aiEstimate : null)}
            aiLoading={aiLoading}
            aiError={aiError}
            onEstimateWithAI={room.isModerator ? handleAIEstimate : undefined}
          />
        ) : null}
      </main>
    </div>
  );
}
