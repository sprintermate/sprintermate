'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? '';

interface Props {
  locale: string;
  label?: string;
}

export default function LogoutButton({ locale, label = 'Sign out' }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);
    try {
      await fetch(`${BACKEND}/api/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch {
      // ignore network errors — clear session client-side anyway
    }
    router.push(`/${locale}`);
  }

  return (
    <button
      onClick={handleLogout}
      disabled={loading}
      className="px-3 py-1.5 rounded-lg border border-gray-300 text-gray-500 hover:text-gray-900 hover:border-gray-400 dark:border-slate-700 dark:text-slate-400 dark:hover:text-white dark:hover:border-slate-600 text-sm transition-colors disabled:opacity-50"
    >
      {label}
    </button>
  );
}
