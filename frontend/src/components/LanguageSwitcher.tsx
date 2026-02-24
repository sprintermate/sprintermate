'use client';

import { useLocale } from 'next-intl';
import { useRouter, usePathname } from '@/i18n/navigation';
import { useTransition } from 'react';

export default function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  function switchLocale(next: string) {
    startTransition(() => {
      router.replace(pathname, { locale: next });
    });
  }

  return (
    <div className="flex items-center gap-1 rounded-full border border-gray-200 dark:border-slate-700 p-1">
      {(['en', 'tr'] as const).map((lang) => (
        <button
          key={lang}
          onClick={() => switchLocale(lang)}
          disabled={isPending}
          className={`px-3 py-1 rounded-full text-sm font-medium transition-all duration-200 ${
            locale === lang
              ? 'bg-cyan-600 dark:bg-indigo-600 text-white'
              : 'text-gray-500 hover:text-gray-900 dark:text-slate-400 dark:hover:text-white'
          }`}
        >
          {lang.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
