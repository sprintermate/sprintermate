import { useTranslations } from 'next-intl';

const ICONS: Record<string, string> = {
  realtime: '⚡',
  ai: '🤖',
  devops: '☁️',
  fibonacci: '🃏',
  history: '📊',
  rooms: '🚪',
};

const FEATURE_KEYS = ['realtime', 'ai', 'devops', 'fibonacci', 'history', 'rooms'] as const;

export default function Features() {
  const t = useTranslations('features');

  return (
    <section id="features" className="py-24 sm:py-32">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <p className="text-sm font-semibold text-indigo-400 uppercase tracking-widest mb-3">
            {t('sectionLabel')}
          </p>
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            {t('sectionTitle')}
          </h2>
          <p className="text-lg text-slate-400 max-w-2xl mx-auto">
            {t('sectionSubtitle')}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURE_KEYS.map((key) => (
            <div
              key={key}
              className="group relative p-6 rounded-2xl border border-slate-800 bg-slate-900/50 hover:border-slate-700 hover:bg-slate-900 transition-all duration-300"
            >
              <div className="w-12 h-12 rounded-xl bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center text-2xl mb-4 group-hover:scale-110 transition-transform duration-300">
                {ICONS[key]}
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">
                {t(`items.${key}.title`)}
              </h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                {t(`items.${key}.description`)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
