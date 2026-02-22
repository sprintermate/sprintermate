import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';

export default function Hero() {
  const t = useTranslations('hero');

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-16">
      {/* Gradient background orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-violet-600/20 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-900/10 rounded-full blur-3xl" />
      </div>

      {/* Subtle grid pattern */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                            linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
          backgroundSize: '40px 40px',
        }}
      />

      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-400 text-sm font-medium mb-8">
          <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
          {t('badge')}
        </div>

        {/* Headline */}
        <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight text-white whitespace-pre-line mb-6">
          {t('headline')}
        </h1>

        {/* Subheadline */}
        <p className="text-lg sm:text-xl text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
          {t('subheadline')}
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/dashboard"
            className="group w-full sm:w-auto px-8 py-4 rounded-xl border border-slate-700 bg-slate-900 hover:bg-slate-800 hover:border-slate-600 text-white font-medium text-base transition-all duration-200"
          >
            {t('ctaJoin')}
            <span className="ml-2 opacity-0 group-hover:opacity-100 transition-opacity">→</span>
          </Link>
          <Link
            href="/dashboard"
            className="group w-full sm:w-auto px-8 py-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-base transition-all duration-200 shadow-lg shadow-indigo-600/25 hover:shadow-indigo-500/40"
          >
            {t('ctaCreate')}
            <span className="ml-2 inline-block group-hover:translate-x-1 transition-transform">→</span>
          </Link>
        </div>

        {/* Decorative Fibonacci cards */}
        <div className="mt-20 flex items-center justify-center gap-2 flex-wrap">
          {[1, 2, 3, 5, 8, 13, 21, 34, 55].map((n) => (
            <div
              key={n}
              className="w-12 h-16 rounded-lg border border-slate-700 bg-slate-900/80 flex items-center justify-center text-slate-300 font-bold text-sm hover:border-indigo-500 hover:text-indigo-400 hover:bg-indigo-500/10 transition-all duration-200 cursor-default"
            >
              {n}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
