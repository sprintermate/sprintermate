'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import LanguageSwitcher from './LanguageSwitcher';
import { ThemeToggle } from './ThemeProvider';

export default function Header() {
  const t = useTranslations('nav');

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-gray-200/60 bg-white/80 dark:border-slate-800/60 dark:bg-slate-950/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-cyan-600 dark:bg-indigo-600 flex items-center justify-center">
            <span className="text-white font-bold text-sm">SA</span>
          </div>
          <span className="font-semibold text-gray-900 dark:text-white">Sprintermate AI</span>
        </div>

        {/* CTAs + Language switcher */}
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="hidden sm:inline-flex px-4 py-2 text-sm text-gray-600 hover:text-gray-900 dark:text-slate-300 dark:hover:text-white transition-colors"
          >
            {t('joinRoom')}
          </Link>
          <Link
            href="/login"
            className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 dark:bg-indigo-600 dark:hover:bg-indigo-500 text-sm font-medium text-white transition-colors"
          >
            {t('createRoom')}
          </Link>
          <ThemeToggle />
          <LanguageSwitcher />
        </div>
      </div>
    </header>
  );
}
