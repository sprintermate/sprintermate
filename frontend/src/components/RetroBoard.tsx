'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useTranslations } from 'next-intl';
import Link from 'next/link';

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? '';

// ─── Types ───────────────────────────────────────────────────────────────────

export type RetroCategory = 'well' | 'improve' | 'ideas';

export interface RetroItem {
  id: string;
  session_code: string;
  category: RetroCategory;
  content: string;
  author_id: string;
  author_name: string;
  votes: number;
  created_at: string;
}

export interface RetroAction {
  id: string;
  session_code: string;
  content: string;
  ai_suggested: boolean;
  is_accepted: boolean;
  created_at: string;
}

export interface RetroSession {
  id: string;
  code: string;
  title: string;
  created_by: string;
  theme: string;
  status: string;
  duration_minutes: number;
  created_at: string;
  isModerator: boolean;
  items: RetroItem[];
  actions: RetroAction[];
}

interface User {
  id: string;
  displayName: string;
  email: string;
}

interface AIAnalysisResult {
  summary: string;
  trend_analysis: string;
  actions: RetroAction[];
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

interface Props {
  session: RetroSession;
  user: User;
  locale: string;
}

// ─── Column config ────────────────────────────────────────────────────────────

const COLUMNS: { key: RetroCategory; labelKey: string; chalkColor: string; markerColor: string }[] = [
  { key: 'well', labelKey: 'columnWell', chalkColor: 'text-emerald-300', markerColor: 'text-emerald-600' },
  { key: 'improve', labelKey: 'columnImprove', chalkColor: 'text-rose-300', markerColor: 'text-rose-600' },
  { key: 'ideas', labelKey: 'columnIdeas', chalkColor: 'text-yellow-300', markerColor: 'text-amber-600' },
];

// ─── Post-it card colours per column ─────────────────────────────────────────
const POSTIT_DARK = { well: 'bg-emerald-900/70 border-emerald-600/50', improve: 'bg-rose-900/70 border-rose-600/50', ideas: 'bg-yellow-900/70 border-yellow-600/50' };
const POSTIT_LIGHT = { well: 'bg-emerald-100 border-emerald-400', improve: 'bg-rose-100 border-rose-400', ideas: 'bg-amber-100 border-amber-400' };

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

export default function RetroBoard({ session: initialSession, user, locale }: Props) {
  const t = useTranslations('retro');
  const socketRef = useRef<Socket | null>(null);

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

  // Input state per column
  const [draft, setDraft] = useState<Record<RetroCategory, string>>({ well: '', improve: '', ideas: '' });
  const [addingTo, setAddingTo] = useState<RetroCategory | null>(null);
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

  // Per-session reaction tracking: 'up' = 👍, 'down' = 👎
  const [votedItems, setVotedItems] = useState<Map<string, 'up' | 'down'>>(new Map());

  const isDark = theme === 'dark';

  // ── Socket.IO ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const socket = io(BACKEND, { withCredentials: true, transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('retro:join', { code: initialSession.code, displayName: user.displayName });
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

    return () => {
      socket.emit('retro:leave', { code: initialSession.code });
      socket.disconnect();
    };
  }, [initialSession.code]);

  // ── Add item ───────────────────────────────────────────────────────────────
  const handleAddItem = useCallback(async (category: RetroCategory) => {
    const content = draft[category].trim();
    if (!content) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${BACKEND}/api/retro/${initialSession.code}/items`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category, content }),
      });
      if (res.ok) {
        setDraft(d => ({ ...d, [category]: '' }));
        setAddingTo(null);
      }
    } finally {
      setSubmitting(false);
    }
  }, [draft, initialSession.code]);

  // ── Delete item ────────────────────────────────────────────────────────────
  const handleDeleteItem = useCallback(async (item: RetroItem) => {
    await fetch(`${BACKEND}/api/retro/${initialSession.code}/items/${item.id}`, {
      method: 'DELETE',
      credentials: 'include',
    });
  }, [initialSession.code]);

  // ── Vote ───────────────────────────────────────────────────────────────────
  const handleVote = useCallback(async (item: RetroItem, delta: number) => {
    await fetch(`${BACKEND}/api/retro/${initialSession.code}/items/${item.id}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vote: delta }),
    });
  }, [initialSession.code]);

  // ── 👍 / 👎 reaction — one reaction per item, switch or remove ────────────
  const handleReactionVote = useCallback(async (item: RetroItem, reaction: 'up' | 'down') => {
    const prev = votedItems.get(item.id);
    let delta: number;
    if (!prev) {
      delta = reaction === 'up' ? 1 : -1;
      setVotedItems(m => new Map(m).set(item.id, reaction));
    } else if (prev === reaction) {
      // Same button again → remove vote
      delta = reaction === 'up' ? -1 : 1;
      setVotedItems(m => { const next = new Map(m); next.delete(item.id); return next; });
    } else {
      // Switch direction
      delta = reaction === 'up' ? 2 : -2;
      setVotedItems(m => new Map(m).set(item.id, reaction));
    }
    await handleVote(item, delta);
  }, [votedItems, handleVote]);
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
      }
    } finally {
      setSavingActions(false);
    }
  }, [initialSession.code, acceptedIds, manualActions]);

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
  const boardBg = isDark
    ? 'bg-slate-900 text-white'
    : 'bg-white text-gray-900';

  const boardTexture = isDark
    ? 'bg-[radial-gradient(ellipse_at_top_left,_rgba(30,80,40,0.25)_0%,_transparent_60%)] bg-[length:1px_1px]'
    : 'bg-[radial-gradient(ellipse_at_top_right,_rgba(230,230,230,0.5)_0%,_transparent_60%)]';

  const fontClass = isDark ? 'font-chalk' : 'font-marker';

  const cardBg = isDark ? POSTIT_DARK : POSTIT_LIGHT;

  const timerColor = secondsLeft < 60 ? 'text-red-400' : isDark ? 'text-yellow-200' : 'text-yellow-700';

  return (
    <div className={`min-h-screen ${boardBg} ${boardTexture} transition-colors duration-500`}>
      {/* ── Top bar ── */}
      <header className={`sticky top-0 z-30 ${isDark ? 'bg-slate-900/90 border-slate-700' : 'bg-white/90 border-gray-200'} border-b backdrop-blur-sm`}>
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            {/* Back to dashboard */}
            <Link
              href={`/${locale}/dashboard`}
              className={`text-xs px-2 py-1 rounded border ${isDark ? 'border-slate-600 text-slate-400 hover:bg-slate-800' : 'border-gray-300 text-gray-500 hover:bg-gray-50'}`}
              title={t('backToDashboard')}
            >
              ←
            </Link>
            <span className={`text-lg ${fontClass} truncate font-semibold`}>{initialSession.title}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-mono uppercase tracking-wide
              ${status === 'writing' ? (isDark ? 'bg-emerald-800 text-emerald-200' : 'bg-emerald-100 text-emerald-700') :
                status === 'analyzing' ? (isDark ? 'bg-violet-800 text-violet-200' : 'bg-violet-100 text-violet-700') :
                (isDark ? 'bg-slate-700 text-slate-300' : 'bg-gray-100 text-gray-600')}`}>
              {t(`status_${status}`)}
            </span>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {/* Timer */}
            <div className={`font-mono text-xl font-bold tabular-nums ${timerColor}`}>{timerDisplay}</div>
            {initialSession.isModerator && (
              <button
                onClick={() => setTimerRunning(r => !r)}
                className={`text-xs px-2 py-1 rounded border ${isDark ? 'border-slate-600 text-slate-300 hover:bg-slate-800' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}
              >
                {timerRunning ? t('timerPause') : t('timerStart')}
              </button>
            )}

            {/* Copy join link */}
            <button
              onClick={handleCopyLink}
              className={`text-xs px-2 py-1 rounded border ${isDark ? 'border-slate-600 text-slate-300 hover:bg-slate-800' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}
              title={t('copyLink')}
            >
              {copied ? t('copied') : '🔗'}
            </button>

            {/* Participants toggle */}
            <button
              onClick={() => setShowParticipants(p => !p)}
              className={`text-xs px-2 py-1 rounded border ${showParticipants
                ? isDark ? 'border-indigo-500 text-indigo-300 bg-indigo-900/30' : 'border-indigo-400 text-indigo-600 bg-indigo-50'
                : isDark ? 'border-slate-600 text-slate-300 hover:bg-slate-800' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}
            >
              👥 {participants.length}
            </button>

            {/* Theme toggle */}
            <button
              onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
              className={`text-xs px-2 py-1 rounded border ${isDark ? 'border-slate-600 text-slate-300 hover:bg-slate-800' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}
              title={isDark ? t('switchLight') : t('switchDark')}
            >
              {isDark ? '☀️' : '🌑'}
            </button>

            {/* History toggle */}
            {initialSession.isModerator && (
              <button
                onClick={toggleHistory}
                className={`text-xs px-2 py-1 rounded border ${isDark ? 'border-violet-600 text-violet-300 hover:bg-violet-900/30' : 'border-violet-400 text-violet-600 hover:bg-violet-50'}`}
              >
                {t('trendBtn')}
              </button>
            )}
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
        <div className={`max-w-7xl mx-auto px-4 mt-4`}>
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {COLUMNS.map(col => {
            const colItems = items.filter(i => i.category === col.key);
            return (
              <div
                key={col.key}
                className={`flex flex-col gap-3 rounded-2xl p-4 min-h-[400px] ${isDark ? 'bg-slate-800/50 border border-slate-700/60' : 'bg-gray-50 border border-gray-200'}`}
              >
                {/* Column header */}
                <div className="flex items-center justify-between mb-1">
                  <h2 className={`text-base font-bold ${isDark ? col.chalkColor : col.markerColor} ${fontClass} tracking-wide`}>
                    {t(col.labelKey)}
                  </h2>
                  <span className={`text-xs font-mono ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>
                    {colItems.length}
                  </span>
                </div>

                {/* Items */}
                <div className="flex flex-col gap-2 flex-1">
                  {colItems
                    .slice()
                    .sort((a, b) => b.votes - a.votes)
                    .map(item => (
                      <div
                        key={item.id}
                        className={`group relative rounded-lg border p-3 text-sm shadow-sm break-words
                          ${cardBg[col.key]}`}
                      >
                        <p className={`${fontClass} leading-snug ${isDark ? 'text-slate-100' : 'text-gray-800'}`}>
                          {item.content}
                        </p>
                        <div className="flex items-center justify-end mt-2">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleReactionVote(item, 'up')}
                              className={`text-sm px-1.5 py-0.5 rounded transition-all ${
                                votedItems.get(item.id) === 'up'
                                  ? isDark ? 'bg-emerald-700/80 text-white ring-1 ring-emerald-400' : 'bg-emerald-500 text-white ring-1 ring-emerald-600'
                                  : isDark ? 'text-slate-400 hover:text-slate-200' : 'text-gray-400 hover:text-gray-700'
                              }`}
                              title="Katılıyorum"
                            >
                              👍
                            </button>
                            {item.votes > 0 && (
                              <span className={`text-xs font-mono min-w-[1rem] text-center ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
                                {item.votes}
                              </span>
                            )}
                            <button
                              onClick={() => handleReactionVote(item, 'down')}
                              className={`text-sm px-1.5 py-0.5 rounded transition-all ${
                                votedItems.get(item.id) === 'down'
                                  ? isDark ? 'bg-red-700/80 text-white ring-1 ring-red-400' : 'bg-red-500 text-white ring-1 ring-red-600'
                                  : isDark ? 'text-slate-400 hover:text-slate-200' : 'text-gray-400 hover:text-gray-700'
                              }`}
                              title="Katılmıyorum"
                            >
                              👎
                            </button>
                            {(item.author_id === user.id || initialSession.isModerator) && (
                              <button
                                onClick={() => handleDeleteItem(item)}
                                className="text-xs ml-1 opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 transition-opacity"
                              >
                                ✕
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                </div>

                {/* Add item form */}
                {status === 'writing' && (
                  <div className="mt-auto pt-2">
                    {addingTo === col.key ? (
                      <div className="flex flex-col gap-2">
                        <textarea
                          autoFocus
                          rows={2}
                          value={draft[col.key]}
                          onChange={e => setDraft(d => ({ ...d, [col.key]: e.target.value }))}
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
        {status === 'closed' && actions.filter(a => a.is_accepted).length > 0 && !(aiResult) && (
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
