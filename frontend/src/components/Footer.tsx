import { useTranslations } from 'next-intl';

export default function Footer() {
  const t = useTranslations('footer');
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-gray-200/50 dark:border-slate-800/50 py-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-cyan-600 dark:bg-indigo-600 flex items-center justify-center">
            <span className="text-white font-bold text-xs">SP</span>
          </div>
          <span className="text-gray-500 dark:text-slate-400 text-sm">{t('tagline')}</span>
        </div>
        <p className="text-gray-400 dark:text-slate-500 text-sm">
          &copy; {year} Scrum Poker. {t('rights')}
        </p>
      </div>
    </footer>
  );
}
