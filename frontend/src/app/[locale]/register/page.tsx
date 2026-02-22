import { getTranslations, setRequestLocale } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { Link } from '@/i18n/navigation';
import RegisterForm from '@/components/RegisterForm';

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function RegisterPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  // If the user already has a valid session, skip the register screen.
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
    // Backend unreachable — fall through and show the register page.
  }

  const t = await getTranslations('register');

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

        {/* Register card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 space-y-6 shadow-xl">
          <RegisterForm locale={locale} />
          <p className="text-center text-slate-500 text-sm">
            {t('hasAccount')}{' '}
            <Link href="/login" locale={locale} className="text-indigo-400 hover:text-indigo-300 underline underline-offset-2">
              {t('signIn')}
            </Link>
          </p>
        </div>

        <p className="text-center text-slate-600 text-xs">
          Scrum Poker — AI-Powered Sprint Planning
        </p>
      </div>
    </div>
  );
}
