'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import ReactMarkdown from 'react-markdown';

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? '';

interface AnalysisDoc {
  id: string;
  title: string;
  pdf_filename: string;
  pdf_text: string;
  user_message: string | null;
  azure_repos: string | null;
  md_output: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

interface Props {
  doc: AnalysisDoc;
  locale: string;
}

export default function AnalysisDetailClient({ doc: initialDoc, locale }: Props) {
  const t = useTranslations('analysis');
  const router = useRouter();

  const [doc, setDoc] = useState(initialDoc);
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(doc.md_output ?? '');
  const [saving, setSaving] = useState(false);
  const [reanalyzing, setReanalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${BACKEND}/api/analysis/${doc.id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ md_output: editValue }),
      });
      if (!res.ok) throw new Error(t('errorSave'));
      const updated = await res.json();
      setDoc(updated);
      setEditing(false);
    } catch {
      setError(t('errorSave'));
    } finally {
      setSaving(false);
    }
  };

  const handleReanalyze = async () => {
    setReanalyzing(true);
    setError(null);
    try {
      const res = await fetch(`${BACKEND}/api/analysis/${doc.id}/reanalyze`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locale }),
      });
      if (!res.ok) {
        const body = await res.json() as { error?: string };
        throw new Error(body.error ?? t('errorReanalyze'));
      }
      const updated = await res.json();
      setDoc(updated);
      setEditValue(updated.md_output ?? '');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('errorReanalyze'));
    } finally {
      setReanalyzing(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(t('confirmDelete'))) return;
    try {
      const res = await fetch(`${BACKEND}/api/analysis/${doc.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) throw new Error(t('errorDelete'));
      router.push(`/${locale}/dashboard`);
    } catch {
      setError(t('errorDelete'));
    }
  };

  const statusColor = {
    pending: 'bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400',
    analyzing: 'bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-300',
    completed: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-300',
    error: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-300',
  }[doc.status] ?? 'bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400';

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 text-gray-900 dark:text-white">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => router.push(`/${locale}/dashboard`)}
            className="text-sm text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 transition-colors"
          >
            &larr; {t('backToDashboard')}
          </button>
          <span className={`text-xs px-2.5 py-1 rounded-full font-mono uppercase tracking-wide ${statusColor}`}>
            {t(`status_${doc.status}`)}
          </span>
        </div>

        {/* Title & metadata */}
        <h1 className="text-2xl font-bold mb-2">{doc.title}</h1>
        <div className="flex flex-wrap gap-4 text-xs text-gray-400 dark:text-slate-500 mb-6">
          <span>{t('pdfFile')}: <span className="font-mono text-gray-600 dark:text-slate-300">{doc.pdf_filename}</span></span>
          <span>{t('createdAt')}: {new Date(doc.created_at).toLocaleString()}</span>
          <span>{t('updatedAt')}: {new Date(doc.updated_at).toLocaleString()}</span>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2 mb-6">
          <button
            onClick={handleReanalyze}
            disabled={reanalyzing}
            className="px-4 py-2 text-sm rounded-lg bg-violet-600 hover:bg-violet-500 text-white font-medium disabled:opacity-50 transition-colors"
          >
            {reanalyzing ? t('reanalyzing') : t('reanalyze')}
          </button>
          {!editing && doc.md_output && (
            <button
              onClick={() => { setEditValue(doc.md_output ?? ''); setEditing(true); }}
              className="px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-slate-600 text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
            >
              {t('editOutput')}
            </button>
          )}
          <button
            onClick={handleDelete}
            className="px-4 py-2 text-sm rounded-lg border border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          >
            {t('delete')}
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Output area */}
        {editing ? (
          <div className="space-y-3">
            <textarea
              value={editValue}
              onChange={e => setEditValue(e.target.value)}
              rows={25}
              className="w-full rounded-xl px-4 py-3 text-sm bg-gray-100 dark:bg-slate-800 border border-gray-300 dark:border-slate-600 text-gray-900 dark:text-white font-mono focus:outline-none focus:ring-1 focus:ring-violet-500 resize-y"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setEditing(false)}
                className="px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-slate-600 text-gray-500 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-800"
              >
                {t('cancelEdit')}
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 text-sm rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium disabled:opacity-50 transition-colors"
              >
                {saving ? t('saving') : t('saveOutput')}
              </button>
            </div>
          </div>
        ) : doc.md_output ? (
          <div className="rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-6 prose prose-sm dark:prose-invert max-w-none
            prose-headings:text-gray-900 dark:prose-headings:text-white
            prose-h2:text-lg prose-h2:font-bold prose-h2:mt-6 prose-h2:mb-3
            prose-h3:text-base prose-h3:font-semibold prose-h3:mt-4 prose-h3:mb-2
            prose-li:text-gray-700 dark:prose-li:text-slate-300
            prose-strong:text-gray-900 dark:prose-strong:text-white
            prose-p:text-gray-700 dark:prose-p:text-slate-300">
            <ReactMarkdown>{doc.md_output}</ReactMarkdown>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-gray-200 dark:border-slate-800 p-12 text-center">
            <div className="w-12 h-12 rounded-xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">📄</span>
            </div>
            <p className="text-gray-400 dark:text-slate-500 text-sm">{t('noOutput')}</p>
          </div>
        )}
      </div>
    </div>
  );
}
