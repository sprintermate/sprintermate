'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useTranslations } from 'next-intl';
import WorkItemList, { type WorkItem } from './WorkItemList';
import WorkItemDetail, { type VoteInfo, type VoteStats, type AIEstimateResult } from './WorkItemDetail';
import { ThemeToggle } from './ThemeProvider';

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
  const t = useTranslations('room');
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

  // AI estimation state (session-level, reset on navigate)
  const [aiEstimate, setAiEstimate] = useState<AIEstimateResult | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // Batch AI estimation state
  const [estimatingItems, setEstimatingItems] = useState<Set<number>>(new Set());
  const [savedAiEstimates, setSavedAiEstimates] = useState<Map<number, AIEstimateResult>>(new Map());
  const [isEstimatingAll, setIsEstimatingAll] = useState(false);

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

  // ── Load persisted AI estimates ───────────────────────────────────────────
  useEffect(() => {
    if (user.isGuest) return;
    async function loadSavedEstimates() {
      try {
        const res = await fetch(`${BACKEND}/api/ai/estimates?roomCode=${room.code}`, {
          credentials: 'include',
        });
        if (!res.ok) return;
        const data = await res.json() as Array<{ workItemId: number; estimate: AIEstimateResult }>;
        setSavedAiEstimates(new Map(data.map((d) => [d.workItemId, d.estimate])));
      } catch {
        // Estimates are optional — ignore errors
      }
    }
    void loadSavedEstimates();
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

    // Batch AI estimation events
    socket.on('ai:estimate_start', (data: { workItemId: number }) => {
      setEstimatingItems((prev) => new Set(prev).add(data.workItemId));
    });

    socket.on('ai:estimate_complete', (data: { workItemId: number; estimate: AIEstimateResult }) => {
      setEstimatingItems((prev) => {
        const next = new Set(prev);
        next.delete(data.workItemId);
        return next;
      });
      setSavedAiEstimates((prev) => new Map(prev).set(data.workItemId, data.estimate));
    });

    socket.on('ai:estimate_error', (data: { workItemId: number }) => {
      setEstimatingItems((prev) => {
        const next = new Set(prev);
        next.delete(data.workItemId);
        return next;
      });
    });

    socket.on('ai:estimate_all_complete', () => {
      setEstimatingItems(new Set());
      setIsEstimatingAll(false);
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

  // handleAIEstimate defined before handleStartScoring (which depends on it)
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
      const data = await res.json() as AIEstimateResult & { error?: string };
        if (!res.ok) {
          throw new Error(typeof data.error === 'string' ? data.error : `HTTP ${res.status}`);
        }
      const result = data as AIEstimateResult;
      setAiEstimate(result);
      setSavedAiEstimates((prev) => new Map(prev).set(currentWorkItem.id, result));
    } catch (err: unknown) {
      setAiError(err instanceof Error ? err.message : 'AI estimation failed');
    } finally {
      setAiLoading(false);
    }
  }, [currentWorkItem, room.code, locale]);

  const handleEstimateAll = useCallback(async () => {
    setIsEstimatingAll(true);
    try {
      const res = await fetch(`${BACKEND}/api/ai/estimate-all`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomCode: room.code, locale }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        console.error('estimate-all failed:', body.error);
        setIsEstimatingAll(false);
      }
      // isEstimatingAll stays true until ai:estimate_all_complete fires
    } catch {
      setIsEstimatingAll(false);
    }
  }, [room.code, locale]);

  const handleCancelEstimateAll = useCallback(async () => {
    // Immediately reset UI state for instant feedback
    setIsEstimatingAll(false);
    setEstimatingItems(new Set());
    try {
      await fetch(`${BACKEND}/api/ai/estimate-all/cancel`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomCode: room.code }),
      });
    } catch {
      // fire-and-forget — UI is already reset
    }
  }, [room.code]);

  const handleStartScoring = useCallback(() => {
    socketRef.current?.emit('session:start_scoring', { code: room.code });
    // Trigger AI estimation simultaneously when scoring starts (moderator only)
    if (room.isModerator && currentWorkItem) {
      const saved = savedAiEstimates.get(currentWorkItem.id);
      if (saved) {
        setAiEstimate(saved);
      } else {
        void handleAIEstimate();
      }
    }
  }, [room.code, room.isModerator, currentWorkItem, handleAIEstimate, savedAiEstimates]);

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

  const handleReset = useCallback(() => {
    socketRef.current?.emit('session:reset', { code: room.code });
  }, [room.code]);

  const handleUpdateWorkItem = useCallback(async (score: number, aiScore: number | null) => {
    if (!currentWorkItem) return;
    const res = await fetch(`${BACKEND}/api/rooms/${room.code}/work-items/${currentWorkItem.id}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ storyPoints: score, aiScore }),
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

  const handleNextItem = useCallback(() => {
    if (!currentWorkItem) return;
    const idx = workItems.findIndex((wi) => wi.id === currentWorkItem.id);
    if (idx >= 0 && idx < workItems.length - 1) {
      handleSelectItem(workItems[idx + 1]!);
    }
  }, [currentWorkItem, workItems, handleSelectItem]);

  const handlePrevItem = useCallback(() => {
    if (!currentWorkItem) return;
    const idx = workItems.findIndex((wi) => wi.id === currentWorkItem.id);
    if (idx > 0) {
      handleSelectItem(workItems[idx - 1]!);
    }
  }, [currentWorkItem, workItems, handleSelectItem]);

  // ── Render ─────────────────────────────────────────────────────────────────

  if (replacedMessage) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-slate-950 flex items-center justify-center px-4">
        <div className="w-full max-w-sm bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-8 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-amber-100 border border-amber-300 dark:bg-amber-500/20 dark:border-amber-500/40 flex items-center justify-center mx-auto">
            <span className="text-amber-500 dark:text-amber-400 text-xl">⚠</span>
          </div>
          <h2 className="text-gray-900 dark:text-white font-semibold text-lg">{t('sessionReplaced')}</h2>
          <p className="text-gray-500 dark:text-slate-400 text-sm">{replacedMessage}</p>
          <a
            href={`/${locale}/dashboard`}
            className="inline-block mt-2 px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white text-sm font-medium transition-colors"
          >
            {t('backToDashboard')}
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 flex flex-col">
      {/* ── Header ── */}
      <header className="border-b border-gray-200/60 bg-white/80 dark:border-slate-800/60 dark:bg-slate-950/80 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <a href={user.isGuest ? `/${locale}` : `/${locale}/dashboard`} className="flex items-center gap-2 hover:opacity-80 transition-opacity shrink-0">
              <div className="w-8 h-8 rounded-lg bg-cyan-600 dark:bg-indigo-600 flex items-center justify-center">
                <span className="text-white font-bold text-sm">SP</span>
              </div>
            </a>
            <div className="min-w-0 hidden sm:block">
              <div className="text-gray-900 dark:text-white font-semibold text-sm truncate">{room.projectName}</div>
              <div className="text-gray-400 dark:text-slate-500 text-xs truncate">{room.sprintName}</div>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {/* Participant count */}
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 border border-gray-200 dark:bg-slate-900 dark:border-slate-800">
              <svg className="w-3.5 h-3.5 text-gray-400 dark:text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="text-gray-500 dark:text-slate-400 text-xs">{participants.length}</span>
            </div>

            {/* Room code + Copy URL (moderator only) */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-100 border border-gray-200 dark:bg-slate-900 dark:border-slate-800">
                <span className="text-gray-400 dark:text-slate-500 text-xs hidden sm:inline">{t('roomLabel')}</span>
                <span className="font-mono font-bold text-cyan-600 dark:text-indigo-400 tracking-widest text-sm">{room.code}</span>
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
                  title={t('copyInviteUrl')}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 border border-gray-200 hover:border-cyan-400 hover:bg-gray-50 dark:bg-slate-900 dark:border-slate-800 dark:hover:border-indigo-500/50 dark:hover:bg-slate-800 transition text-xs text-gray-500 hover:text-cyan-600 dark:text-slate-400 dark:hover:text-indigo-300 shrink-0"
                >
                  {urlCopied ? (
                    <>
                      <svg className="w-3.5 h-3.5 text-green-500 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="hidden sm:inline text-green-500 dark:text-emerald-400">{t('copied')}</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                      </svg>
                      <span className="hidden sm:inline">{t('copyUrl')}</span>
                    </>
                  )}
                </button>
              )}
            </div>

            {/* Theme toggle */}
            <ThemeToggle />

            {/* Moderator badge */}
            {room.isModerator && (
              <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-cyan-600/20 border border-cyan-500/30 text-cyan-700 dark:bg-indigo-600/20 dark:border-indigo-500/30 dark:text-indigo-300 text-xs font-medium">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M9.664 1.319a.75.75 0 01.672 0 41.059 41.059 0 018.198 5.424.75.75 0 01-.254 1.285 31.372 31.372 0 00-7.86 3.83.75.75 0 01-.84 0 31.508 31.508 0 00-2.08-1.287V9.48a31.525 31.525 0 00-5.78-2.257.75.75 0 01-.254-1.285A41.059 41.059 0 019.664 1.319zM10 3.017L2.592 7.5c1.43.485 2.797 1.09 4.08 1.8A33.15 33.15 0 0110 7.655a33.15 33.15 0 013.328 1.645 29.944 29.944 0 014.08-1.8L10 3.017zM10 9.23a31.608 31.608 0 00-3.843 2.076 32.024 32.024 0 00-3.843-2.076V16.5A.5.5 0 003 17h14a.5.5 0 00.314-.9L10 9.23z" clipRule="evenodd" />
                </svg>
                {t('moderator')}
               </span>
            )}
          </div>
        </div>
      </header>

      {/* ── Participants strip ── */}
      {participants.length > 0 && (
        <div className="border-b border-gray-200/40 bg-gray-100/30 dark:border-slate-800/40 dark:bg-slate-900/30">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 flex items-center gap-2 overflow-x-auto">
            <span className="text-gray-300 dark:text-slate-600 text-xs shrink-0">{t('online')}</span>
            {participants.map((p) => (
              <span
                key={p.userId}
                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs border shrink-0 ${
                  p.userId === room.moderatorId
                    ? 'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-indigo-500/10 dark:text-indigo-300 dark:border-indigo-500/20'
                    : 'bg-gray-100 text-gray-500 border-gray-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 dark:bg-emerald-400 shrink-0" />
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
                <h1 className="text-lg font-bold text-gray-900 dark:text-white">{room.sprintName}</h1>
                <p className="text-gray-400 dark:text-slate-500 text-sm">{room.organization} · {room.projectName}</p>
              </div>
              {!room.isModerator && !user.isGuest && (
                <span className="text-gray-400 dark:text-slate-500 text-xs">{t('clickItemHint')}</span>
              )}
              {room.isModerator && (
                <span className="text-gray-400 dark:text-slate-500 text-xs">{t('clickItemModeratorHint')}</span>
              )}
            </div>
            {user.isGuest ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center py-20">
                <div className="w-12 h-12 rounded-full bg-gray-100 border border-gray-200 dark:bg-slate-800 dark:border-slate-700 flex items-center justify-center mb-4">
                  <svg className="w-5 h-5 text-gray-400 dark:text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z" />
                  </svg>
                </div>
                <p className="text-gray-600 dark:text-slate-400 font-medium">{t('waitingForModerator')}</p>
                <p className="text-gray-400 dark:text-slate-600 text-sm mt-1">{t('waitingForModeratorDesc')}</p>
              </div>
            ) : (
              <WorkItemList
                items={workItems}
                loading={itemsLoading}
                error={itemsError}
                onSelectItem={handleSelectItem}
                isModerator={room.isModerator}
                onEstimateAll={room.isModerator ? handleEstimateAll : undefined}
                onCancelEstimateAll={handleCancelEstimateAll}
                estimatingItems={estimatingItems}
                isEstimatingAll={isEstimatingAll}
                savedAiEstimates={savedAiEstimates}
              />
            )}
          </>
        ) : currentWorkItem ? (
          <WorkItemDetail
            workItem={currentWorkItem}
            roomCode={room.code}
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
            onNextItem={room.isModerator ? handleNextItem : undefined}
            onPrevItem={room.isModerator ? handlePrevItem : undefined}
            hasNext={room.isModerator ? workItems.findIndex((wi) => wi.id === currentWorkItem.id) < workItems.length - 1 && workItems.findIndex((wi) => wi.id === currentWorkItem.id) >= 0 : undefined}
            hasPrev={room.isModerator ? workItems.findIndex((wi) => wi.id === currentWorkItem.id) > 0 : undefined}
            onUpdateWorkItem={room.isModerator ? handleUpdateWorkItem : undefined}
            aiEstimate={revealed ? aiEstimate : null}
            aiLoading={aiLoading}
            aiError={aiError}
            savedAiEstimate={savedAiEstimates.get(currentWorkItem.id) ?? null}
            isBeingBatchEstimated={estimatingItems.has(currentWorkItem.id)}
          />
        ) : null}
      </main>
    </div>
  );
}
