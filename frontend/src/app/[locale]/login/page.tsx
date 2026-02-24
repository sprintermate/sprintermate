import { getTranslations, setRequestLocale } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { Link } from '@/i18n/navigation';
import LoginForm from '@/components/LoginForm';

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function LoginPage({ params }: Props) {
  const { locale } = await params;
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-950 px-4">
      <div className="w-full max-w-md space-y-8">

        {/* Logo + heading */}
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="w-14 h-14 rounded-2xl bg-cyan-600/20 border border-cyan-500/30 dark:bg-indigo-600/20 dark:border-indigo-500/30 flex items-center justify-center">
              <div className="w-7 h-7 rounded-md bg-cyan-600 dark:bg-indigo-600 flex items-center justify-center">
                <span className="text-white font-bold text-xs">SP</span>
              </div>
            </div>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{t('title')}</h1>
          <p className="text-gray-500 dark:text-slate-400 text-sm leading-relaxed max-w-sm mx-auto">
            {t('description')}
          </p>
        </div>

        {/* Sign-in card */}
        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-8 space-y-6 shadow-xl">
          <LoginForm locale={locale} />
          <p className="text-center text-gray-400 dark:text-slate-500 text-sm">
            {t('noAccount')}{' '}
            <Link href="/register" locale={locale} className="text-cyan-600 hover:text-cyan-500 dark:text-indigo-400 dark:hover:text-indigo-300 underline underline-offset-2">
              {t('register')}
            </Link>
          </p>
        </div>

        <p className="text-center text-gray-400 dark:text-slate-600 text-xs">
          Scrum Poker — AI-Powered Sprint Planning
        </p>
      </div>
    </div>
  );
}
