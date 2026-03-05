import { useTranslations } from 'next-intl';

export default function Integrations() {
  const t = useTranslations('integrations');

  const badges = [
    { label: t('azure'), icon: '☁️' },
    { label: t('ai'), icon: '🤖' },
    { label: t('websocket'), icon: '⚡' },
    { label: t('retro'), icon: '📝' },
  ];

  return (
    <section className="py-20 border-t border-gray-200/50 dark:border-slate-800/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <p className="text-sm font-semibold text-cyan-600 dark:text-indigo-400 uppercase tracking-widest mb-3">
          {t('sectionLabel')}
        </p>
        <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-12">
          {t('sectionTitle')}
        </h2>
        <div className="flex flex-wrap items-center justify-center gap-6">
          {badges.map((b) => (
            <div
              key={b.label}
              className="flex items-center gap-3 px-6 py-4 rounded-2xl border border-gray-200 bg-white/50 hover:border-gray-300 dark:border-slate-800 dark:bg-slate-900/50 dark:hover:border-slate-700 transition-all duration-200"
            >
              <span className="text-2xl">{b.icon}</span>
              <span className="text-gray-900 dark:text-white font-medium">{b.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
