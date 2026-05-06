'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import AnalysisOutput from './AnalysisOutput';
import AnalysisMDOutput from './AnalysisMDOutput';
import PipelineStepsView, { type PipelineStep } from './PipelineStepsView';

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:4000';

interface Project {
  id: string;
  name: string;
  organization: string;
  hasPat?: boolean;
}

interface AdoRepo {
  id: string;
  name: string;
  defaultBranch: string | null;
  webUrl: string;
}

interface Session {
  id: string;
  title: string;
  project_id: string | null;
  selected_repos: string | null;
  created_at: string;
  updated_at: string;
}

interface Message {
  id: string;
  session_id: string;
  role: 'user' | 'assistant';
  content: string;
  attachments: string | null;
  created_at: string;
}

interface Props {
  projects: Project[];
  locale: string;
}

interface ActivePipeline {
  steps: PipelineStep[];
  completed: boolean;
}

/** Detect whether content is legacy HTML or Markdown. */
function isMarkdown(content: string): boolean {
  const trimmed = content.trimStart();
  if (trimmed.startsWith('<div') || trimmed.startsWith('<p') || trimmed.startsWith('<h')) return false;
  if (trimmed.includes('analysis-output') || trimmed.includes('analysis-section')) return false;
  return true;
}

/** Detect pipeline message from attachments JSON. */
function isPipelineMessage(msg: Message): boolean {
  if (!msg.attachments) return false;
  try {
    const a = JSON.parse(msg.attachments);
    return a.pipeline === true;
  } catch { return false; }
}

/** Parse pipeline steps from stored assistant message. */
function parsePipelineSteps(msg: Message): PipelineStep[] {
  try {
    const a = JSON.parse(msg.attachments!);
    return (a.steps ?? []).map((s: { step: number; title: string; output: string }) => ({
      step: s.step,
      title: s.title,
      status: 'done' as const,
      output: s.output,
    }));
  } catch { return []; }
}

const INITIAL_PIPELINE_STEPS: PipelineStep[] = [
  { step: 1, title: 'PDF Analizi', status: 'waiting' },
  { step: 2, title: 'Kod & DB Analizi', status: 'waiting' },
  { step: 3, title: 'Çıktı Üretimi', status: 'waiting' },
];

