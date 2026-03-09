'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? '';

interface Project {
  id: string;
  name: string;
}

interface Props {
  locale: string;
  onClose: () => void;
}

export default function CreateRetroModal({ locale, onClose }: Props) {
  const t = useTranslations('retro');
  const router = useRouter();

  const [title, setTitle] = useState('');
  const [duration, setDuration] = useState(30);
  const [projectId, setProjectId] = useState<string>('');
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${BACKEND}/api/projects`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : [])
      .then((data: Project[]) => setProjects(data))
      .catch(() => {/* ignore */});
  }, []);

  const handleCreate = async () => {
    if (!title.trim()) { setError(t('errorTitleRequired')); return; }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${BACKEND}/api/retro`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          duration_minutes: duration,
          project_id: projectId || null,
        }),
      });
      if (!res.ok) {
        const body = await res.json() as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const data = await res.json() as { code: string };
      router.push(`/${locale}/retro/${data.code}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('errorCreate'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold text-white mb-5">{t('createTitle')}</h2>

        {/* Title */}
        <div className="mb-4">
          <label className="block text-xs font-medium text-slate-400 mb-1">{t('createTitleLabel')}</label>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder={t('createTitlePlaceholder')}
            className="w-full rounded-lg px-3 py-2 text-sm bg-slate-800 border border-slate-600 text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        {/* Project */}
        {projects.length > 0 && (
          <div className="mb-4">
            <label className="block text-xs font-medium text-slate-400 mb-1">{t('createProjectLabel')}</label>
            <select
              value={projectId}
              onChange={e => setProjectId(e.target.value)}
              className="w-full rounded-lg px-3 py-2 text-sm bg-slate-800 border border-slate-600 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="">{t('createProjectNone')}</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Duration */}
        <div className="mb-5">
          <label className="block text-xs font-medium text-slate-400 mb-1">{t('createDurationLabel')}</label>
          <select
            value={duration}
            onChange={e => setDuration(Number(e.target.value))}
            className="w-full rounded-lg px-3 py-2 text-sm bg-slate-800 border border-slate-600 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            {[15, 20, 30, 45, 60].map(d => (
              <option key={d} value={d}>{d} {t('minutes')}</option>
            ))}
          </select>
        </div>

        {error && <p className="text-red-400 text-xs mb-3">{error}</p>}

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2 text-sm rounded-lg border border-slate-600 text-slate-400 hover:bg-slate-800"
          >
            {t('cancel')}
          </button>
          <button
            onClick={handleCreate}
            disabled={loading}
            className="flex-1 py-2 text-sm rounded-lg bg-violet-600 hover:bg-violet-500 text-white font-semibold disabled:opacity-50"
          >
            {loading ? t('creating') : t('createBtn')}
          </button>
        </div>
      </div>
    </div>
  );
}
