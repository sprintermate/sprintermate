'use client';

import { useState, FormEvent } from 'react';
import { useTranslations } from 'next-intl';

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? '';

interface Props {
  locale: string;
}

export default function LoginForm({ locale }: Props) {
  const t = useTranslations('login');
  const tf = useTranslations('forgotPassword');

  // login state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // forgot-password mode
  const [mode, setMode] = useState<'login' | 'forgot'>('login');
  const [fpEmail, setFpEmail] = useState('');
  const [fpNewPassword, setFpNewPassword] = useState('');
  const [fpConfirmPassword, setFpConfirmPassword] = useState('');
  const [fpError, setFpError] = useState<string | null>(null);
  const [fpSuccess, setFpSuccess] = useState(false);
  const [fpLoading, setFpLoading] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch(`${BACKEND}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });

      if (res.ok) {
        window.location.href = `/${locale}/dashboard`;
        return;
      }

      if (res.status === 401) {
        setError(t('error.invalid_credentials'));
      } else {
        setError(t('error.unknown'));
      }
    } catch {
      setError(t('error.network_error'));
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFpError(null);

    if (fpNewPassword.length < 8) {
      setFpError(tf('error.weak_password'));
      return;
    }
    if (fpNewPassword !== fpConfirmPassword) {
      setFpError(tf('error.password_mismatch'));
      return;
    }

    setFpLoading(true);
    try {
      const res = await fetch(`${BACKEND}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: fpEmail, newPassword: fpNewPassword }),
      });

      if (res.ok) {
        setFpSuccess(true);
        return;
      }

      if (res.status === 404) {
        setFpError(tf('error.not_found'));
      } else {
        setFpError(tf('error.unknown'));
      }
    } catch {
      setFpError(tf('error.network_error'));
    } finally {
      setFpLoading(false);
    }
  }

  function openForgot() {
    setFpEmail(email);
    setFpNewPassword('');
    setFpConfirmPassword('');
    setFpError(null);
    setFpSuccess(false);
    setMode('forgot');
  }

  function backToLogin() {
    setMode('login');
    setFpError(null);
    setFpSuccess(false);
  }

  const inputClass =
    'w-full px-4 py-2.5 rounded-lg bg-gray-100 border border-gray-300 text-gray-900 placeholder-gray-400 dark:bg-slate-800 dark:border-slate-700 dark:text-white dark:placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 dark:focus:ring-indigo-500 focus:border-transparent transition';

  if (mode === 'forgot') {
    return (
      <div className="space-y-5">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-gray-800 dark:text-slate-200">{tf('title')}</p>
          <p className="text-xs text-gray-500 dark:text-slate-400">{tf('description')}</p>
        </div>

        {fpSuccess ? (
          <div className="space-y-4">
            <p className="text-sm text-emerald-600 bg-emerald-50 border border-emerald-200 dark:text-emerald-400 dark:bg-emerald-900/20 dark:border-emerald-800/40 rounded-lg px-4 py-2.5">
              {tf('success')}
            </p>
            <button
              type="button"
              onClick={backToLogin}
              className="w-full py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white text-sm font-medium transition-colors"
            >
              {tf('backToLogin')}
            </button>
          </div>
        ) : (
          <form onSubmit={handleForgotSubmit} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="fp-email" className="block text-sm font-medium text-gray-700 dark:text-slate-300">
                {tf('emailLabel')}
              </label>
              <input
                id="fp-email"
                type="email"
                autoComplete="email"
                required
                value={fpEmail}
                onChange={(e) => setFpEmail(e.target.value)}
                placeholder={tf('emailPlaceholder')}
                className={inputClass}
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="fp-new-password" className="block text-sm font-medium text-gray-700 dark:text-slate-300">
                {tf('newPasswordLabel')}
              </label>
              <input
                id="fp-new-password"
                type="password"
                autoComplete="new-password"
                required
                value={fpNewPassword}
                onChange={(e) => setFpNewPassword(e.target.value)}
                placeholder={tf('newPasswordPlaceholder')}
                className={inputClass}
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="fp-confirm-password" className="block text-sm font-medium text-gray-700 dark:text-slate-300">
                {tf('confirmPasswordLabel')}
              </label>
              <input
                id="fp-confirm-password"
                type="password"
                autoComplete="new-password"
                required
                value={fpConfirmPassword}
                onChange={(e) => setFpConfirmPassword(e.target.value)}
                placeholder={tf('confirmPasswordPlaceholder')}
                className={inputClass}
              />
            </div>

            {fpError && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 dark:text-red-400 dark:bg-red-900/20 dark:border-red-800/40 rounded-lg px-4 py-2.5">
                {fpError}
              </p>
            )}

            <button
              type="submit"
              disabled={fpLoading}
              className="w-full py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 dark:bg-indigo-600 dark:hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
            >
              {fpLoading ? tf('submitting') : tf('submit')}
            </button>

            <button
              type="button"
              onClick={backToLogin}
              className="w-full py-2 text-sm text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
            >
              {tf('backToLogin')}
            </button>
          </form>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-2">
        <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-slate-300">
          {t('emailLabel')}
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t('emailPlaceholder')}
          className={inputClass}
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-slate-300">
            {t('passwordLabel')}
          </label>
          <button
            type="button"
            onClick={openForgot}
            className="text-xs text-cyan-600 hover:text-cyan-500 dark:text-indigo-400 dark:hover:text-indigo-300 transition-colors"
          >
            {t('forgotPassword')}
          </button>
        </div>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={t('passwordPlaceholder')}
          className={inputClass}
        />
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 dark:text-red-400 dark:bg-red-900/20 dark:border-red-800/40 rounded-lg px-4 py-2.5">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 dark:bg-indigo-600 dark:hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
      >
        {loading ? t('signingIn') : t('signIn')}
      </button>
    </form>
  );
}