export default function AnalysisPageClient({ projects, locale }: Props) {
  const t = useTranslations('analysis');

  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const [inputText, setInputText] = useState<string>('');
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [repos, setRepos] = useState<AdoRepo[]>([]);
  const [selectedRepoIds, setSelectedRepoIds] = useState<string[]>([]);
  const [reposLoading, setReposLoading] = useState(false);
  const [repoDropdownOpen, setRepoDropdownOpen] = useState(false);
  const [repoSearch, setRepoSearch] = useState('');

  const [activePipeline, setActivePipeline] = useState<ActivePipeline | null>(null);
  const [pipelineLoading, setPipelineLoading] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const repoDropdownRef = useRef<HTMLDivElement>(null);

  const fetchSessions = useCallback(async () => {
    try {
      const res = await fetch(`${BACKEND}/api/analysis/sessions`, { credentials: 'include' });
      if (res.ok) setSessions(await res.json());
    } catch { /* ignore */ }
    setSessionsLoading(false);
  }, []);

  useEffect(() => { fetchSessions(); }, [fetchSessions]);

  useEffect(() => {
    if (!activeSessionId) { setMessages([]); return; }
    (async () => {
      try {
        const res = await fetch(`${BACKEND}/api/analysis/sessions/${activeSessionId}`, { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          setMessages(data.messages ?? []);
          if (data.project_id) setSelectedProjectId(data.project_id);
          if (data.selected_repos) {
            try { setSelectedRepoIds(JSON.parse(data.selected_repos)); } catch { /* ignore */ }
          }
        }
      } catch { /* ignore */ }
    })();
  }, [activeSessionId]);

  useEffect(() => {
    if (!selectedProjectId) { setRepos([]); setSelectedRepoIds([]); return; }
    (async () => {
      setReposLoading(true);
      try {
        const res = await fetch(`${BACKEND}/api/projects/${selectedProjectId}/repositories`, { credentials: 'include' });
        setRepos(res.ok ? await res.json() : []);
      } catch { setRepos([]); }
      setReposLoading(false);
    })();
  }, [selectedProjectId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, activePipeline]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (repoDropdownRef.current && !repoDropdownRef.current.contains(e.target as Node))
        setRepoDropdownOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 160) + 'px';
    }
  }, [inputText]);

  useEffect(() => {
    return () => { abortControllerRef.current?.abort(); };
  }, []);

  const createSession = async () => {
    try {
      const res = await fetch(`${BACKEND}/api/analysis/sessions`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: t('newChat') }),
      });
      if (res.ok) {
        const session = await res.json();
        setSessions(prev => [session, ...prev]);
        setActiveSessionId(session.id);
        setMessages([]);
        setActivePipeline(null);
        setPdfFile(null);
        setInputText('');
      }
    } catch { /* ignore */ }
  };

  const deleteSession = async (id: string) => {
    if (!confirm(t('deleteConfirm'))) return;
    try {
      await fetch(`${BACKEND}/api/analysis/sessions/${id}`, { method: 'DELETE', credentials: 'include' });
      setSessions(prev => prev.filter(s => s.id !== id));
      if (activeSessionId === id) { setActiveSessionId(null); setMessages([]); setActivePipeline(null); }
    } catch { /* ignore */ }
  };

  const saveRename = async (id: string) => {
    if (!editTitle.trim()) { setEditingSessionId(null); return; }
    try {
      const res = await fetch(`${BACKEND}/api/analysis/sessions/${id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: editTitle.trim() }),
      });
      if (res.ok) {
        const updated = await res.json();
        setSessions(prev => prev.map(s => s.id === id ? { ...s, title: updated.title } : s));
      }
    } catch { /* ignore */ }
    setEditingSessionId(null);
  };

  const handlePipelineSend = async () => {
    if ((!inputText.trim() && !pdfFile) || pipelineLoading) return;

    let sessionId = activeSessionId;
    if (!sessionId) {
      try {
        const res = await fetch(`${BACKEND}/api/analysis/sessions`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });
        if (res.ok) {
          const session = await res.json();
          setSessions(prev => [session, ...prev]);
          setActiveSessionId(session.id);
          sessionId = session.id;
        }
      } catch { return; }
    }
    if (!sessionId) return;

    const tempUserMsg: Message = {
      id: `temp-${Date.now()}`,
      session_id: sessionId,
      role: 'user',
      content: inputText.trim() || (pdfFile ? `[PDF: ${pdfFile.name}]` : ''),
      attachments: pdfFile ? JSON.stringify([{ name: pdfFile.name, type: pdfFile.type }]) : null,
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, tempUserMsg]);
    setActivePipeline({ steps: [...INITIAL_PIPELINE_STEPS], completed: false });
    setPipelineLoading(true);

    const capturedInput = inputText.trim();
    const capturedPdf = pdfFile;
    setInputText('');
    setPdfFile(null);

    const formData = new FormData();
    formData.append('message', capturedInput);
    formData.append('locale', locale);
    if (selectedProjectId) formData.append('projectId', selectedProjectId);
    if (selectedRepoIds.length > 0) formData.append('repoIds', JSON.stringify(selectedRepoIds));
    if (capturedPdf) formData.append('file', capturedPdf);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const response = await fetch(`${BACKEND}/api/analysis/sessions/${sessionId}/pipeline`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
        signal: abortController.signal,
      });

      if (!response.ok || !response.body) throw new Error('Pipeline request failed');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop() ?? '';

        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith('data: ')) continue;
          try {
            const event = JSON.parse(line.slice(6));

            if (event.type === 'step_start') {
              setActivePipeline(prev => prev ? {
                ...prev,
                steps: prev.steps.map(s => s.step === event.step ? { ...s, status: 'running' as const } : s),
              } : prev);
            }
            if (event.type === 'step_done') {
              setActivePipeline(prev => prev ? {
                ...prev,
                steps: prev.steps.map(s => s.step === event.step ? { ...s, status: 'done' as const, output: event.output } : s),
              } : prev);
            }
            if (event.type === 'error') {
              setActivePipeline(prev => prev ? {
                ...prev,
                steps: prev.steps.map(s => s.step === event.step ? { ...s, status: 'error' as const, errorMessage: event.message } : s),
              } : prev);
            }
            if (event.type === 'complete') {
              setActivePipeline(prev => prev ? { ...prev, completed: true } : prev);
            }
            if (event.type === 'saved') {
              const msgsRes = await fetch(`${BACKEND}/api/analysis/sessions/${sessionId}`, { credentials: 'include' });
              if (msgsRes.ok) {
                const data = await msgsRes.json();
                setMessages(data.messages ?? []);
                setSessions(prev => prev.map(s =>
                  s.id === sessionId ? { ...s, title: data.title || s.title, updated_at: new Date().toISOString() } : s,
                ));
              }
              setActivePipeline(null);
            }
          } catch { /* ignore parse error */ }
        }
      }
    } catch (err: unknown) {
      if ((err as Error)?.name !== 'AbortError') {
        setActivePipeline(prev => prev ? {
          ...prev,
          steps: prev.steps.map(s =>
            s.status === 'running' || s.status === 'waiting'
              ? { ...s, status: 'error' as const, errorMessage: 'Baglanti hatasi' }
              : s,
          ),
        } : null);
      }
    } finally {
      setPipelineLoading(false);
      abortControllerRef.current = null;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (!pipelineLoading && (inputText.trim() || pdfFile)) handlePipelineSend(); }
  };

  const toggleRepo = (repoId: string) => {
    setSelectedRepoIds(prev => prev.includes(repoId) ? prev.filter(id => id !== repoId) : [...prev, repoId]);
  };

  const parseAttachments = (attachments: string | null): Array<{ name: string; type: string }> => {
    if (!attachments) return [];
    try { return JSON.parse(attachments); } catch { return []; }
  };

  const copyContent = async (content: string, msgId: string) => {
    const text = isMarkdown(content) ? content : content.replace(/<[^>]+>/g, ' ').replace(/\s{2,}/g, ' ').trim();
    await navigator.clipboard.writeText(text);
    setCopiedId(msgId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredRepos = repos.filter(r => r.name.toLowerCase().includes(repoSearch.toLowerCase()));

  return (
    <div className="flex h-full bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950">
      {sidebarOpen && (
        <aside className="w-72 border-r border-white/[0.06] flex flex-col bg-slate-950/60 flex-shrink-0">
          <div className="p-3 border-b border-white/[0.06] flex items-center gap-2">
            <button onClick={() => setSidebarOpen(false)} className="w-9 h-9 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center text-slate-500 hover:text-slate-300 hover:bg-white/[0.06] transition-all flex-shrink-0" title="Kenar cubuğunu daralt">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" /></svg>
            </button>
            <button onClick={createSession} className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded-xl transition-all shadow-lg shadow-violet-500/20 hover:shadow-violet-500/30">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              {t('newChat')}
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
            {sessionsLoading ? (
              <div className="flex items-center justify-center py-12"><div className="w-5 h-5 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" /></div>
            ) : sessions.length === 0 ? (
              <div className="text-center py-12 px-4"><p className="text-xs text-slate-600">{t('noSessions')}</p></div>
            ) : sessions.map(session => (
              <div key={session.id} className={`group flex items-center gap-2 px-3 py-2.5 rounded-xl cursor-pointer transition-all ${activeSessionId === session.id ? 'bg-violet-500/15 text-violet-300 ring-1 ring-violet-500/20' : 'hover:bg-white/[0.04] text-slate-400 hover:text-slate-300'}`} onClick={() => { setActiveSessionId(session.id); setActivePipeline(null); }}>
                <svg className="w-4 h-4 flex-shrink-0 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
                {editingSessionId === session.id ? (
                  <input className="flex-1 text-sm bg-slate-800 border border-slate-600 rounded-lg px-2 py-0.5 text-white focus:outline-none focus:border-violet-500" value={editTitle} onChange={e => setEditTitle(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') saveRename(session.id); if (e.key === 'Escape') setEditingSessionId(null); }} onBlur={() => saveRename(session.id)} autoFocus onClick={e => e.stopPropagation()} />
                ) : (
                  <span className="flex-1 text-sm truncate">{session.title}</span>
                )}
                <div className="hidden group-hover:flex items-center gap-0.5 flex-shrink-0">
                  <button onClick={e => { e.stopPropagation(); setEditingSessionId(session.id); setEditTitle(session.title); }} className="p-1 rounded-lg hover:bg-white/10 text-slate-500 hover:text-slate-300 transition-colors" title={t('renameChat')}>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                  </button>
                  <button onClick={e => { e.stopPropagation(); deleteSession(session.id); }} className="p-1 rounded-lg hover:bg-red-500/20 text-slate-500 hover:text-red-400 transition-colors" title={t('deleteChat')}>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </aside>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center gap-4 px-5 py-2.5 border-b border-white/[0.06] bg-slate-950/40 backdrop-blur-sm flex-shrink-0 flex-wrap">
          {!sidebarOpen && (
            <button onClick={() => setSidebarOpen(true)} className="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center text-slate-500 hover:text-slate-300 transition-all flex-shrink-0">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 5l7 7-7 7M5 5l7 7-7 7" /></svg>
            </button>
          )}
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-indigo-500/10 flex items-center justify-center flex-shrink-0">
              <svg className="w-3.5 h-3.5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
            </div>
            <select value={selectedProjectId} onChange={e => { setSelectedProjectId(e.target.value); setSelectedRepoIds([]); setRepoSearch(''); }} className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-1.5 text-sm text-slate-300 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20 max-w-[220px] transition-all">
              <option value="" className="bg-slate-900">{t('selectProject')}</option>
              {projects.filter(p => p.hasPat).map(p => (
                <option key={p.id} value={p.id} className="bg-slate-900">{p.name}</option>
              ))}
            </select>
          </div>
          {selectedProjectId && (
            <div className="relative flex items-center gap-2" ref={repoDropdownRef}>
              <div className="w-6 h-6 rounded-md bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>
              </div>
              <button onClick={() => setRepoDropdownOpen(!repoDropdownOpen)} className="flex items-center gap-2 bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-1.5 text-sm text-slate-300 hover:border-violet-500/30 transition-all min-w-[180px] max-w-[320px]">
                {reposLoading ? (
                  <span className="flex items-center gap-1.5"><div className="w-3 h-3 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" /><span className="text-slate-500 text-xs">{t('repoLoading')}</span></span>
                ) : selectedRepoIds.length > 0 ? (
                  <span className="flex items-center gap-1.5 truncate"><span className="inline-flex items-center justify-center w-5 h-5 rounded-md bg-violet-500/20 text-violet-300 text-xs font-bold">{selectedRepoIds.length}</span><span className="truncate text-xs">{t('selectRepos').toLowerCase()}</span></span>
                ) : (
                  <span className="text-slate-500 text-xs">{t('searchRepos')}</span>
                )}
                <svg className={`w-3.5 h-3.5 flex-shrink-0 ml-auto transition-transform ${repoDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </button>
              {repoDropdownOpen && !reposLoading && (
                <div className="absolute top-full left-0 mt-1.5 z-50 w-96 bg-slate-900 border border-white/[0.1] rounded-xl shadow-2xl shadow-black/40 overflow-hidden">
                  <div className="p-2 border-b border-white/[0.06]">
                    <div className="relative">
                      <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                      <input type="text" value={repoSearch} onChange={e => setRepoSearch(e.target.value)} placeholder={t('searchRepos')} className="w-full bg-white/[0.04] border border-white/[0.06] rounded-lg pl-8 pr-3 py-1.5 text-sm text-slate-300 placeholder-slate-600 focus:outline-none focus:border-violet-500/30" autoFocus />
                    </div>
                  </div>
                  <div className="max-h-72 overflow-y-auto">
                    {filteredRepos.length === 0 ? (
                      <div className="p-4 text-sm text-slate-600 text-center">{t('noRepos')}</div>
                    ) : filteredRepos.map(repo => (
                      <label key={repo.id} className="flex items-center gap-3 px-3 py-2 hover:bg-white/[0.04] cursor-pointer transition-colors">
                        <input type="checkbox" checked={selectedRepoIds.includes(repo.id)} onChange={() => toggleRepo(repo.id)} className="w-4 h-4 rounded border-slate-600 text-violet-500 focus:ring-violet-500/30 bg-transparent" />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-slate-300 truncate">{repo.name}</div>
                          {repo.defaultBranch && <div className="text-[11px] text-slate-600">{repo.defaultBranch.replace('refs/heads/', '')}</div>}
                        </div>
                      </label>
                    ))}
                  </div>
                  {selectedRepoIds.length > 0 && (
                    <div className="px-3 py-2 border-t border-white/[0.06] flex items-center justify-between">
                      <span className="text-xs text-slate-500">{selectedRepoIds.length} secili</span>
                      <button onClick={() => setSelectedRepoIds([])} className="text-xs text-red-400 hover:text-red-300 transition-colors">Temizle</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          {selectedRepoIds.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap max-w-[400px]">
              {selectedRepoIds.slice(0, 3).map(id => {
                const repo = repos.find(r => r.id === id);
                return (
                  <span key={id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-violet-500/10 text-violet-300 text-xs border border-violet-500/20">
                    {repo?.name ?? id.slice(0, 8)}
                    <button onClick={() => toggleRepo(id)} className="hover:text-red-400 transition-colors"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
                  </span>
                );
              })}
              {selectedRepoIds.length > 3 && <span className="text-xs text-slate-500">+{selectedRepoIds.length - 3}</span>}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          {messages.length === 0 && !activePipeline ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-8">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-500/20 to-indigo-500/20 flex items-center justify-center mb-6 ring-1 ring-violet-500/10">
                <svg className="w-10 h-10 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" /></svg>
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">{t('pageTitle')}</h3>
              <p className="text-sm text-slate-500 max-w-lg leading-relaxed">{t('noSessionsDesc')}</p>
              <div className="mt-6 flex items-center gap-3 text-xs text-slate-600 flex-wrap justify-center">
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/[0.03] border border-white/[0.06]">📄 PDF Belgesi</span>
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/[0.03] border border-white/[0.06]">🗄️ Repo Context</span>
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/[0.03] border border-white/[0.06]">⚡ 3 Adımlı YZ Analizi</span>
              </div>
            </div>
          ) : (
            <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
              {messages.map(msg => (
                <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[90%] ${msg.role === 'user' ? '' : 'w-full'}`}>
                    {msg.role === 'user' ? (
                      <div className="bg-violet-600/90 backdrop-blur-sm text-white rounded-2xl rounded-br-md px-5 py-3 shadow-lg shadow-violet-500/10">
                        <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                        {parseAttachments(msg.attachments).map((att, i) => (
                          <div key={i} className="mt-2.5 flex items-center gap-2 bg-white/10 rounded-lg px-3 py-1.5">
                            <svg className="w-4 h-4 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                            <span className="text-xs opacity-80">{att.name}</span>
                          </div>
                        ))}
                        <div className="text-[10px] mt-1 text-right text-white/50">{new Date(msg.created_at).toLocaleTimeString()}</div>
                      </div>
                    ) : isPipelineMessage(msg) ? (
                      <div className="bg-white/[0.03] backdrop-blur-sm rounded-2xl rounded-bl-md border border-white/[0.06] overflow-hidden">
                        <div className="px-5 py-4">
                          <PipelineStepsView steps={parsePipelineSteps(msg)} completed filename={`analysis-${msg.created_at.slice(0, 10)}`} />
                        </div>
                        <div className="px-5 py-2 border-t border-white/[0.04] flex items-center justify-between">
                          <span className="text-[10px] text-slate-600">{new Date(msg.created_at).toLocaleTimeString()}</span>
                          <button onClick={() => copyContent(msg.content, msg.id)} className="flex items-center gap-1 text-xs text-slate-500 hover:text-violet-400 transition-colors">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                            {copiedId === msg.id ? t('copied') : t('copyOutput')}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-white/[0.03] backdrop-blur-sm rounded-2xl rounded-bl-md border border-white/[0.06] overflow-hidden">
                        <div className="px-5 py-4">
                          {isMarkdown(msg.content) ? (
                            <AnalysisMDOutput markdown={msg.content} filename={`analysis-${msg.created_at.slice(0, 10)}`} />
                          ) : (
                            <AnalysisOutput html={msg.content} />
                          )}
                        </div>
                        <div className="px-5 py-2 border-t border-white/[0.04] flex items-center justify-between">
                          <span className="text-[10px] text-slate-600">{new Date(msg.created_at).toLocaleTimeString()}</span>
                          <button onClick={() => copyContent(msg.content, msg.id)} className="flex items-center gap-1 text-xs text-slate-500 hover:text-violet-400 transition-colors">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                            {copiedId === msg.id ? t('copied') : t('copyOutput')}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {activePipeline && (
                <div className="flex justify-start">
                  <div className="w-full bg-white/[0.03] backdrop-blur-sm rounded-2xl rounded-bl-md border border-white/[0.06] overflow-hidden">
                    <div className="px-5 py-4">
                      <PipelineStepsView steps={activePipeline.steps} completed={activePipeline.completed} />
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        <div className="border-t border-white/[0.06] bg-slate-950/60 backdrop-blur-xl p-4 flex-shrink-0">
          <div className="max-w-4xl mx-auto">
            {pdfFile && (
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <div className="flex items-center gap-2 bg-violet-500/10 border border-violet-500/20 text-violet-300 rounded-lg px-3 py-1.5 text-xs font-medium">
                  <span>📄</span><span>{pdfFile.name}</span>
                  <button onClick={() => setPdfFile(null)} className="ml-1 hover:text-red-400 transition-colors"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
                </div>
              </div>
            )}
            <div className="flex items-end gap-2">
              <button onClick={() => pdfInputRef.current?.click()} className={`flex-shrink-0 w-10 h-10 rounded-xl border flex items-center justify-center transition-all ${pdfFile ? 'bg-violet-500/10 border-violet-500/30 text-violet-400' : 'bg-white/[0.04] border-white/[0.08] text-slate-400 hover:text-violet-400 hover:border-violet-500/30 hover:bg-violet-500/5'}`} title="PDF belgesi ekle (Adım 1)">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
              </button>
              <input ref={pdfInputRef} type="file" accept=".pdf,.txt,.md,.csv" className="hidden" onChange={e => { const file = e.target.files?.[0]; if (file) { if (file.size > 10 * 1024 * 1024) { alert(t('fileTooLarge')); return; } setPdfFile(file); } e.target.value = ''; }} />

              <div className="flex-1">
                <textarea ref={textareaRef} value={inputText} onChange={e => setInputText(e.target.value)} onKeyDown={handleKeyDown} placeholder={t('typePlaceholder')} rows={1} className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-violet-500/40 focus:ring-1 focus:ring-violet-500/20 resize-none transition-all" disabled={pipelineLoading} />
              </div>

              <button onClick={handlePipelineSend} disabled={(!inputText.trim() && !pdfFile) || pipelineLoading} className="flex-shrink-0 w-10 h-10 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:bg-white/[0.04] disabled:border disabled:border-white/[0.08] text-white disabled:text-slate-600 transition-all shadow-lg shadow-violet-500/20 hover:shadow-violet-500/30 disabled:shadow-none flex items-center justify-center" title={t('sendMessage')}>
                {pipelineLoading ? (
                  <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                )}
              </button>
            </div>
            <div className="flex items-center gap-3 mt-2 text-[11px] text-slate-600 flex-wrap">
              <span>📄 PDF gereksinim belgesi (Adım 1)</span>
              <span className="text-slate-700">·</span>
              <span>🗄️ Repo context (Adım 2)</span>
              <span className="text-slate-700">·</span>
              <span>⚡ 3 Adımlı YZ Analizi</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
