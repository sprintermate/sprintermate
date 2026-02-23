import { useTranslations } from 'next-intl';

const STEP_KEYS = ['connect', 'calibrate', 'create', 'vote'] as const;

export default function HowItWorks() {
  const t = useTranslations('howItWorks');

  return (
    <section id="how-it-works" className="py-24 sm:py-32 border-t border-slate-800/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <p className="text-sm font-semibold text-indigo-400 uppercase tracking-widest mb-3">
            {t('sectionLabel')}
          </p>
          <h2 className="text-3xl sm:text-4xl font-bold text-white">
            {t('sectionTitle')}
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {STEP_KEYS.map((key, index) => (
            <div key={key} className="relative">
              {/* Connector line (not on last item) */}
              {index < STEP_KEYS.length - 1 && (
                <div className="hidden lg:block absolute top-6 left-[calc(50%+24px)] right-0 h-px bg-gradient-to-r from-indigo-600/50 to-transparent" />
              )}
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-indigo-600/20 border border-indigo-500/40 text-indigo-400 font-bold text-lg mb-4">
                  {t(`steps.${key}.step`)}
                </div>
                <h3 className="text-base font-semibold text-white mb-2">
                  {t(`steps.${key}.title`)}
                </h3>
                <p className="text-sm text-slate-400 leading-relaxed">
                  {t(`steps.${key}.description`)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
