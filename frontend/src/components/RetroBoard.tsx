'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { io, Socket } from 'socket.io-client';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Kalam } from 'next/font/google';
import LogoutButton from './LogoutButton';
import { getRetroFormat, type RetroColumn } from '../lib/retroFormats';

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? '';

// Hand-drawn marker font for headings — the "sticky note on a corkboard" nostalgia
const kalam = Kalam({ subsets: ['latin'], weight: ['700'] });

// How many dots each participant may spend across the whole board (classic dot-voting)
const VOTE_BUDGET_FALLBACK = 5;

/** Deterministic small rotation per card id, so notes look hand-placed but stay stable across re-renders. */
function cardRotation(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return (Math.abs(hash) % 7) - 3; // -3deg..3deg
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface RetroItem {
  id: string;
  session_code: string;
  category: string;
  content: string;
  author_id: string;
  author_name: string;
  votes: number;
}

export interface RetroAction {
  id: string;
  session_code: string;
  content: string;
  ai_suggested: boolean;
  is_accepted: boolean;
  created_at: string;
}

export interface AIAnalysisResult {
  summary: string;
  trend_analysis: string;
  actions: RetroAction[];
}

export interface RetroSession {
  id: string;
  code: string;
  title: string;
  created_by: string;
  project_id: string | null;
  theme: string;
  status: string;
  format: string;
  duration_minutes: number;
  created_at: string;
  isModerator: boolean;
  items: RetroItem[];
  actions: RetroAction[];
  voteBudget?: number;
  myVotedItemIds?: string[];
  myVotesRemaining?: number;
}

interface HistoryEntry {
  code: string;
  title: string;
  created_at: string;
  status: string;
  well_count: number;
  improve_count: number;
  ideas_count: number;
  actions_count: number;
}

interface User {
  id: string;
  displayName: string;
  email: string;
  isGuest?: boolean;
}

interface Props {
  session: RetroSession;
  user: User;
  locale: string;
}

// ─── Column config — driven by format ─────────────────────────────────────────

// ─── Timer ────────────────────────────────────────────────────────────────────

function useTimer(durationMinutes: number, running: boolean) {
  const [secondsLeft, setSecondsLeft] = useState(durationMinutes * 60);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setSecondsLeft(durationMinutes * 60);
  }, [durationMinutes]);

  useEffect(() => {
    if (!running) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = setInterval(() => {
      setSecondsLeft(s => Math.max(0, s - 1));
    }, 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [running]);

  const minutes = Math.floor(secondsLeft / 60).toString().padStart(2, '0');
  const seconds = (secondsLeft % 60).toString().padStart(2, '0');
  return { display: `${minutes}:${seconds}`, secondsLeft };
}

// ─── Main Component ───────────────────────────────────────────────────────────

function RetroBoard({ session: initialSession, user, locale }: Props) {
  const t = useTranslations('retro');
  const router = useRouter();
  const socketRef = useRef<Socket | null>(null);

  // Resolve format columns
  const retroFormat = useMemo(() => getRetroFormat(initialSession.format), [initialSession.format]);
  const columns: RetroColumn[] = retroFormat.columns;

  const [items, setItems] = useState<RetroItem[]>(initialSession.items);
  const [actions, setActions] = useState<RetroAction[]>(initialSession.actions);
  const [status, setStatus] = useState(initialSession.status);
  const [theme, setTheme] = useState<'dark' | 'light'>(initialSession.theme === 'light' ? 'light' : 'dark');
  const [timerRunning, setTimerRunning] = useState(false);
  const { display: timerDisplay, secondsLeft } = useTimer(initialSession.duration_minutes, timerRunning);

  // Participants
  const [participants, setParticipants] = useState<string[]>([]);
  const [showParticipants, setShowParticipants] = useState(false);

  // Copy link
  const [copied, setCopied] = useState(false);
  const joinUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/${locale}/retro/${initialSession.code}`
    : `/${locale}/retro/${initialSession.code}`;

  const handleCopyLink = useCallback(() => {
    navigator.clipboard.writeText(joinUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [joinUrl]);

  // Input state per column (dynamic keys)
  const emptyDraft = useMemo(() => {
    const d: Record<string, string> = {};
    columns.forEach(c => { d[c.key] = ''; });
    return d;
  }, [columns]);
  const [draft, setDraft] = useState<Record<string, string>>(emptyDraft);
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // AI analysis state
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiResult, setAiResult] = useState<AIAnalysisResult | null>(null);
  const [acceptedIds, setAcceptedIds] = useState<Set<string>>(new Set());
  const [manualAction, setManualAction] = useState('');
  const [manualActions, setManualActions] = useState<string[]>([]);
  const [savingActions, setSavingActions] = useState(false);

  // Trend/history
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  // Dot-voting: which cards this participant has spent a dot on, and how many are left
  const [myVotedItemIds, setMyVotedItemIds] = useState<Set<string>>(new Set(initialSession.myVotedItemIds ?? []));
  const [myVotesRemaining, setMyVotesRemaining] = useState<number>(initialSession.myVotesRemaining ?? VOTE_BUDGET_FALLBACK);
  const [voteBudget, setVoteBudget] = useState<number>(initialSession.voteBudget ?? VOTE_BUDGET_FALLBACK);
  const [voteError, setVoteError] = useState<string | null>(null);

  // "X is typing…" per column — ephemeral, socket-only
  const [typingByColumn, setTypingByColumn] = useState<Record<string, string[]>>({});
  const typingTimeoutRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const isDark = theme === 'dark';

  // ── Socket.IO ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const displayName = user.displayName;
    const socket = io(BACKEND, { withCredentials: true, transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('retro:join', { code: initialSession.code, displayName });
    });

    socket.on('retro:participants_changed', ({ participants: list }: { participants: string[] }) => {
      setParticipants(list);
    });

    socket.on('retro:item:added', (item: RetroItem) => {
      setItems(prev => [...prev.filter(i => i.id !== item.id), item]);
    });

    socket.on('retro:item:updated', (item: RetroItem) => {
      setItems(prev => prev.map(i => (i.id === item.id ? item : i)));
    });

    socket.on('retro:item:deleted', ({ id }: { id: string }) => {
      setItems(prev => prev.filter(i => i.id !== id));
    });

    socket.on('retro:typing', ({ column, displayName: typer, typing }: { column: string; displayName: string; typing: boolean }) => {
      setTypingByColumn(prev => {
        const list = new Set(prev[column] ?? []);
        if (typing) list.add(typer); else list.delete(typer);
        return { ...prev, [column]: Array.from(list) };
      });
    });

    socket.on('retro:analysis:done', (result: AIAnalysisResult) => {
      setAiResult(result);
      setActions(result.actions);
      setAcceptedIds(new Set(result.actions.map(a => a.id)));
      setStatus('analyzing');
      setAiLoading(false);
    });

    socket.on('retro:actions:saved', ({ actions: saved }: { actions: RetroAction[] }) => {
      setActions(saved);
      setStatus('closed');
    });

    const typingTimeouts = typingTimeoutRef.current;
    return () => {
      socket.emit('retro:leave', { code: initialSession.code });
      socket.disconnect();
      Object.values(typingTimeouts).forEach(clearTimeout);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSession.code, user.displayName]);

  // ── Refresh my dot-vote state on mount ───────────────────────────────────────
  // The SSR-rendered initial session prop can't know a guest's client-generated
  // id (it doesn't exist until after they submit their name), so re-fetch here.
  useEffect(() => {
    fetch(`${BACKEND}/api/retro/${initialSession.code}?voterId=${encodeURIComponent(user.id)}`, { credentials: 'include' })
      .then(r => (r.ok ? r.json() : null))
      .then((data: RetroSession | null) => {
        if (!data) return;
        setMyVotedItemIds(new Set(data.myVotedItemIds ?? []));
        setMyVotesRemaining(data.myVotesRemaining ?? VOTE_BUDGET_FALLBACK);
        setVoteBudget(data.voteBudget ?? VOTE_BUDGET_FALLBACK);
      })
      .catch(() => { /* keep defaults */ });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSession.code, user.id]);

  // ── Add item ───────────────────────────────────────────────────────────────
  const handleAddItem = useCallback(async (category: string) => {
    const content = draft[category].trim();
    if (!content) return;
    setSubmitting(true);
    try {
      const author_name = user.displayName;
      const author_id = user.id;
      const res = await fetch(`${BACKEND}/api/retro/${initialSession.code}/items`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category, content, author_name, author_id }),
      });
      if (res.ok) {
        setDraft(d => ({ ...d, [category]: '' }));
        setAddingTo(null);
        const socket = socketRef.current;
        if (socket) {
          if (typingTimeoutRef.current[category]) clearTimeout(typingTimeoutRef.current[category]);
          socket.emit('retro:typing', { code: initialSession.code, column: category, displayName: user.displayName, typing: false });
        }
      }
    } finally {
      setSubmitting(false);
    }
  }, [draft, initialSession.code, user]);

  // ── Delete item ────────────────────────────────────────────────────────────
  const handleDeleteItem = useCallback(async (item: RetroItem) => {
    await fetch(`${BACKEND}/api/retro/${initialSession.code}/items/${item.id}`, {
      method: 'DELETE',
      credentials: 'include',
    });
  }, [initialSession.code]);

  // ── Dot-vote toggle — classic fixed-budget retro voting ───────────────────
  const handleDotVote = useCallback(async (item: RetroItem) => {
    setVoteError(null);
    try {
      const res = await fetch(`${BACKEND}/api/retro/${initialSession.code}/items/${item.id}/vote`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voterId: user.id, voterName: user.displayName }),
      });
      const data = await res.json() as {
        voted?: boolean; voteBudget?: number; myVotesRemaining?: number; error?: string;
      };
      if (!res.ok) {
        setVoteError(data.error ?? t('noVotesLeft'));
        setTimeout(() => setVoteError(null), 2500);
        return;
      }
      setMyVotedItemIds(prev => {
        const next = new Set(prev);
        if (data.voted) next.add(item.id); else next.delete(item.id);
        return next;
      });
      if (typeof data.myVotesRemaining === 'number') setMyVotesRemaining(data.myVotesRemaining);
      if (typeof data.voteBudget === 'number') setVoteBudget(data.voteBudget);
    } catch {
      setVoteError(t('noVotesLeft'));
      setTimeout(() => setVoteError(null), 2500);
    }
  }, [initialSession.code, user.id, user.displayName, t]);

  // ── Typing indicator — debounced, ephemeral ────────────────────────────────
  const handleDraftChange = useCallback((columnKey: string, value: string) => {
    setDraft(d => ({ ...d, [columnKey]: value }));
    const socket = socketRef.current;
    if (!socket) return;
    socket.emit('retro:typing', { code: initialSession.code, column: columnKey, displayName: user.displayName, typing: true });
    if (typingTimeoutRef.current[columnKey]) clearTimeout(typingTimeoutRef.current[columnKey]);
    typingTimeoutRef.current[columnKey] = setTimeout(() => {
      socket.emit('retro:typing', { code: initialSession.code, column: columnKey, displayName: user.displayName, typing: false });
    }, 2000);
  }, [initialSession.code, user.displayName]);

  // ── AI Analyze ─────────────────────────────────────────────────────────────
  const handleAnalyze = useCallback(async () => {
    setAiLoading(true);
    setAiError(null);
    try {
      const res = await fetch(`${BACKEND}/api/retro/${initialSession.code}/analyze`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locale }),
      });
      if (!res.ok) {
        const body = await res.json() as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const result = await res.json() as AIAnalysisResult;
      setAiResult(result);
      setActions(result.actions);
      setAcceptedIds(new Set(result.actions.map(a => a.id)));
      setStatus('analyzing');
    } catch (err: unknown) {
      setAiError(err instanceof Error ? err.message : 'AI analysis failed');
    } finally {
      setAiLoading(false);
    }
  }, [initialSession.code, locale]);

  // ── Save Actions ───────────────────────────────────────────────────────────
  const handleSaveActions = useCallback(async () => {
    setSavingActions(true);
    try {
      const res = await fetch(`${BACKEND}/api/retro/${initialSession.code}/actions`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accepted_ids: Array.from(acceptedIds),
          new_actions: manualActions,
        }),
      });
      if (res.ok) {
        const data = await res.json() as { actions: RetroAction[] };
        setActions(data.actions);
        setStatus('closed');
        setManualActions([]);
        router.push(`/${locale}/dashboard`);
      }
    } finally {
      setSavingActions(false);
    }
  }, [initialSession.code, acceptedIds, manualActions, locale, router]);

  // ── Load History ───────────────────────────────────────────────────────────
  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch(`${BACKEND}/api/retro/${initialSession.code}/history`, {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json() as HistoryEntry[];
        setHistory(data);
      }
    } finally {
      setHistoryLoading(false);
    }
  }, [initialSession.code]);

  const toggleHistory = () => {
    if (!showHistory && history.length === 0) loadHistory();
    setShowHistory(h => !h);
  };

  // ── Theming classes ────────────────────────────────────────────────────────
  // Dark = chalkboard, Light = corkboard — a nod to the physical retro boards these replace.
  const boardBg = isDark
    ? 'bg-slate-900 text-white'
    : 'bg-[#f6efdf] text-gray-900';

  const boardTexture = isDark
    ? 'bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.05)_1px,transparent_0)] [background-size:24px_24px]'
    : 'bg-[radial-gradient(circle_at_1px_1px,rgba(120,83,45,0.14)_1px,transparent_0)] [background-size:24px_24px]';

  // Build card background maps dynamically from format columns
  const cardBgMap = useMemo(() => {
    const dark: Record<string, string> = {};
    const light: Record<string, string> = {};
    columns.forEach(c => { dark[c.key] = c.darkCardBg; light[c.key] = c.lightCardBg; });
    return { dark, light };
  }, [columns]);
  const cardBg = isDark ? cardBgMap.dark : cardBgMap.light;

  // Dynamic grid columns count
  const gridCols = columns.length <= 3 ? 'md:grid-cols-3'
    : columns.length === 4 ? 'md:grid-cols-4'
    : 'md:grid-cols-5';

  const timerColor = secondsLeft < 60 ? 'text-red-400' : isDark ? 'text-yellow-200' : 'text-yellow-700';

  // ── Main board ────────────────────────────────────────────────────────────
  return (
    <div className={`min-h-screen ${boardBg} ${boardTexture} transition-colors duration-500`}>
      {/* ── Header ── */}
      <header className={`sticky top-0 z-40 border-b backdrop-blur-md h-16 ${isDark ? 'bg-slate-950/80 border-slate-800/60' : 'bg-white/80 border-gray-200/60'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex items-center justify-between gap-4">
          {/* Left side */}
          <div className="flex items-center gap-3 min-w-0">
            <Link href={user.isGuest ? `/${locale}` : `/${locale}/dashboard`} className="flex items-center gap-2 hover:opacity-80 transition-opacity shrink-0">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isDark ? 'bg-indigo-600' : 'bg-cyan-600'}`}>
                <span className="text-white font-bold text-sm">SA</span>
              </div>
            </Link>
            <div className="min-w-0 hidden sm:block">
              <div className={`${kalam.className} text-base truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>{initialSession.title}</div>
              <div className={`text-xs font-mono uppercase tracking-wide
                ${status === 'writing' ? (isDark ? 'text-emerald-400' : 'text-emerald-600') :
                  status === 'analyzing' ? (isDark ? 'text-violet-400' : 'text-violet-600') :
                  (isDark ? 'text-slate-500' : 'text-gray-400')}`}>
                {t(`status_${status}`)}
              </div>
            </div>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-3 shrink-0">
            {/* Timer */}
            <div className={`hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-gray-100 border-gray-200'}`}>
              <span className={`text-sm font-mono font-bold ${timerColor}`}>{timerDisplay}</span>
              {initialSession.isModerator && status === 'writing' && (
                <button
                  onClick={() => setTimerRunning(r => !r)}
                  className={`text-xs transition-colors ${isDark ? 'text-slate-400 hover:text-slate-200' : 'text-gray-500 hover:text-gray-900'}`}
                >
                  {timerRunning ? '⏸' : '▶'}
                </button>
              )}
            </div>

            {/* Copy link */}
            <button
              onClick={handleCopyLink}
              title={t('copyLink')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-colors ${
                isDark
                  ? 'bg-slate-900 border-slate-800 hover:border-indigo-500/50 hover:bg-slate-800 text-slate-400 hover:text-indigo-300'
                  : 'bg-gray-100 border-gray-200 hover:border-cyan-400 hover:bg-gray-50 text-gray-500 hover:text-cyan-600'
              }`}
            >
              {copied ? (
                <svg className={`w-3.5 h-3.5 ${isDark ? 'text-emerald-400' : 'text-green-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
              )}
            </button>

            {/* Presence avatars — always visible, real-time */}
            {participants.length > 0 && (
              <div className="hidden sm:flex items-center -space-x-2">
                {participants.slice(0, 5).map((name, i) => (
                  <div
                    key={i}
                    title={name}
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold ring-2 ${
                      isDark ? 'bg-violet-700 text-white ring-slate-950' : 'bg-violet-200 text-violet-800 ring-white'
                    }`}
                  >
                    {name.charAt(0).toUpperCase()}
                  </div>
                ))}
                {participants.length > 5 && (
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold ring-2 ${
                    isDark ? 'bg-slate-700 text-slate-300 ring-slate-950' : 'bg-gray-200 text-gray-600 ring-white'
                  }`}>
                    +{participants.length - 5}
                  </div>
                )}
              </div>
            )}

            {/* Participants */}
            <button
              onClick={() => setShowParticipants(s => !s)}
              className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-colors ${
                showParticipants
                  ? isDark ? 'border-indigo-500 text-indigo-300 bg-indigo-900/30' : 'border-indigo-400 text-indigo-600 bg-indigo-50'
                  : isDark ? 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800' : 'bg-gray-100 border-gray-200 text-gray-500 hover:bg-gray-50'
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="text-xs">{participants.length}</span>
            </button>

            {/* History (moderator only) */}
            {initialSession.isModerator && (
              <button
                onClick={toggleHistory}
                className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-colors ${
                  showHistory
                    ? isDark ? 'border-violet-500 text-violet-300 bg-violet-900/30' : 'border-violet-400 text-violet-600 bg-violet-50'
                    : isDark ? 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800' : 'bg-gray-100 border-gray-200 text-gray-500 hover:bg-gray-50'
                }`}
              >
                <span className="text-xs">{t('trendBtn')}</span>
              </button>
            )}

            {/* User avatar + name */}
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${isDark ? 'bg-indigo-700 text-white' : 'bg-indigo-100 text-indigo-700'}`}>
              {user.displayName.charAt(0).toUpperCase()}
            </div>
            <span className={`hidden sm:block text-sm ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>{user.displayName}</span>

            {user.isGuest ? (
              <Link
                href={`/${locale}`}
                className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${isDark ? 'border-slate-600 text-slate-400 hover:text-white hover:border-slate-500' : 'border-gray-300 text-gray-500 hover:text-gray-900 hover:border-gray-400'}`}
              >
                {t('leaveSession')}
              </Link>
            ) : (
              <LogoutButton locale={locale} />
            )}

            {/* Theme toggle */}
            <button
              onClick={() => setTheme(th => th === 'dark' ? 'light' : 'dark')}
              className={`p-2 rounded-lg border transition-colors ${
                isDark
                  ? 'border-slate-700 bg-slate-800 text-slate-400 hover:text-indigo-300 hover:border-indigo-500/50'
                  : 'border-gray-200 bg-white text-gray-600 hover:text-cyan-600 hover:border-cyan-300'
              }`}
              title={isDark ? t('switchLight') : t('switchDark')}
            >
              {isDark ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* ── Participants panel ── */}
      {showParticipants && participants.length > 0 && (
        <div className="max-w-7xl mx-auto px-4 mt-3">
          <div className={`rounded-xl border p-3 flex flex-wrap gap-2 ${isDark ? 'bg-slate-800/60 border-slate-700' : 'bg-indigo-50 border-indigo-200'}`}>
            <span className={`text-xs font-semibold mr-1 ${isDark ? 'text-indigo-300' : 'text-indigo-700'}`}>{t('online')}</span>
            {participants.map((name, i) => (
              <span key={i} className={`text-xs px-2 py-0.5 rounded-full ${isDark ? 'bg-indigo-900/40 text-indigo-200' : 'bg-indigo-100 text-indigo-700'}`}>
                {name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Trend / History panel ── */}
      {showHistory && (
        <div className="max-w-7xl mx-auto px-4 mt-4">
          <div className={`rounded-xl border p-4 ${isDark ? 'bg-slate-800/60 border-slate-700' : 'bg-violet-50 border-violet-200'}`}>
            <h3 className={`text-sm font-semibold mb-3 ${isDark ? 'text-violet-300' : 'text-violet-700'}`}>{t('historyTitle')}</h3>
            {historyLoading ? (
              <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>{t('loading')}</p>
            ) : history.length === 0 ? (
              <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>{t('noHistory')}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className={isDark ? 'text-slate-400' : 'text-gray-500'}>
                      <th className="text-left pb-2 font-medium">{t('histTitle')}</th>
                      <th className="text-center pb-2 font-medium px-2">{t('histDate')}</th>
                      <th className="text-center pb-2 font-medium px-2 text-emerald-500">✓</th>
                      <th className="text-center pb-2 font-medium px-2 text-rose-500">△</th>
                      <th className="text-center pb-2 font-medium px-2 text-yellow-500">💡</th>
                      <th className="text-center pb-2 font-medium px-2">{t('histActions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map(h => (
                      <tr key={h.code} className={`border-t ${isDark ? 'border-slate-700' : 'border-gray-200'}`}>
                        <td className="py-1.5 pr-2 max-w-[150px] truncate">{h.title}</td>
                        <td className="py-1.5 px-2 text-center text-gray-500">{new Date(h.created_at).toLocaleDateString()}</td>
                        <td className="py-1.5 px-2 text-center text-emerald-500">{h.well_count}</td>
                        <td className="py-1.5 px-2 text-center text-rose-500">{h.improve_count}</td>
                        <td className="py-1.5 px-2 text-center text-yellow-500">{h.ideas_count}</td>
                        <td className="py-1.5 px-2 text-center">{h.actions_count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Board columns ── */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Dot-voting budget indicator */}
        <div className="flex items-center justify-between mb-5 flex-wrap gap-2">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${isDark ? 'bg-slate-800/60 border-slate-700' : 'bg-white/70 border-amber-200'}`}>
            <span className={`text-xs font-medium ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>{t('votesRemaining')}</span>
            <div className="flex items-center gap-1">
              {Array.from({ length: voteBudget }).map((_, i) => (
                <span
                  key={i}
                  className={`w-2.5 h-2.5 rounded-full ${
                    i < voteBudget - myVotesRemaining
                      ? (isDark ? 'bg-violet-400' : 'bg-violet-500')
                      : (isDark ? 'bg-slate-700' : 'bg-gray-300')
                  }`}
                />
              ))}
            </div>
            <span className={`text-xs font-mono font-bold ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>{myVotesRemaining}/{voteBudget}</span>
          </div>
          {voteError && (
            <span className="text-xs font-medium text-red-500 animate-toast-in">{voteError}</span>
          )}
        </div>

        <div className={`grid grid-cols-1 ${gridCols} gap-5`}>
          {columns.map(col => {
            const colItems = items.filter(i => i.category === col.key);
            const typers = (typingByColumn[col.key] ?? []).filter(name => name !== user.displayName);
            return (
              <div
                key={col.key}
                className={`flex flex-col gap-3 rounded-2xl p-4 min-h-[400px] ${isDark ? 'bg-slate-800/50 border border-slate-700/60' : 'bg-white/50 border border-amber-900/10'}`}
              >
                {/* Column header */}
                <div className="flex items-center justify-between mb-1">
                  <h2 className={`${kalam.className} text-lg ${isDark ? col.darkColor : col.lightColor} tracking-wide`}>
                    {t(col.labelKey)}
                  </h2>
                  <span className={`text-xs font-mono ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>
                    {colItems.length}
                  </span>
                </div>

                {/* Items */}
                <div className="flex flex-col gap-3 flex-1">
                  {colItems
                    .slice()
                    .sort((a, b) => b.votes - a.votes)
                    .map(item => {
                      const rotation = cardRotation(item.id);
                      const iVoted = myVotedItemIds.has(item.id);
                      return (
                        <div
                          key={item.id}
                          className="transition-transform duration-200 hover:-translate-y-0.5 hover:rotate-0"
                          style={{ transform: `rotate(${rotation}deg)` }}
                        >
                          <div
                            className={`group relative rounded-sm border p-3 pt-4 text-sm shadow-md break-words animate-pop-in ${cardBg[col.key]}`}
                          >
                            {/* Pin */}
                            <span className={`absolute -top-1.5 left-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full shadow-sm ${isDark ? 'bg-slate-400' : 'bg-rose-400'}`} />
                            <p className={`leading-snug ${isDark ? 'text-slate-100' : 'text-gray-800'}`}>
                              {item.content}
                            </p>
                            <div className="flex items-center justify-between mt-2.5">
                              <span className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-gray-500'}`}>{item.author_name}</span>
                              <div className="flex items-center gap-1.5">
                                <button
                                  onClick={() => handleDotVote(item)}
                                  disabled={!iVoted && myVotesRemaining <= 0}
                                  className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                                    iVoted
                                      ? isDark ? 'bg-violet-700/80 text-white ring-1 ring-violet-400' : 'bg-violet-500 text-white ring-1 ring-violet-600'
                                      : isDark ? 'bg-slate-700/60 text-slate-300 hover:bg-slate-700' : 'bg-amber-100/80 text-gray-600 hover:bg-amber-200/80'
                                  }`}
                                  title={t('dotVoteHint')}
                                >
                                  <span>🔴</span>
                                  {item.votes > 0 && <span className="font-mono font-bold">{item.votes}</span>}
                                </button>
                                {(item.author_id === user.id || initialSession.isModerator) && (
                                  <button
                                    onClick={() => handleDeleteItem(item)}
                                    className="text-xs opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 transition-opacity"
                                  >
                                    ✕
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>

                {/* Typing indicator */}
                {typers.length > 0 && (
                  <div className={`text-[11px] italic px-1 -mt-1 ${isDark ? 'text-slate-500' : 'text-gray-500'}`}>
                    {t('typingIndicator', { name: typers[0] })}
                  </div>
                )}

                {/* Add item form */}
                {status === 'writing' && (
                  <div className="mt-auto pt-2">
                    {addingTo === col.key ? (
                      <div className="flex flex-col gap-2">
                        <textarea
                          autoFocus
                          rows={2}
                          value={draft[col.key]}
                          onChange={e => handleDraftChange(col.key, e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAddItem(col.key); }
                            if (e.key === 'Escape') { setAddingTo(null); }
                          }}
                          placeholder={t('itemPlaceholder')}
                          className={`w-full rounded-lg p-2 text-sm resize-none border ${isDark
                            ? 'bg-slate-700 border-slate-600 text-white placeholder-slate-400 focus:border-indigo-500'
                            : 'bg-white border-gray-300 text-gray-800 placeholder-gray-400 focus:border-indigo-400'} focus:outline-none focus:ring-1 focus:ring-indigo-500`}
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleAddItem(col.key)}
                            disabled={submitting || !draft[col.key].trim()}
                            className={`flex-1 text-xs py-1.5 rounded-lg font-medium transition-colors disabled:opacity-40
                              ${isDark ? 'bg-indigo-600 hover:bg-indigo-500 text-white' : 'bg-indigo-500 hover:bg-indigo-400 text-white'}`}
                          >
                            {submitting ? t('adding') : t('addBtn')}
                          </button>
                          <button
                            onClick={() => setAddingTo(null)}
                            className={`px-3 text-xs rounded-lg border ${isDark ? 'border-slate-600 text-slate-400 hover:bg-slate-700' : 'border-gray-300 text-gray-500 hover:bg-gray-100'}`}
                          >
                            {t('cancel')}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setAddingTo(col.key)}
                        className={`w-full py-2 text-xs rounded-lg border-dashed border-2 transition-colors
                          ${isDark
                            ? 'border-slate-600 text-slate-500 hover:border-slate-400 hover:text-slate-300'
                            : 'border-gray-300 text-gray-400 hover:border-gray-500 hover:text-gray-600'}`}
                      >
                        + {t('addCard')}
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* ── Moderator controls ── */}
        {initialSession.isModerator && status === 'writing' && items.length > 0 && (
          <div className="mt-8 flex justify-center">
            <button
              onClick={handleAnalyze}
              disabled={aiLoading}
              className={`px-8 py-3 rounded-2xl font-semibold text-sm shadow-lg transition-all disabled:opacity-50
                ${isDark
                  ? 'bg-violet-600 hover:bg-violet-500 text-white shadow-violet-900/50'
                  : 'bg-violet-600 hover:bg-violet-500 text-white shadow-violet-200'}`}
            >
              {aiLoading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  {t('analyzing')}
                </span>
              ) : (
                <span>✨ {t('analyzeBtn')}</span>
              )}
            </button>
          </div>
        )}

        {aiError && (
          <div className="mt-4 text-center text-sm text-red-400">{aiError}</div>
        )}

        {/* ── AI Analysis panel ── */}
        {(aiResult || (status === 'analyzing' && actions.length > 0)) && (
          <div className={`mt-8 rounded-2xl border p-6 ${isDark ? 'bg-violet-900/20 border-violet-700/50' : 'bg-violet-50 border-violet-200'}`}>
            <h3 className={`text-base font-bold mb-4 flex items-center gap-2 ${isDark ? 'text-violet-300' : 'text-violet-700'}`}>
              <span>✨</span> {t('aiAnalysisTitle')}
            </h3>

            {aiResult?.summary && (
              <div className={`mb-4 text-sm leading-relaxed ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>
                <span className={`font-semibold ${isDark ? 'text-violet-300' : 'text-violet-600'}`}>{t('summary')}: </span>
                {aiResult.summary}
              </div>
            )}

            {aiResult?.trend_analysis && (
              <div className={`mb-5 text-sm leading-relaxed italic ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>
                <span className={`font-semibold not-italic ${isDark ? 'text-violet-400' : 'text-violet-500'}`}>{t('trend')}: </span>
                {aiResult.trend_analysis}
              </div>
            )}

            <h4 className={`text-sm font-semibold mb-3 ${isDark ? 'text-slate-200' : 'text-gray-800'}`}>{t('actionsTitle')}</h4>

            <div className="flex flex-col gap-2 mb-4">
              {actions.filter(a => a.ai_suggested).map(action => (
                <label
                  key={action.id}
                  className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer border transition-colors
                    ${acceptedIds.has(action.id)
                      ? isDark ? 'bg-violet-800/30 border-violet-600/50' : 'bg-violet-100 border-violet-400'
                      : isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-gray-200'}`}
                >
                  <input
                    type="checkbox"
                    checked={acceptedIds.has(action.id)}
                    onChange={e => {
                      setAcceptedIds(prev => {
                        const next = new Set(prev);
                        if (e.target.checked) { next.add(action.id); } else { next.delete(action.id); }
                        return next;
                      });
                    }}
                    className="mt-0.5 accent-violet-600"
                  />
                  <span className={`text-sm ${isDark ? 'text-slate-100' : 'text-gray-800'}`}>{action.content}</span>
                </label>
              ))}
            </div>

            {/* Manual actions */}
            <div className="mb-4">
              <p className={`text-xs font-semibold mb-2 ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>{t('addManualAction')}</p>
              {manualActions.map((ma, i) => (
                <div key={i} className={`flex items-center gap-2 mb-1 text-sm ${isDark ? 'text-slate-200' : 'text-gray-700'}`}>
                  <span className="flex-1">• {ma}</span>
                  <button
                    onClick={() => setManualActions(list => list.filter((_, j) => j !== i))}
                    className="text-red-400 text-xs hover:text-red-300"
                  >✕</button>
                </div>
              ))}
              <div className="flex gap-2 mt-1">
                <input
                  value={manualAction}
                  onChange={e => setManualAction(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && manualAction.trim()) {
                      setManualActions(l => [...l, manualAction.trim()]);
                      setManualAction('');
                    }
                  }}
                  placeholder={t('manualActionPlaceholder')}
                  className={`flex-1 rounded-lg px-3 py-1.5 text-sm border ${isDark
                    ? 'bg-slate-700 border-slate-600 text-white placeholder-slate-400'
                    : 'bg-white border-gray-300 text-gray-800 placeholder-gray-400'} focus:outline-none focus:ring-1 focus:ring-violet-500`}
                />
                <button
                  onClick={() => { if (manualAction.trim()) { setManualActions(l => [...l, manualAction.trim()]); setManualAction(''); } }}
                  className={`px-3 py-1.5 text-xs rounded-lg ${isDark ? 'bg-slate-700 hover:bg-slate-600 text-slate-200' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}
                >
                  {t('addBtn')}
                </button>
              </div>
            </div>

            {initialSession.isModerator && (
              <button
                onClick={handleSaveActions}
                disabled={savingActions || (acceptedIds.size === 0 && manualActions.length === 0)}
                className={`px-6 py-2.5 rounded-xl font-semibold text-sm transition-all disabled:opacity-40
                  ${isDark ? 'bg-emerald-600 hover:bg-emerald-500 text-white' : 'bg-emerald-600 hover:bg-emerald-500 text-white'}`}
              >
                {savingActions ? t('saving') : `✓ ${t('saveActionsBtn')}`}
              </button>
            )}
          </div>
        )}

        {/* ── Closed state: show final actions ── */}
        {status === 'closed' && actions.filter(a => a.is_accepted).length > 0 && !aiResult && (
          <div className={`mt-8 rounded-2xl border p-6 ${isDark ? 'bg-emerald-900/20 border-emerald-700/50' : 'bg-emerald-50 border-emerald-200'}`}>
            <h3 className={`text-base font-bold mb-4 ${isDark ? 'text-emerald-300' : 'text-emerald-700'}`}>
              ✅ {t('finalActionsTitle')}
            </h3>
            <ul className="flex flex-col gap-2">
              {actions.filter(a => a.is_accepted).map(a => (
                <li key={a.id} className={`text-sm flex items-start gap-2 ${isDark ? 'text-slate-200' : 'text-gray-800'}`}>
                  <span className={`mt-0.5 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>•</span>
                  {a.content}
                </li>
              ))}
            </ul>
          </div>
        )}
      </main>
    </div>
  );
}

export default RetroBoard;
