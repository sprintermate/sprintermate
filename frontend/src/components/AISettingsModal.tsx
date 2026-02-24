'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslations } from 'next-intl';

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? '';

interface Provider {
  id: string;
  label: string;
  description: string;
  requiresKey: boolean;
  icon: string;
}


interface Props {
  onClose: () => void;
}

export default function AISettingsModal({ onClose }: Props) {
  const t = useTranslations('aiSettings');

  const PROVIDERS: Provider[] = [
    { id: 'copilot', label: 'GitHub Copilot', description: t('providerCopilotDesc'), requiresKey: false, icon: '🐙' },
    { id: 'claude',  label: 'Claude CLI',     description: t('providerClaudeDesc'),  requiresKey: false, icon: '🤖' },
    { id: 'codex',   label: 'Codex CLI',      description: t('providerCodexDesc'),   requiresKey: false, icon: '⚡' },
    { id: 'gemini',  label: 'Gemini',         description: t('providerGeminiDesc'),  requiresKey: true,  icon: '💎' },
    { id: 'chatgpt', label: 'ChatGPT',        description: t('providerChatGPTDesc'), requiresKey: true,  icon: '🧠' },
  ];

  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [hasExistingKey, setHasExistingKey] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [testStatus, setTestStatus] = useState<'idle' | 'ok' | 'error'>('idle');
  const [testError, setTestError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`${BACKEND}/api/ai/settings`, { credentials: 'include' });
        if (res.ok) {
          const data = await res.json() as { provider: string | null; hasApiKey: boolean };
          setSelectedProvider(data.provider);
          setHasExistingKey(data.hasApiKey);
        }
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  const currentProvider = PROVIDERS.find((p) => p.id === selectedProvider);
  const needsKey = currentProvider?.requiresKey ?? false;

  async function handleSave() {
    if (!selectedProvider) return;
    if (needsKey && !apiKey && !hasExistingKey) {
      setSaveError(t('errorRequiresKey'));
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const body: Record<string, string> = { provider: selectedProvider };
      if (apiKey) body.apiKey = apiKey;

      const res = await fetch(`${BACKEND}/api/ai/settings`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json() as { error?: string };
        throw new Error(data.error ?? 'Save failed');
      }
      setHasExistingKey(!!apiKey || hasExistingKey);
      setApiKey('');
      onClose();
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    if (!selectedProvider) return;
    if (needsKey && !apiKey && !hasExistingKey) {
      setTestError(t('errorEnterKeyToTest'));
      setTestStatus('error');
      return;
    }
    setTesting(true);
    setTestStatus('idle');
    setTestError(null);
    try {
      const body: Record<string, string> = { provider: selectedProvider };
      if (apiKey) body.apiKey = apiKey;

      const res = await fetch(`${BACKEND}/api/ai/test`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json() as { success: boolean; error?: string };
      if (data.success) {
        setTestStatus('ok');
      } else {
        setTestStatus('error');
        setTestError(data.error ?? 'Test failed');
      }
    } catch (err: unknown) {
      setTestStatus('error');
      setTestError(err instanceof Error ? err.message : 'Test failed');
    } finally {
      setTesting(false);
    }
  }

  function handleProviderChange(id: string) {
    setSelectedProvider(id);
    setApiKey('');
    setHasExistingKey(false);
    setTestStatus('idle');
    setTestError(null);
    setSaveError(null);
  }

  const modal = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/40 dark:bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-teal-600 to-cyan-600 dark:from-violet-600 dark:to-indigo-600 flex items-center justify-center shadow-lg shadow-teal-500/30 dark:shadow-violet-500/30">
              <span className="text-base">✨</span>
            </div>
            <div>
              <h2 className="text-gray-900 dark:text-white font-semibold text-base">{t('title')}</h2>
              <p className="text-gray-400 dark:text-slate-500 text-xs">{t('subtitle')}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 dark:text-slate-500 dark:hover:text-white transition-colors p-1"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-5 h-5 border-2 border-teal-500 dark:border-violet-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-slate-500">{t('selectProvider')}</p>

              <div className="space-y-2">
                {PROVIDERS.map((provider) => (
                  <button
                    key={provider.id}
                    onClick={() => handleProviderChange(provider.id)}
                    className={`w-full text-left rounded-xl border p-4 transition-all duration-150 ${
                      selectedProvider === provider.id
                        ? 'bg-teal-50 border-teal-400 ring-1 ring-teal-400/30 dark:bg-violet-600/20 dark:border-violet-500/50 dark:ring-violet-500/30'
                        : 'bg-gray-50 border-gray-200 hover:border-gray-300 hover:bg-gray-100 dark:bg-slate-800/50 dark:border-slate-700 dark:hover:border-slate-600 dark:hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-xl shrink-0 mt-0.5">{provider.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`font-medium text-sm ${selectedProvider === provider.id ? 'text-teal-700 dark:text-violet-200' : 'text-gray-800 dark:text-slate-200'}`}>
                            {provider.label}
                          </span>
                          {!provider.requiresKey && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-green-100 text-green-700 border border-green-200 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500/30 font-medium">
                              {t('badgeCli')}
                            </span>
                          )}
                          {provider.requiresKey && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-100 text-amber-700 border border-amber-200 dark:bg-amber-500/20 dark:text-amber-400 dark:border-amber-500/30 font-medium">
                              {t('badgeApiKey')}
                            </span>
                          )}
                        </div>
                        <p className="text-gray-500 dark:text-slate-500 text-xs mt-0.5 leading-relaxed">{provider.description}</p>
                      </div>
                      <div className={`w-4 h-4 rounded-full border-2 shrink-0 mt-0.5 flex items-center justify-center ${
                        selectedProvider === provider.id
                          ? 'border-teal-500 bg-teal-500 dark:border-violet-400 dark:bg-violet-500'
                          : 'border-gray-300 dark:border-slate-600'
                      }`}>
                        {selectedProvider === provider.id && (
                          <div className="w-1.5 h-1.5 rounded-full bg-white" />
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              {/* API Key input */}
              {selectedProvider && needsKey && (
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-slate-500 block">
                    {t('apiKeyLabel')}
                  </label>
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => { setApiKey(e.target.value); setTestStatus('idle'); }}
                    placeholder={hasExistingKey ? t('apiKeyPlaceholderSaved') : t('apiKeyPlaceholder')}
                    className="w-full px-3 py-2.5 rounded-lg bg-gray-100 border border-gray-300 text-gray-900 placeholder-gray-400 dark:bg-slate-800 dark:border-slate-700 dark:text-white dark:placeholder-slate-600 text-sm focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500/30 dark:focus:border-violet-500 dark:focus:ring-violet-500/30 transition"
                  />
                </div>
              )}

              {/* Test result */}
              {testStatus === 'ok' && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-50 border border-green-200 dark:bg-emerald-500/10 dark:border-emerald-500/20">
                  <svg className="w-4 h-4 text-green-600 dark:text-emerald-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-green-700 dark:text-emerald-400 text-sm">{t('connectionSuccessful')}</span>
                </div>
              )}
              {testStatus === 'error' && testError && (
                <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-red-50 border border-red-200 dark:bg-red-500/10 dark:border-red-500/20">
                  <svg className="w-4 h-4 text-red-500 dark:text-red-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-red-600 dark:text-red-400 text-sm">{testError}</span>
                </div>
              )}

              {saveError && (
                <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-red-50 border border-red-200 dark:bg-red-500/10 dark:border-red-500/20">
                  <svg className="w-4 h-4 text-red-500 dark:text-red-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-red-600 dark:text-red-400 text-sm">{saveError}</span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {!loading && (
          <div className="flex items-center gap-3 p-6 border-t border-gray-100 dark:border-slate-800 shrink-0">
            <button
              onClick={() => void handleTest()}
              disabled={!selectedProvider || testing}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-gray-100 hover:bg-gray-200 border border-gray-200 hover:border-gray-300 dark:bg-slate-800 dark:hover:bg-slate-700 dark:border-slate-700 dark:hover:border-slate-600 text-gray-600 dark:text-slate-300 text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {testing ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-gray-400 dark:border-slate-400 border-t-transparent rounded-full animate-spin" />
                  {t('testing')}
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {t('testConnection')}
                </>
              )}
            </button>

            <div className="flex-1" />

            <button
              onClick={onClose}
              className="px-4 py-2.5 rounded-lg bg-gray-100 hover:bg-gray-200 border border-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 dark:border-slate-700 text-gray-600 dark:text-slate-300 text-sm font-medium transition-colors"
            >
              {t('cancel')}
            </button>
            <button
              onClick={() => void handleSave()}
              disabled={!selectedProvider || saving}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-500 hover:to-cyan-500 dark:from-violet-600 dark:to-indigo-600 dark:hover:from-violet-500 dark:hover:to-indigo-500 text-white text-sm font-medium transition-all shadow-lg shadow-teal-500/25 dark:shadow-violet-500/25 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {saving ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  {t('saving')}
                </>
              ) : (
                t('saveSettings')
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
