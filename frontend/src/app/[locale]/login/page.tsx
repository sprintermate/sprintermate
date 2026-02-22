import { getTranslations, setRequestLocale } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ error?: string }>;
};

function MicrosoftIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 21 21" width="20" height="20" aria-hidden="true">
      <rect x="1"  y="1"  width="9" height="9" fill="#F25022" />
      <rect x="11" y="1"  width="9" height="9" fill="#7FBA00" />
      <rect x="1"  y="11" width="9" height="9" fill="#00A4EF" />
      <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
    </svg>
  );
}

export default async function LoginPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const { error }  = await searchParams;
  setRequestLocale(locale);

  // If the user already has a valid session, skip the login screen.
  try {
    const cookieStore = await cookies();
    const res = await fetch(`${process.env.BACKEND_URL}/api/auth/me`, {
      headers: { Cookie: cookieStore.toString() },
      cache: 'no-store',
    });
    if (res.ok) {
      redirect(`/${locale}/dashboard`);
    }
  } catch {
    // Backend unreachable — fall through and show the login page.
  }
  const t = await getTranslations('login');

  // Map error code → localised message; fall back to 'unknown' for unrecognised codes.
  const errorMessage: string | null = error
    ? ((t.raw(`error.${error}`) as string | undefined) ?? t('error.unknown'))
    : null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-md space-y-8">

        {/* Logo + heading */}
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="w-14 h-14 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center">
              <div className="w-7 h-7 rounded-md bg-indigo-600 flex items-center justify-center">
                <span className="text-white font-bold text-xs">SP</span>
              </div>
            </div>
          </div>
          <h1 className="text-3xl font-bold text-white">{t('title')}</h1>
          <p className="text-slate-400 text-sm leading-relaxed max-w-sm mx-auto">
            {t('description')}
          </p>
        </div>

        {/* Sign-in card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 space-y-6 shadow-xl">
          {/* Error banner */}
          {errorMessage && (
            <div className="flex items-start gap-3 bg-red-950/50 border border-red-500/30 rounded-xl p-4">
              <svg className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <p className="text-red-300 text-sm">{errorMessage}</p>
            </div>
          )}

          <p className="text-center text-slate-300 text-sm">{t('subtitle')}</p>

          {/*
            IMPORTANT: This must be a plain <a> tag navigating to the backend,
            NOT a fetch() call. OAuth requires a full browser redirect so the
            backend can issue a 302 to Microsoft and the browser follows it.
          */}
          <a
            href={`${process.env.BACKEND_URL}/api/auth/login`}
            className="flex items-center justify-center gap-3 w-full px-4 py-3 rounded-xl bg-white hover:bg-slate-100 text-slate-800 font-medium text-sm transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-900"
          >
            <MicrosoftIcon />
            {t('signInWithMicrosoft')}
          </a>
        </div>

        <p className="text-center text-slate-600 text-xs">
          Scrum Poker — AI-Powered Sprint Planning
        </p>
      </div>
    </div>
  );
}
