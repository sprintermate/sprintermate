'use client';

import { useState, FormEvent } from 'react';
import { useTranslations } from 'next-intl';

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? '';

interface Props {
  locale: string;
}

export default function RegisterForm({ locale }: Props) {
  const t = useTranslations('register');

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError(t('error.weak_password'));
      return;
    }
    if (password !== confirmPassword) {
      setError(t('error.password_mismatch'));
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`${BACKEND}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password, displayName }),
      });

      if (res.status === 201) {
        window.location.href = `/${locale}/dashboard`;
        return;
      }

      if (res.status === 409) {
        setError(t('error.email_taken'));
      } else {
        setError(t('error.unknown'));
      }
    } catch {
      setError(t('error.unknown'));
    } finally {
      setLoading(false);
    }
  }

  const inputClass =
    'w-full px-4 py-2.5 rounded-lg bg-gray-100 border border-gray-300 text-gray-900 placeholder-gray-400 dark:bg-slate-800 dark:border-slate-700 dark:text-white dark:placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 dark:focus:ring-indigo-500 focus:border-transparent transition';
  const labelClass = 'block text-sm font-medium text-gray-700 dark:text-slate-300';

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-2">
        <label htmlFor="displayName" className={labelClass}>
          {t('displayNameLabel')}
        </label>
        <input
          id="displayName"
          type="text"
          autoComplete="name"
          required
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder={t('displayNamePlaceholder')}
          className={inputClass}
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="email" className={labelClass}>
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
        <label htmlFor="password" className={labelClass}>
          {t('passwordLabel')}
        </label>
        <input
          id="password"
          type="password"
          autoComplete="new-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={t('passwordPlaceholder')}
          className={inputClass}
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="confirmPassword" className={labelClass}>
          {t('confirmPasswordLabel')}
        </label>
        <input
          id="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder={t('confirmPasswordPlaceholder')}
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
        {loading ? t('submitting') : t('submit')}
      </button>
    </form>
  );
}
