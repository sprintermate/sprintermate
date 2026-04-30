'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { io, Socket } from 'socket.io-client';
import ReactMarkdown from 'react-markdown';

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? '';

// ─── Types ──────────────────────────────────────────────────────────────────

interface AnalysisDoc {
  id: string;
  title: string;
  pdf_filename: string;
  pdf_text?: string;
  user_message: string | null;
  azure_repos: string | null;
  md_context?: string | null;
  md_filenames?: string | null;
  md_output: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

interface AnalysisSummary {
  id: string;
  title: string;
  pdf_filename: string;
  status: string;
  md_filenames?: string | null;
  created_at: string;
}

interface Project {
  id: string;
  name: string;
  organization: string;
  hasPat: boolean;
}

interface Repo {
  id: string;
  name: string;
}

interface MdFileEntry {
  docId: string;
  docTitle: string;
  filename: string;
  content: string;
}

type StepStatus = 'active' | 'done' | 'error';

interface ProgressStep {
  key: string;
  status: StepStatus;
  message: string;
}

interface ChatMessage {
  type: 'user' | 'progress' | 'ai-response' | 'error';
  // user bubble
  title?: string;
  pdfName?: string;
  repos?: string[];
  mdFiles?: string[];
  userMessage?: string;
  // progress
  steps?: ProgressStep[];
  // ai response
  mdOutput?: string;
  // error
  errorMessage?: string;
}

// ─── Component ──────────────────────────────────────────────────────────────

interface Props {
  locale: string;
  userId: string;
  initialDoc?: AnalysisDoc | null;
}

export default function AnalysisChatClient({ locale, userId, initialDoc }: Props) {
  const t = useTranslations('analysis');
  const router = useRouter();

  // ── History sidebar ──
  const [history, setHistory] = useState<AnalysisSummary[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);

  // ── Current analysis state ──
  const [currentDoc, setCurrentDoc] = useState<AnalysisDoc | null>(initialDoc ?? null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  // ── Composer state ──
  const [title, setTitle] = useState('');
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [userMessage, setUserMessage] = useState('');
  const [mdFiles, setMdFiles] = useState<File[]>([]);
  const [selectedPreviousMdFiles, setSelectedPreviousMdFiles] = useState<MdFileEntry[]>([]);
  const [previousMdFiles, setPreviousMdFiles] = useState<MdFileEntry[]>([]);

  // ── Repo selector state ──
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [repos, setRepos] = useState<Repo[]>([]);
  const [selectedRepos, setSelectedRepos] = useState<string[]>([]);
  const [repoSearch, setRepoSearch] = useState('');
  const [reposLoading, setReposLoading] = useState(false);

  // ── UI state ──
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [composerExpanded, setComposerExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [mdPickerOpen, setMdPickerOpen] = useState(false);
  const [mdPickerSearch, setMdPickerSearch] = useState('');

  // ── Refs ──
  const chatEndRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const mdInputRef = useRef<HTMLInputElement>(null);

  // ── Scroll to bottom ──
  const scrollToBottom = useCallback(() => {
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  }, []);

  // ── Load history ──
  useEffect(() => {
    fetch(`${BACKEND}/api/analysis`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : [])
      .then((data: AnalysisSummary[]) => setHistory(data))
      .catch(() => {});
  }, []);

  // ── Load projects ──
  useEffect(() => {
    fetch(`${BACKEND}/api/projects`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : [])
      .then((data: Project[]) => setProjects(data.filter(p => p.hasPat)))
      .catch(() => {});
  }, []);

  // ── Load previous MD files ──
  useEffect(() => {
    fetch(`${BACKEND}/api/analysis/md-files`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : [])
      .then((data: MdFileEntry[]) => setPreviousMdFiles(data))
      .catch(() => {});
  }, []);

  // ── Load repos when project changes ──
  useEffect(() => {
    if (!selectedProjectId) { setRepos([]); setSelectedRepos([]); return; }
    setReposLoading(true);
    setRepos([]);
    setSelectedRepos([]);
    fetch(`${BACKEND}/api/projects/${selectedProjectId}/repos`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : [])
      .then((data: Repo[]) => setRepos(data))
      .catch(() => {})
      .finally(() => setReposLoading(false));
  }, [selectedProjectId]);

  // ── Build messages from initialDoc ──
  useEffect(() => {
    if (!initialDoc) return;
    const msgs: ChatMessage[] = [];

    // User bubble
    let parsedMdFilenames: string[] = [];
    try { if (initialDoc.md_filenames) parsedMdFilenames = JSON.parse(initialDoc.md_filenames); } catch { /* ignore */ }
    let parsedRepos: string[] = [];
    try { if (initialDoc.azure_repos) parsedRepos = initialDoc.azure_repos.split(',').map(s => s.trim()).filter(Boolean); } catch { /* ignore */ }

    msgs.push({
      type: 'user',
      title: initialDoc.title,
      pdfName: initialDoc.pdf_filename,
      repos: parsedRepos,
      mdFiles: parsedMdFilenames,
      userMessage: initialDoc.user_message ?? undefined,
    });

    if (initialDoc.status === 'completed' && initialDoc.md_output) {
      msgs.push({
        type: 'progress',
        steps: [
          { key: 'pdf_parsed', status: 'done', message: t('step_pdf_parsed') },
          { key: 'building_prompt', status: 'done', message: t('step_building_prompt') },
          { key: 'ai_calling', status: 'done', message: t('step_ai_calling') },
          { key: 'generating_output', status: 'done', message: t('step_generating_output') },
          { key: 'complete', status: 'done', message: t('step_complete') },
        ],
      });
      msgs.push({ type: 'ai-response', mdOutput: initialDoc.md_output });
    } else if (initialDoc.status === 'error') {
      msgs.push({
        type: 'progress',
        steps: [
          { key: 'pdf_parsed', status: 'done', message: t('step_pdf_parsed') },
          { key: 'error', status: 'error', message: t('step_error') },
        ],
      });
      msgs.push({ type: 'error', errorMessage: t('errorReanalyze') });
    } else if (initialDoc.status === 'analyzing') {
      msgs.push({
        type: 'progress',
        steps: [
          { key: 'pdf_parsing', status: 'active', message: t('step_pdf_parsing') },
        ],
      });
    }

    setMessages(msgs);
    scrollToBottom();
  }, [initialDoc, t, scrollToBottom]);

  // ── Socket.IO for progress events ──
  useEffect(() => {
    if (!userId) return;

    const socket = io(BACKEND || undefined, { withCredentials: true });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('user:identify', { userId });
    });

    socket.on('analysis:step', (data: { docId: string; step: string; message: string }) => {
      setMessages(prev => {
        const copy = [...prev];
        const progressIdx = copy.findIndex(m => m.type === 'progress');
        if (progressIdx >= 0) {
          const steps = [...(copy[progressIdx].steps ?? [])];
          // Mark all previous steps as done
          for (const s of steps) { if (s.status === 'active') s.status = 'done'; }
          steps.push({ key: data.step, status: 'active', message: data.message });
          copy[progressIdx] = { ...copy[progressIdx], steps };
        }
        return copy;
      });
      scrollToBottom();
    });

    socket.on('analysis:complete', (data: { docId: string; md_output: string }) => {
      setMessages(prev => {
        const copy = [...prev];
        // Finalize progress steps
        const progressIdx = copy.findIndex(m => m.type === 'progress');
        if (progressIdx >= 0) {
          const steps = [...(copy[progressIdx].steps ?? [])];
          for (const s of steps) { if (s.status === 'active') s.status = 'done'; }
          steps.push({ key: 'complete', status: 'done', message: t('step_complete') });
          copy[progressIdx] = { ...copy[progressIdx], steps };
        }
        // Add AI response
        copy.push({ type: 'ai-response', mdOutput: data.md_output });
        return copy;
      });
      setCurrentDoc(prev => prev ? { ...prev, md_output: data.md_output, status: 'completed' } : prev);
      setSending(false);
      scrollToBottom();
      // Refresh history
      fetch(`${BACKEND}/api/analysis`, { credentials: 'include' })
        .then(r => r.ok ? r.json() : [])
        .then((d: AnalysisSummary[]) => setHistory(d))
        .catch(() => {});
    });

    socket.on('analysis:error', (data: { docId: string; error: string }) => {
      setMessages(prev => {
        const copy = [...prev];
        const progressIdx = copy.findIndex(m => m.type === 'progress');
        if (progressIdx >= 0) {
          const steps = [...(copy[progressIdx].steps ?? [])];
          for (const s of steps) { if (s.status === 'active') s.status = 'error'; }
          copy[progressIdx] = { ...copy[progressIdx], steps };
        }
        copy.push({ type: 'error', errorMessage: data.error });
        return copy;
      });
      setCurrentDoc(prev => prev ? { ...prev, status: 'error' } : prev);
      setSending(false);
      scrollToBottom();
    });

    return () => { socket.disconnect(); };
  }, [userId, t, scrollToBottom]);

  // ── Send analysis ──
  const handleSend = async () => {
    if (!title.trim()) { setError(t('errorTitleRequired')); return; }
    if (!pdfFile) { setError(t('errorPdfRequired')); return; }
    if (pdfFile.size > 10 * 1024 * 1024) { setError(t('errorFileTooLarge')); return; }
    if (pdfFile.type !== 'application/pdf') { setError(t('errorInvalidFile')); return; }

    setSending(true);
    setError(null);

    // Build user bubble
    const allMdNames = [
      ...mdFiles.map(f => f.name),
      ...selectedPreviousMdFiles.map(f => f.filename),
    ];

    const userMsg: ChatMessage = {
      type: 'user',
      title: title.trim(),
      pdfName: pdfFile.name,
      repos: selectedRepos.length > 0 ? [...selectedRepos] : undefined,
      mdFiles: allMdNames.length > 0 ? allMdNames : undefined,
      userMessage: userMessage.trim() || undefined,
    };

    setMessages([userMsg, { type: 'progress', steps: [{ key: 'pdf_parsing', status: 'active', message: t('step_pdf_parsing') }] }]);
    scrollToBottom();

    try {
      const formData = new FormData();
      formData.append('title', title.trim());
      formData.append('pdf', pdfFile);
      formData.append('locale', locale);
      formData.append('client_user_id', userId);
      if (userMessage.trim()) formData.append('user_message', userMessage.trim());
      if (selectedRepos.length > 0) formData.append('azure_repos', selectedRepos.join(', '));
      if (selectedProjectId) formData.append('project_id', selectedProjectId);

      // Attach uploaded MD files
      for (const mf of mdFiles) {
        formData.append('md_files', mf);
      }

      // Attach selected previous MD files as text
      if (selectedPreviousMdFiles.length > 0) {
        const combinedMd = selectedPreviousMdFiles.map(f => `### ${f.filename}\n\n${f.content}`).join('\n\n---\n\n');
        formData.append('md_context', combinedMd);
        formData.append('md_filenames', JSON.stringify(selectedPreviousMdFiles.map(f => f.filename)));
      }

      const res = await fetch(`${BACKEND}/api/analysis`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      if (!res.ok) {
        let errMsg = `HTTP ${res.status}`;
        try {
          const body = await res.json() as { error?: string };
          errMsg = body.error ?? errMsg;
        } catch { /* non-JSON response */ }
        throw new Error(errMsg);
      }

      const doc = await res.json() as AnalysisDoc & { warning?: string };
      setCurrentDoc(doc);

      // If there's a warning (no AI provider) show it
      if (doc.warning) {
        setMessages(prev => [...prev, { type: 'error', errorMessage: doc.warning }]);
        setSending(false);
      }

      // Navigate to the new analysis URL
      window.history.replaceState(null, '', `/${locale}/analysis/${doc.id}`);

      // Reset composer
      setTitle('');
      setPdfFile(null);
      setUserMessage('');
      setMdFiles([]);
      setSelectedPreviousMdFiles([]);
      setSelectedRepos([]);
      setSelectedProjectId('');
      setComposerExpanded(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('errorCreate'));
      setSending(false);
    }
  };

  // ── Re-analyze ──
  const handleReanalyze = async () => {
    if (!currentDoc) return;
    setSending(true);
    setError(null);

    // Reset messages to show progress
    let parsedMdFilenames: string[] = [];
    try { if (currentDoc.md_filenames) parsedMdFilenames = JSON.parse(currentDoc.md_filenames); } catch { /* ignore */ }
    let parsedRepos: string[] = [];
    try { if (currentDoc.azure_repos) parsedRepos = currentDoc.azure_repos.split(',').map(s => s.trim()).filter(Boolean); } catch { /* ignore */ }

    setMessages([
      {
        type: 'user',
        title: currentDoc.title,
        pdfName: currentDoc.pdf_filename,
        repos: parsedRepos,
        mdFiles: parsedMdFilenames,
        userMessage: currentDoc.user_message ?? undefined,
      },
      { type: 'progress', steps: [{ key: 'pdf_parsing', status: 'active', message: t('step_pdf_parsing') }] },
    ]);
    scrollToBottom();

    try {
      const res = await fetch(`${BACKEND}/api/analysis/${currentDoc.id}/reanalyze`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locale }),
      });
      if (!res.ok) {
        const body = await res.json() as { error?: string };
        throw new Error(body.error ?? t('errorReanalyze'));
      }
      // Background will send Socket.IO events
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('errorReanalyze'));
      setSending(false);
    }
  };

  // ── Load a history item ──
  const loadHistoryItem = async (id: string) => {
    try {
      const res = await fetch(`${BACKEND}/api/analysis/${id}`, { credentials: 'include' });
      if (!res.ok) return;
      const doc = await res.json() as AnalysisDoc;
      setCurrentDoc(doc);

      // Build messages
      const msgs: ChatMessage[] = [];
      let parsedMdFilenames: string[] = [];
      try { if (doc.md_filenames) parsedMdFilenames = JSON.parse(doc.md_filenames); } catch { /* ignore */ }
      let parsedRepos: string[] = [];
      try { if (doc.azure_repos) parsedRepos = doc.azure_repos.split(',').map(s => s.trim()).filter(Boolean); } catch { /* ignore */ }

      msgs.push({
        type: 'user',
        title: doc.title,
        pdfName: doc.pdf_filename,
        repos: parsedRepos,
        mdFiles: parsedMdFilenames,
        userMessage: doc.user_message ?? undefined,
      });

      if (doc.status === 'completed' && doc.md_output) {
        msgs.push({
          type: 'progress',
          steps: [
            { key: 'pdf_parsed', status: 'done', message: t('step_pdf_parsed') },
            { key: 'building_prompt', status: 'done', message: t('step_building_prompt') },
            { key: 'ai_calling', status: 'done', message: t('step_ai_calling') },
            { key: 'generating_output', status: 'done', message: t('step_generating_output') },
            { key: 'complete', status: 'done', message: t('step_complete') },
          ],
        });
        msgs.push({ type: 'ai-response', mdOutput: doc.md_output });
      } else if (doc.status === 'error') {
        msgs.push({
          type: 'progress',
          steps: [{ key: 'error', status: 'error', message: t('step_error') }],
        });
      }

      setMessages(msgs);
      setHistoryOpen(false);
      router.replace(`/${locale}/analysis/${doc.id}`);
      scrollToBottom();
    } catch { /* ignore */ }
  };

  // ── New analysis ──
  const startNewAnalysis = () => {
    setCurrentDoc(null);
    setMessages([]);
    setTitle('');
    setPdfFile(null);
    setUserMessage('');
    setMdFiles([]);
    setSelectedPreviousMdFiles([]);
    setSelectedRepos([]);
    setSelectedProjectId('');
    setComposerExpanded(false);
    setEditing(false);
    router.replace(`/${locale}/analysis`);
  };

  // ── Delete ──
  const handleDelete = async () => {
    if (!currentDoc || !confirm(t('confirmDelete'))) return;
    try {
      await fetch(`${BACKEND}/api/analysis/${currentDoc.id}`, { method: 'DELETE', credentials: 'include' });
      setHistory(prev => prev.filter(h => h.id !== currentDoc.id));
      startNewAnalysis();
    } catch { /* ignore */ }
  };

  // ── Copy output ──
  const handleCopy = () => {
    const output = messages.find(m => m.type === 'ai-response')?.mdOutput;
    if (output) {
      navigator.clipboard.writeText(output);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // ── Download MD ──
  const handleDownload = () => {
    const output = messages.find(m => m.type === 'ai-response')?.mdOutput;
    if (!output) return;
    const blob = new Blob([output], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentDoc?.title ?? 'analysis'}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Save edited output ──
  const handleSaveEdit = async () => {
    if (!currentDoc) return;
    setSaving(true);
    try {
      const res = await fetch(`${BACKEND}/api/analysis/${currentDoc.id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ md_output: editValue }),
      });
      if (!res.ok) throw new Error();
      const updated = await res.json() as AnalysisDoc;
      setCurrentDoc(updated);
      setMessages(prev => prev.map(m => m.type === 'ai-response' ? { ...m, mdOutput: editValue } : m));
      setEditing(false);
    } catch {
      setError(t('errorSave'));
    } finally {
      setSaving(false);
    }
  };

  // ── Filtered repos ──
  const filteredRepos = repos.filter(r =>
    r.name.toLowerCase().includes(repoSearch.toLowerCase()),
  );

  const filteredPreviousMd = previousMdFiles.filter(f =>
    f.filename.toLowerCase().includes(mdPickerSearch.toLowerCase()),
  );

  const toggleRepo = (name: string) => {
    setSelectedRepos(prev => prev.includes(name) ? prev.filter(r => r !== name) : [...prev, name]);
  };

  const togglePreviousMd = (entry: MdFileEntry) => {
    setSelectedPreviousMdFiles(prev =>
      prev.some(f => f.filename === entry.filename)
        ? prev.filter(f => f.filename !== entry.filename)
        : [...prev, entry],
    );
  };

  const handlePdfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setPdfFile(file);
  };

  const handleMdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    setMdFiles(prev => [...prev, ...files]);
  };

  const isAnalyzing = currentDoc?.status === 'analyzing' || sending;
  const hasOutput = messages.some(m => m.type === 'ai-response');
  const showComposer = !currentDoc || currentDoc.status === 'completed' || currentDoc.status === 'error' || currentDoc.status === 'pending';

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 flex">
      {/* ── History Sidebar ── */}
      <aside className={`${historyOpen ? 'w-72' : 'w-0'} transition-all duration-300 overflow-hidden border-r border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex-shrink-0`}>
        <div className="p-4 w-72">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300">{t('history')}</h3>
            <button onClick={() => setHistoryOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-300">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          <button
            onClick={startNewAnalysis}
            className="w-full mb-3 py-2 text-sm rounded-lg bg-violet-600 hover:bg-violet-500 text-white font-medium transition-colors"
          >
            {t('newChat')}
          </button>
          {history.length === 0 ? (
            <p className="text-xs text-gray-400 dark:text-slate-500 italic">{t('noHistory')}</p>
          ) : (
            <div className="space-y-1 max-h-[calc(100vh-160px)] overflow-y-auto">
              {history.map(h => (
                <button
                  key={h.id}
                  onClick={() => loadHistoryItem(h.id)}
                  className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors ${
                    currentDoc?.id === h.id
                      ? 'bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300'
                      : 'hover:bg-gray-50 dark:hover:bg-slate-800 text-gray-700 dark:text-slate-300'
                  }`}
                >
                  <div className="font-medium truncate">{h.title}</div>
                  <div className="text-xs text-gray-400 dark:text-slate-500 mt-0.5 flex items-center gap-2">
                    <span>{new Date(h.created_at).toLocaleDateString()}</span>
                    <span className={`inline-block w-1.5 h-1.5 rounded-full ${
                      h.status === 'completed' ? 'bg-emerald-500' : h.status === 'error' ? 'bg-red-500' : h.status === 'analyzing' ? 'bg-violet-500 animate-pulse' : 'bg-gray-400'
                    }`} />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </aside>

      {/* ── Main Chat Area ── */}
      <div className="flex-1 flex flex-col max-h-screen">
        {/* ── Top Bar ── */}
        <header className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex-shrink-0">
          <div className="flex items-center gap-3">
            {!historyOpen && (
              <button onClick={() => setHistoryOpen(true)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-500 dark:text-slate-400" title={t('history')}>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
              </button>
            )}
            <button
              onClick={() => router.push(`/${locale}/dashboard`)}
              className="text-sm text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 transition-colors"
            >
              &larr; {t('backToDashboard')}
            </button>
            <div className="h-4 w-px bg-gray-200 dark:bg-slate-700" />
            <h1 className="text-sm font-semibold text-gray-800 dark:text-white">{t('chatTitle')}</h1>
          </div>
          <div className="flex items-center gap-2">
            {currentDoc && (
              <>
                <button
                  onClick={handleReanalyze}
                  disabled={isAnalyzing}
                  className="px-3 py-1.5 text-xs rounded-lg bg-violet-600 hover:bg-violet-500 text-white font-medium disabled:opacity-50 transition-colors"
                >
                  {isAnalyzing ? t('reanalyzing') : t('reanalyze')}
                </button>
                <button
                  onClick={handleDelete}
                  className="px-3 py-1.5 text-xs rounded-lg border border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                >
                  {t('delete')}
                </button>
              </>
            )}
            <button
              onClick={startNewAnalysis}
              className="px-3 py-1.5 text-xs rounded-lg border border-gray-300 dark:border-slate-600 text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
            >
              {t('newChat')}
            </button>
          </div>
        </header>

        {/* ── Messages Area ── */}
        <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
          {messages.length === 0 && !currentDoc && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-16 h-16 rounded-2xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center mb-4">
                <span className="text-3xl">📄</span>
              </div>
              <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-1">{t('chatTitle')}</h2>
              <p className="text-sm text-gray-400 dark:text-slate-500 max-w-md">{t('chatSubtitle')}</p>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i}>
              {/* ── User Bubble ── */}
              {msg.type === 'user' && (
                <div className="flex justify-end">
                  <div className="max-w-xl bg-violet-600 text-white rounded-2xl rounded-tr-md px-5 py-4 shadow-lg">
                    <div className="text-xs font-medium opacity-80 mb-2">{t('userBubbleTitle')}</div>
                    <div className="font-semibold text-sm mb-2">{msg.title}</div>
                    <div className="space-y-1 text-xs">
                      {msg.pdfName && (
                        <div className="flex items-center gap-1.5 opacity-90">
                          <span>📎</span>
                          <span className="font-medium">{t('userBubblePdf')}:</span>
                          <span className="font-mono">{msg.pdfName}</span>
                        </div>
                      )}
                      {msg.repos && msg.repos.length > 0 && (
                        <div className="flex items-start gap-1.5 opacity-90">
                          <span className="mt-0.5">🔗</span>
                          <span className="font-medium">{t('userBubbleRepos')}:</span>
                          <span>{msg.repos.join(', ')}</span>
                        </div>
                      )}
                      {msg.mdFiles && msg.mdFiles.length > 0 && (
                        <div className="flex items-start gap-1.5 opacity-90">
                          <span className="mt-0.5">📝</span>
                          <span className="font-medium">{t('userBubbleMdFiles')}:</span>
                          <span>{msg.mdFiles.join(', ')}</span>
                        </div>
                      )}
                      {msg.userMessage && (
                        <div className="mt-2 pt-2 border-t border-white/20 opacity-90">
                          <span className="font-medium">{t('userBubbleMessage')}:</span>{' '}
                          <span>{msg.userMessage}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* ── Progress Steps ── */}
              {msg.type === 'progress' && msg.steps && (
                <div className="flex justify-start">
                  <div className="max-w-md bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-2xl rounded-tl-md px-5 py-4 shadow-sm">
                    <div className="space-y-2.5">
                      {msg.steps.map((step, si) => (
                        <div key={si} className="flex items-center gap-3">
                          {step.status === 'active' && (
                            <div className="w-5 h-5 flex items-center justify-center">
                              <div className="w-4 h-4 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
                            </div>
                          )}
                          {step.status === 'done' && (
                            <div className="w-5 h-5 flex items-center justify-center text-emerald-500">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                            </div>
                          )}
                          {step.status === 'error' && (
                            <div className="w-5 h-5 flex items-center justify-center text-red-500">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                            </div>
                          )}
                          <span className={`text-sm ${
                            step.status === 'active' ? 'text-violet-600 dark:text-violet-400 font-medium' :
                            step.status === 'done' ? 'text-gray-500 dark:text-slate-400' :
                            'text-red-600 dark:text-red-400 font-medium'
                          }`}>
                            {step.message}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* ── AI Response ── */}
              {msg.type === 'ai-response' && msg.mdOutput && (
                <div className="flex justify-start">
                  <div className="w-full max-w-3xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-2xl rounded-tl-md shadow-sm overflow-hidden">
                    <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 dark:border-slate-800">
                      <span className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">{t('aiResponseTitle')}</span>
                      <div className="flex items-center gap-1.5">
                        {!editing && (
                          <>
                            <button onClick={handleCopy} className="px-2.5 py-1 text-xs rounded-md bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors">
                              {copied ? t('copied') : t('copyOutput')}
                            </button>
                            <button onClick={handleDownload} className="px-2.5 py-1 text-xs rounded-md bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors">
                              {t('downloadMd')}
                            </button>
                            <button onClick={() => { setEditValue(msg.mdOutput ?? ''); setEditing(true); }} className="px-2.5 py-1 text-xs rounded-md bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors">
                              {t('editOutput')}
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                    {editing ? (
                      <div className="p-4 space-y-3">
                        <textarea
                          value={editValue}
                          onChange={e => setEditValue(e.target.value)}
                          rows={20}
                          className="w-full rounded-xl px-4 py-3 text-sm bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-600 text-gray-900 dark:text-white font-mono focus:outline-none focus:ring-1 focus:ring-violet-500 resize-y"
                        />
                        <div className="flex gap-2">
                          <button onClick={() => setEditing(false)} className="px-3 py-1.5 text-xs rounded-lg border border-gray-300 dark:border-slate-600 text-gray-500 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-800">
                            {t('cancelEdit')}
                          </button>
                          <button onClick={handleSaveEdit} disabled={saving} className="px-3 py-1.5 text-xs rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium disabled:opacity-50 transition-colors">
                            {saving ? t('saving') : t('saveOutput')}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="px-5 py-4 prose prose-sm dark:prose-invert max-w-none
                        prose-headings:text-gray-900 dark:prose-headings:text-white
                        prose-h2:text-lg prose-h2:font-bold prose-h2:mt-6 prose-h2:mb-3
                        prose-h3:text-base prose-h3:font-semibold prose-h3:mt-4 prose-h3:mb-2
                        prose-li:text-gray-700 dark:prose-li:text-slate-300
                        prose-strong:text-gray-900 dark:prose-strong:text-white
                        prose-p:text-gray-700 dark:prose-p:text-slate-300">
                        <ReactMarkdown>{msg.mdOutput}</ReactMarkdown>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ── Error ── */}
              {msg.type === 'error' && (
                <div className="flex justify-start">
                  <div className="max-w-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl rounded-tl-md px-5 py-3 text-sm text-red-600 dark:text-red-400">
                    {msg.errorMessage}
                  </div>
                </div>
              )}
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>

        {/* ── Composer ── */}
        {showComposer && !currentDoc && (
          <div className="border-t border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-4 flex-shrink-0">
            {error && (
              <div className="mb-3 p-2.5 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-xs">
                {error}
              </div>
            )}

            {/* Title input */}
            <div className="mb-3">
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder={t('titlePlaceholder')}
                className="w-full rounded-xl px-4 py-2.5 text-sm bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
              />
            </div>

            {/* Expandable options */}
            {composerExpanded && (
              <div className="mb-3 space-y-3 p-3 rounded-xl bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700">
                {/* User message */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">{t('userMessageLabel')}</label>
                  <textarea
                    value={userMessage}
                    onChange={e => setUserMessage(e.target.value)}
                    placeholder={t('userMessagePlaceholder')}
                    rows={2}
                    className="w-full rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-violet-500 resize-none"
                  />
                </div>

                {/* Project / Repo selector */}
                {projects.length > 0 && (
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">{t('azureReposLabel')}</label>
                    <select
                      value={selectedProjectId}
                      onChange={e => setSelectedProjectId(e.target.value)}
                      className="w-full rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-violet-500 mb-2"
                    >
                      <option value="">{t('azureReposSelectProject')}</option>
                      {projects.map(p => (
                        <option key={p.id} value={p.id}>{p.organization} / {p.name}</option>
                      ))}
                    </select>

                    {selectedProjectId && (
                      <div className="rounded-lg border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800/50 overflow-hidden">
                        {/* Repo search */}
                        <div className="px-3 py-2 border-b border-gray-100 dark:border-slate-700">
                          <input
                            type="text"
                            value={repoSearch}
                            onChange={e => setRepoSearch(e.target.value)}
                            placeholder={t('searchRepos')}
                            className="w-full text-xs bg-transparent border-none outline-none text-gray-700 dark:text-slate-300 placeholder-gray-400 dark:placeholder-slate-500"
                          />
                        </div>
                        {reposLoading && <p className="text-xs text-gray-400 dark:text-slate-500 px-3 py-2">{t('azureReposLoading')}</p>}
                        {!reposLoading && filteredRepos.length === 0 && <p className="text-xs text-gray-400 dark:text-slate-500 px-3 py-2">{t('azureReposNone')}</p>}
                        {!reposLoading && filteredRepos.length > 0 && (
                          <div className="max-h-32 overflow-y-auto divide-y divide-gray-100 dark:divide-slate-700">
                            {filteredRepos.map(repo => (
                              <label key={repo.id} className="flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
                                <input type="checkbox" checked={selectedRepos.includes(repo.name)} onChange={() => toggleRepo(repo.name)} className="accent-violet-500 w-3.5 h-3.5 flex-shrink-0" />
                                <span className="text-xs text-gray-700 dark:text-slate-300 truncate">{repo.name}</span>
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {selectedRepos.length > 0 && (
                      <p className="text-xs text-violet-600 dark:text-violet-400 mt-1">{t('azureReposSelected')}: {selectedRepos.join(', ')}</p>
                    )}
                  </div>
                )}

                {/* MD files */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">{t('mdFilesLabel')}</label>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {mdFiles.map((f, i) => (
                      <span key={i} className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 text-xs">
                        📝 {f.name}
                        <button onClick={() => setMdFiles(prev => prev.filter((_, j) => j !== i))} className="hover:text-red-500 ml-0.5">&times;</button>
                      </span>
                    ))}
                    {selectedPreviousMdFiles.map((f, i) => (
                      <span key={`prev-${i}`} className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 text-xs">
                        📄 {f.filename}
                        <button onClick={() => setSelectedPreviousMdFiles(prev => prev.filter((_, j) => j !== i))} className="hover:text-red-500 ml-0.5">&times;</button>
                      </span>
                    ))}
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => mdInputRef.current?.click()}
                      className="px-2.5 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
                    >
                      {t('attachMd')}
                    </button>
                    {previousMdFiles.length > 0 && (
                      <div className="relative">
                        <button
                          onClick={() => setMdPickerOpen(!mdPickerOpen)}
                          className="px-2.5 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
                        >
                          {t('selectMdFiles')}
                        </button>
                        {mdPickerOpen && (
                          <div className="absolute bottom-full left-0 mb-1 w-64 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg shadow-xl z-50 overflow-hidden">
                            <div className="p-2 border-b border-gray-100 dark:border-slate-700">
                              <input
                                type="text"
                                value={mdPickerSearch}
                                onChange={e => setMdPickerSearch(e.target.value)}
                                placeholder="Search…"
                                className="w-full text-xs bg-transparent border-none outline-none text-gray-700 dark:text-slate-300 placeholder-gray-400"
                              />
                            </div>
                            <div className="max-h-40 overflow-y-auto divide-y divide-gray-100 dark:divide-slate-700">
                              {filteredPreviousMd.length === 0 ? (
                                <p className="text-xs text-gray-400 px-3 py-2">{t('noMdFiles')}</p>
                              ) : (
                                filteredPreviousMd.map((entry, i) => (
                                  <label key={i} className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700/50">
                                    <input
                                      type="checkbox"
                                      checked={selectedPreviousMdFiles.some(f => f.filename === entry.filename)}
                                      onChange={() => togglePreviousMd(entry)}
                                      className="accent-violet-500 w-3.5 h-3.5"
                                    />
                                    <div className="min-w-0">
                                      <div className="text-xs font-medium text-gray-700 dark:text-slate-300 truncate">{entry.filename}</div>
                                      <div className="text-[10px] text-gray-400 dark:text-slate-500 truncate">from: {entry.docTitle}</div>
                                    </div>
                                  </label>
                                ))
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Bottom bar: attach + text + send */}
            <div className="flex items-end gap-2">
              <div className="flex gap-1">
                <button
                  onClick={() => pdfInputRef.current?.click()}
                  className={`p-2 rounded-lg transition-colors ${pdfFile ? 'bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400' : 'hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-400 dark:text-slate-500'}`}
                  title={t('attachPdf')}
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                </button>
                <button
                  onClick={() => setComposerExpanded(!composerExpanded)}
                  className={`p-2 rounded-lg transition-colors ${composerExpanded ? 'bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400' : 'hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-400 dark:text-slate-500'}`}
                  title="Options"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
                </button>
              </div>

              <div className="flex-1 flex flex-col">
                {pdfFile && (
                  <div className="flex items-center gap-1.5 px-3 py-1 mb-1 rounded-t-lg bg-violet-50 dark:bg-violet-900/20 text-xs text-violet-600 dark:text-violet-400">
                    <span>📎 {pdfFile.name}</span>
                    <button onClick={() => setPdfFile(null)} className="hover:text-red-500">&times;</button>
                  </div>
                )}
                {(mdFiles.length > 0 || selectedPreviousMdFiles.length > 0) && (
                  <div className="flex items-center gap-1.5 px-3 py-1 mb-1 rounded-t-lg bg-emerald-50 dark:bg-emerald-900/20 text-xs text-emerald-600 dark:text-emerald-400">
                    <span>📝 {t('mdSelected')}: {mdFiles.length + selectedPreviousMdFiles.length}</span>
                  </div>
                )}
              </div>

              <button
                onClick={handleSend}
                disabled={sending || !title.trim() || !pdfFile}
                className="px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                {t('sendBtn')}
              </button>
            </div>

            {/* Hidden file inputs */}
            <input ref={pdfInputRef} type="file" accept=".pdf,application/pdf" onChange={handlePdfChange} className="hidden" />
            <input ref={mdInputRef} type="file" accept=".md,text/markdown" multiple onChange={handleMdChange} className="hidden" />
          </div>
        )}

        {/* Show action bar for existing docs (re-analyze/copy/download) */}
        {currentDoc && hasOutput && !editing && (
          <div className="border-t border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3 flex items-center justify-center gap-2 flex-shrink-0">
            <button onClick={handleCopy} className="px-3 py-1.5 text-xs rounded-lg bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors">
              {copied ? t('copied') : t('copyOutput')}
            </button>
            <button onClick={handleDownload} className="px-3 py-1.5 text-xs rounded-lg bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors">
              {t('downloadMd')}
            </button>
            <button
              onClick={handleReanalyze}
              disabled={isAnalyzing}
              className="px-3 py-1.5 text-xs rounded-lg bg-violet-600 hover:bg-violet-500 text-white font-medium disabled:opacity-50 transition-colors"
            >
              {isAnalyzing ? t('reanalyzing') : t('reanalyze')}
            </button>
          </div>
        )}

        {/* Error bar at bottom for existing docs */}
        {currentDoc && error && (
          <div className="px-4 py-2 bg-red-50 dark:bg-red-900/20 border-t border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-xs text-center">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
