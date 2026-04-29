'use client';

import { useState, useEffect, FormEvent, useCallback } from 'react';
import { useTranslations } from 'next-intl';

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? '';

interface Props {
  locale: string;
}

export default function ForgotPasswordForm({ locale }: Props) {
  const t = useTranslations('forgotPassword');

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);

  // Countdown timer for code expiry
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  const handleSendCode = useCallback(async (e?: FormEvent<HTMLFormElement>) => {
    e?.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch(`${BACKEND}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      if (res.ok) {
        setStep(2);
        setCountdown(180);
      } else {
        setError(t('error.unknown'));
      }
    } catch {
      setError(t('error.network_error'));
    } finally {
      setLoading(false);
    }
  }, [email, t]);

  async function handleResetPassword(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 8) {
      setError(t('error.weak_password'));
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(t('error.password_mismatch'));
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`${BACKEND}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code, newPassword }),
      });

      if (res.ok) {
        setStep(3);
        return;
      }

      const data = await res.json();
      const errorKey = data.error as string;

      if (errorKey === 'invalid_code') {
        setError(t('error.invalid_code'));
      } else if (errorKey === 'expired_or_invalid') {
        setError(t('error.expired_or_invalid'));
      } else if (errorKey === 'too_many_attempts') {
        setError(t('error.too_many_attempts'));
      } else {
        setError(t('error.unknown'));
      }
    } catch {
      setError(t('error.network_error'));
    } finally {
      setLoading(false);
    }
  }

  const inputClass =
    'w-full px-4 py-2.5 rounded-lg bg-gray-100 border border-gray-300 text-gray-900 placeholder-gray-400 dark:bg-slate-800 dark:border-slate-700 dark:text-white dark:placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 dark:focus:ring-indigo-500 focus:border-transparent transition';
  const labelClass = 'block text-sm font-medium text-gray-700 dark:text-slate-300';

  // Step 3: Success
  if (step === 3) {
    return (
      <div className="space-y-5 text-center">
        <div className="w-16 h-16 mx-auto rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
          <svg className="w-8 h-8 text-emerald-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        </div>
        <p className="text-emerald-400 font-medium">{t('success')}</p>
        <a
          href={`/${locale}/login`}
          className="inline-block w-full py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white text-sm font-medium text-center transition-colors"
        >
          {t('backToLogin')}
        </a>
      </div>
    );
  }

  // Step 1: Email input
  if (step === 1) {
    return (
      <form onSubmit={handleSendCode} className="space-y-5">
        <div className="space-y-2">
          <label htmlFor="fp-email" className={labelClass}>
            {t('emailLabel')}
          </label>
          <input
            id="fp-email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t('emailPlaceholder')}
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
          {loading ? t('sending') : t('sendCode')}
        </button>
      </form>
    );
  }

  // Step 2: Code + new password
  return (
    <form onSubmit={handleResetPassword} className="space-y-5">
      {/* Info banner */}
      <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-lg px-4 py-3">
        <p className="text-sm text-indigo-300">{t('codeSent')}</p>
        {countdown > 0 && (
          <p className="text-xs text-indigo-400/70 mt-1">
            {t('timeRemaining', { seconds: countdown })}
          </p>
        )}
        {countdown === 0 && (
          <button
            type="button"
            onClick={() => { handleSendCode(); }}
            className="text-xs text-indigo-400 hover:text-indigo-300 underline underline-offset-2 mt-1"
          >
            {t('resendCode')}
          </button>
        )}
      </div>

      <div className="space-y-2">
        <label htmlFor="fp-code" className={labelClass}>
          {t('codeLabel')}
        </label>
        <input
          id="fp-code"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          required
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          placeholder={t('codePlaceholder')}
          className={`${inputClass} text-center tracking-[0.3em] text-lg font-mono`}
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="fp-newpassword" className={labelClass}>
          {t('newPasswordLabel')}
        </label>
        <input
          id="fp-newpassword"
          type="password"
          autoComplete="new-password"
          required
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder={t('newPasswordPlaceholder')}
          className={inputClass}
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="fp-confirmpassword" className={labelClass}>
          {t('confirmPasswordLabel')}
        </label>
        <input
          id="fp-confirmpassword"
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
        {loading ? t('resetting') : t('resetPassword')}
      </button>
    </form>
  );
}
