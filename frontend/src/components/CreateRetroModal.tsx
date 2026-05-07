'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { RETRO_FORMATS } from '../lib/retroFormats';

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
  const [format, setFormat] = useState('start-stop-continue');
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
          format,
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
        className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-2xl mx-4 shadow-2xl max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold text-white mb-5">{t('createTitle')}</h2>

        {/* ── Row 1: Title + Duration + Project ── */}
        <div className="flex gap-3 mb-5">
          <div className="flex-1 min-w-0">
            <label className="block text-xs font-medium text-slate-400 mb-1">{t('createTitleLabel')}</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder={t('createTitlePlaceholder')}
              className="w-full rounded-lg px-3 py-2 text-sm bg-slate-800 border border-slate-600 text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <div className="w-28 flex-shrink-0">
            <label className="block text-xs font-medium text-slate-400 mb-1">{t('createDurationLabel')}</label>
            <select
              value={duration}
              onChange={e => setDuration(Number(e.target.value))}
              className="w-full rounded-lg px-3 py-2 text-sm bg-slate-800 border border-slate-600 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              {[15, 20, 30, 45, 60].map(d => (
                <option key={d} value={d}>{d} dk</option>
              ))}
            </select>
          </div>
          {projects.length > 0 && (
            <div className="w-40 flex-shrink-0">
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
        </div>

        {/* ── Format Picker: 3-column card grid ── */}
        <div className="mb-5">
          <label className="block text-xs font-medium text-slate-400 mb-2.5">{t('selectFormat')}</label>
          <div className="grid grid-cols-3 gap-2.5">
            {RETRO_FORMATS.map(f => {
              const isSelected = format === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFormat(f.id)}
                  className={`text-left p-3.5 rounded-xl border transition-all ${
                    isSelected
                      ? 'border-violet-500 bg-violet-900/30 ring-1 ring-violet-500/40'
                      : 'border-slate-700 bg-slate-800/50 hover:border-slate-500 hover:bg-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-xl">{f.emoji}</span>
                    <span className="text-xs font-bold text-white leading-tight">{t(f.nameKey)}</span>
                  </div>
                  <p className="text-[10px] text-slate-400 leading-snug mb-2">{t(f.descKey)}</p>
                  <div className="flex gap-1 flex-wrap">
                    {f.columns.map(c => (
                      <span
                        key={c.key}
                        className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${
                          isSelected ? 'bg-violet-800/60 text-violet-200' : 'bg-slate-700 text-slate-300'
                        }`}
                      >
                        {t(c.labelKey)}
                      </span>
                    ))}
                  </div>
                </button>
              );
            })}
          </div>
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
