'use client';

import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useTranslations } from 'next-intl';

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? '';

const DEFAULT_TEMPLATE = `# Business Analysis Agent

## Purpose
You are a Senior Business Analyst. When a user describes a business requirement (via text, PDF context, or repository objects), produce a structured Markdown analysis document.

## Rules
- Think like a Business Analyst, NOT a developer
- Do NOT write code, SQL, or technical implementations
- Use analyst language: short, clear, actionable
- Only reference DB objects found in the repo context; never invent names

## Output Format

Respond ONLY with the following Markdown structure:

# Requirement Summary

[Short description of the business problem and objective]

---

# Affected Screens / Modules

- [Screen or module name]

---

# DB Objects

## Tables
- [Table name — from repo context only, or: *Not detected*]

## Stored Procedures
- [SP name — from repo context only, or: *Not detected*]

---

# Requested Change

- [Business-level description of each change]

---

# Impact Analysis

- [Affected module or flow]
- [Potential risk]
- [Dependencies]

---

# Test Cases

## Positive Scenarios
- [Happy path scenario]

## Negative Scenarios
- [Error or rejection scenario]

## Edge Cases
- [Boundary condition]
`;

interface AgentPrompt {
  id: string;
  name: string;
  markdown: string;
  created_at: string;
  updated_at: string;
}

interface Props {
  onClose: () => void;
}

