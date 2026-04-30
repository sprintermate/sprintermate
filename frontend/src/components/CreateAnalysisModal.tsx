'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? '';

interface Props {
  locale: string;
  onClose: (created?: boolean) => void;
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
  projectName: string;
}

export default function CreateAnalysisModal({ locale, onClose }: Props) {
  const t = useTranslations('analysis');
  const router = useRouter();

  const [title, setTitle] = useState('');
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [userMessage, setUserMessage] = useState('');

  // Repo selector state
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [repos, setRepos] = useState<Repo[]>([]);
  const [selectedRepos, setSelectedRepos] = useState<string[]>([]);
  const [reposLoading, setReposLoading] = useState(false);
  const [reposError, setReposError] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load projects on mount
  useEffect(() => {
    fetch(`${BACKEND}/api/projects`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : [])
      .then((data: Project[]) => setProjects(data.filter(p => p.hasPat)))
      .catch(() => {});
  }, []);

  // Load repos when project is selected
  useEffect(() => {
    if (!selectedProjectId) {
      setRepos([]);
      setSelectedRepos([]);
      setReposError(null);
      return;
    }
    setReposLoading(true);
    setReposError(null);
    setRepos([]);
    setSelectedRepos([]);
    fetch(`${BACKEND}/api/projects/${selectedProjectId}/repos`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : r.json().then((b: { error?: string }) => Promise.reject(b.error ?? 'error')))
      .then((data: Repo[]) => setRepos(data))
      .catch((e: unknown) => setReposError(typeof e === 'string' ? e : t('azureReposError')))
      .finally(() => setReposLoading(false));
  }, [selectedProjectId, t]);

  const toggleRepo = (name: string) => {
    setSelectedRepos(prev =>
      prev.includes(name) ? prev.filter(r => r !== name) : [...prev, name],
    );
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    if (file) {
      if (file.size > 10 * 1024 * 1024) { setError(t('errorFileTooLarge')); setPdfFile(null); return; }
      if (file.type !== 'application/pdf') { setError(t('errorInvalidFile')); setPdfFile(null); return; }
      setError(null);
    }
    setPdfFile(file);
  };

  const handleCreate = async () => {
    if (!title.trim()) { setError(t('errorTitleRequired')); return; }
    if (!pdfFile) { setError(t('errorPdfRequired')); return; }

    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('title', title.trim());
      formData.append('pdf', pdfFile);
      formData.append('locale', locale);
      if (userMessage.trim()) formData.append('user_message', userMessage.trim());
      if (selectedRepos.length > 0) formData.append('azure_repos', selectedRepos.join(', '));

      const res = await fetch(`${BACKEND}/api/analysis`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      if (!res.ok) {
        const body = await res.json() as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }

      const data = await res.json() as { id: string };
      onClose(true);
      router.push(`/${locale}/analysis/${data.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('errorCreate'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={() => onClose()}>
      <div
        className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-2xl p-6 w-full max-w-lg mx-4 shadow-2xl max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-5">{t('createTitle')}</h2>

        {/* Title */}
        <div className="mb-4">
          <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">{t('titleLabel')}</label>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder={t('titlePlaceholder')}
            className="w-full rounded-lg px-3 py-2 text-sm bg-gray-100 dark:bg-slate-800 border border-gray-300 dark:border-slate-600 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
          />
        </div>

        {/* PDF file */}
        <div className="mb-4">
          <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">{t('pdfLabel')}</label>
          <input
            type="file"
            accept=".pdf,application/pdf"
            onChange={handleFileChange}
            className="w-full text-sm text-gray-500 dark:text-slate-400
              file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0
              file:text-sm file:font-medium
              file:bg-violet-50 file:text-violet-600
              dark:file:bg-violet-900/30 dark:file:text-violet-300
              hover:file:bg-violet-100 dark:hover:file:bg-violet-900/50
              file:cursor-pointer file:transition-colors"
          />
          <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">{t('pdfHint')}</p>
          {pdfFile && <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">{pdfFile.name}</p>}
        </div>

        {/* User message */}
        <div className="mb-4">
          <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">{t('userMessageLabel')}</label>
          <textarea
            value={userMessage}
            onChange={e => setUserMessage(e.target.value)}
            placeholder={t('userMessagePlaceholder')}
            rows={3}
            className="w-full rounded-lg px-3 py-2 text-sm bg-gray-100 dark:bg-slate-800 border border-gray-300 dark:border-slate-600 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-violet-500 resize-none"
          />
        </div>

        {/* Azure Repo context — project + repo selector */}
        <div className="mb-5">
          <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">{t('azureReposLabel')}</label>

          {projects.length === 0 ? (
            <p className="text-xs text-gray-400 dark:text-slate-500 italic">{t('azureReposNoProjects')}</p>
          ) : (
            <>
              {/* Project dropdown */}
              <select
                value={selectedProjectId}
                onChange={e => setSelectedProjectId(e.target.value)}
                className="w-full rounded-lg px-3 py-2 text-sm bg-gray-100 dark:bg-slate-800 border border-gray-300 dark:border-slate-600 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-violet-500 mb-2"
              >
                <option value="">{t('azureReposSelectProject')}</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.organization} / {p.name}</option>
                ))}
              </select>

              {/* Repo list */}
              {selectedProjectId && (
                <div className="rounded-lg border border-gray-300 dark:border-slate-600 bg-gray-50 dark:bg-slate-800/50 overflow-hidden">
                  {reposLoading && (
                    <p className="text-xs text-gray-400 dark:text-slate-500 px-3 py-2">{t('azureReposLoading')}</p>
                  )}
                  {reposError && (
                    <p className="text-xs text-red-500 dark:text-red-400 px-3 py-2">{reposError}</p>
                  )}
                  {!reposLoading && !reposError && repos.length === 0 && (
                    <p className="text-xs text-gray-400 dark:text-slate-500 px-3 py-2">{t('azureReposNone')}</p>
                  )}
                  {!reposLoading && repos.length > 0 && (
                    <div className="max-h-36 overflow-y-auto divide-y divide-gray-200 dark:divide-slate-700">
                      {repos.map(repo => (
                        <label
                          key={repo.id}
                          className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-700/50 transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={selectedRepos.includes(repo.name)}
                            onChange={() => toggleRepo(repo.name)}
                            className="accent-violet-500 w-3.5 h-3.5 flex-shrink-0"
                          />
                          <span className="text-sm text-gray-800 dark:text-slate-200 truncate">{repo.name}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {selectedRepos.length > 0 && (
                <p className="text-xs text-violet-600 dark:text-violet-400 mt-1.5">
                  {t('azureReposSelected')}: {selectedRepos.join(', ')}
                </p>
              )}
            </>
          )}
        </div>

        {error && <p className="text-red-500 dark:text-red-400 text-xs mb-3">{error}</p>}

        <div className="flex gap-2">
          <button
            onClick={() => onClose()}
            className="flex-1 py-2 text-sm rounded-lg border border-gray-300 dark:border-slate-600 text-gray-500 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-800"
          >
            {t('cancel')}
          </button>
          <button
            onClick={handleCreate}
            disabled={loading}
            className="flex-1 py-2 text-sm rounded-lg bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
          >
            {loading ? t('creating') : t('createBtn')}
          </button>
        </div>
      </div>
    </div>
  );
}
