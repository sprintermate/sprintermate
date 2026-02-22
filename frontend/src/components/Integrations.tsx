import { useTranslations } from 'next-intl';

export default function Integrations() {
  const t = useTranslations('integrations');

  const badges = [
    { label: t('azure'), icon: '☁️' },
    { label: t('ai'), icon: '🤖' },
    { label: t('websocket'), icon: '⚡' },
  ];

  return (
    <section className="py-20 border-t border-slate-800/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <p className="text-sm font-semibold text-indigo-400 uppercase tracking-widest mb-3">
          {t('sectionLabel')}
        </p>
        <h2 className="text-2xl sm:text-3xl font-bold text-white mb-12">
          {t('sectionTitle')}
        </h2>
        <div className="flex flex-wrap items-center justify-center gap-6">
          {badges.map((b) => (
            <div
              key={b.label}
              className="flex items-center gap-3 px-6 py-4 rounded-2xl border border-slate-800 bg-slate-900/50 hover:border-slate-700 transition-all duration-200"
            >
              <span className="text-2xl">{b.icon}</span>
              <span className="text-white font-medium">{b.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