export default function AgentPromptsModal({ onClose }: Props) {
  const t = useTranslations('agentPrompts');

  const [agents, setAgents] = useState<AgentPrompt[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [markdown, setMarkdown] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle');

  const isNew = selectedId === '__new__';
  const selectedAgent = agents.find(a => a.id === selectedId);

  const fetchAgents = useCallback(async () => {
    try {
      const res = await fetch(`${BACKEND}/api/agent-prompts`, { credentials: 'include' });
      if (res.ok) setAgents(await res.json());
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchAgents(); }, [fetchAgents]);

  // Sync editor when selection changes
  useEffect(() => {
    if (isNew) {
      setName('');
      setMarkdown('');
    } else if (selectedAgent) {
      setName(selectedAgent.name);
      setMarkdown(selectedAgent.markdown);
    }
    setSaveStatus('idle');
  }, [selectedId]);

  const handleNew = () => {
    setSelectedId('__new__');
  };

  const handleSave = async () => {
    if (!name.trim() || !markdown.trim()) return;
    setSaving(true);
    setSaveStatus('idle');
    try {
      if (isNew) {
        const res = await fetch(`${BACKEND}/api/agent-prompts`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: name.trim(), markdown: markdown.trim() }),
        });
        if (res.ok) {
          const created = await res.json();
          setAgents(prev => [created, ...prev]);
          setSelectedId(created.id);
          setSaveStatus('saved');
        } else {
          setSaveStatus('error');
        }
      } else if (selectedId) {
        const res = await fetch(`${BACKEND}/api/agent-prompts/${selectedId}`, {
          method: 'PUT',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: name.trim(), markdown: markdown.trim() }),
        });
        if (res.ok) {
          const updated = await res.json();
          setAgents(prev => prev.map(a => a.id === selectedId ? updated : a));
          setSaveStatus('saved');
        } else {
          setSaveStatus('error');
        }
      }
    } catch {
      setSaveStatus('error');
    }
    setSaving(false);
    if (saveStatus !== 'error') {
      setTimeout(() => setSaveStatus('idle'), 2500);
    }
  };

  const handleDelete = async () => {
    if (!selectedId || isNew) return;
    if (!confirm(t('deleteConfirm'))) return;
    setDeleting(true);
    try {
      await fetch(`${BACKEND}/api/agent-prompts/${selectedId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      setAgents(prev => prev.filter(a => a.id !== selectedId));
      setSelectedId(null);
    } catch { /* ignore */ }
    setDeleting(false);
  };

  const modal = (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 flex w-full max-w-5xl h-[80vh] mx-4 bg-slate-900 border border-white/[0.08] rounded-2xl shadow-2xl shadow-black/60 overflow-hidden">

        {/* ── Left Panel: Agent List ─────────────────────────────── */}
        <div className="w-64 flex-shrink-0 flex flex-col border-r border-white/[0.06] bg-slate-950/60">
          <div className="p-4 border-b border-white/[0.06]">
            <h2 className="text-sm font-semibold text-white mb-3">{t('title')}</h2>
            <button
              onClick={handleNew}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-violet-600 hover:bg-violet-500 text-white text-xs font-medium rounded-xl transition-all"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              {t('new')}
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
            {agents.length === 0 && !isNew ? (
              <p className="text-xs text-slate-600 text-center py-8 px-3">{t('noAgents')}</p>
            ) : (
              agents.map(agent => (
                <button
                  key={agent.id}
                  onClick={() => setSelectedId(agent.id)}
                  className={`w-full text-left px-3 py-2.5 rounded-xl text-xs transition-all ${
                    selectedId === agent.id
                      ? 'bg-violet-500/15 text-violet-300 ring-1 ring-violet-500/20'
                      : 'hover:bg-white/[0.04] text-slate-400 hover:text-slate-300'
                  }`}
                >
                  <div className="font-medium truncate">{agent.name}</div>
                  <div className="text-[10px] text-slate-600 mt-0.5">
                    {new Date(agent.updated_at).toLocaleDateString()}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* ── Right Panel: Editor ─────────────────────────────────── */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.06]">
            <h3 className="text-sm font-semibold text-white">
              {isNew ? t('newAgentTitle') : selectedAgent ? selectedAgent.name : t('selectAgent')}
            </h3>
            <button onClick={onClose} className="w-8 h-8 rounded-lg bg-white/[0.04] flex items-center justify-center text-slate-400 hover:text-white transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {(isNew || selectedAgent) ? (
            <>
              {/* Name */}
              <div className="px-5 pt-4 pb-2">
                <label className="block text-xs font-medium text-slate-400 mb-1.5">{t('name')}</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => { setName(e.target.value); setSaveStatus('idle'); }}
                  placeholder={t('namePlaceholder')}
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20 transition-all"
                />
              </div>

              {/* Load default template button */}
              <div className="px-5 pb-2 flex items-center justify-between">
                <label className="block text-xs font-medium text-slate-400">{t('markdownContent')}</label>
                <button
                  onClick={() => { setMarkdown(DEFAULT_TEMPLATE); setSaveStatus('idle'); }}
                  className="text-xs text-violet-400 hover:text-violet-300 transition-colors flex items-center gap-1"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  {t('loadDefault')}
                </button>
              </div>

              {/* Markdown editor */}
              <div className="flex-1 px-5 pb-4 min-h-0">
                <textarea
                  value={markdown}
                  onChange={e => { setMarkdown(e.target.value); setSaveStatus('idle'); }}
                  placeholder={t('markdownPlaceholder')}
                  className="w-full h-full bg-slate-950/60 border border-white/[0.08] rounded-xl px-4 py-3 text-xs text-slate-200 placeholder-slate-700 font-mono focus:outline-none focus:border-violet-500/40 focus:ring-1 focus:ring-violet-500/20 resize-none transition-all leading-relaxed"
                />
              </div>

              {/* Footer actions */}
              <div className="px-5 py-3 border-t border-white/[0.06] flex items-center justify-between">
                <div>
                  {!isNew && (
                    <button
                      onClick={handleDelete}
                      disabled={deleting}
                      className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 transition-colors disabled:opacity-50"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      {t('delete')}
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  {saveStatus === 'saved' && (
                    <span className="text-xs text-emerald-400 flex items-center gap-1">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      {t('saved')}
                    </span>
                  )}
                  {saveStatus === 'error' && (
                    <span className="text-xs text-red-400">{t('saveError')}</span>
                  )}
                  <button
                    onClick={handleSave}
                    disabled={saving || !name.trim() || !markdown.trim()}
                    className="flex items-center gap-1.5 px-4 py-1.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-medium rounded-xl transition-all"
                  >
                    {saving ? (
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                    {t('save')}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-slate-600 text-sm">
              {t('selectAgentOrNew')}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return typeof window !== 'undefined' ? createPortal(modal, document.body) : null;
}
