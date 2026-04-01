import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import ForgotPasswordForm from '@/components/ForgotPasswordForm';

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const isEn = locale !== 'tr';
  return {
    title: isEn ? 'Forgot Password' : 'Şifremi Unuttum',
    description: isEn
      ? 'Reset your Sprintermate AI password.'
      : 'Sprintermate AI şifrenizi sıfırlayın.',
    robots: { index: false, follow: false },
  };
}

export default async function ForgotPasswordPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const isEn = locale !== 'tr';

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
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            {isEn ? 'Reset your password' : 'Şifrenizi sıfırlayın'}
          </h1>
          <p className="text-gray-500 dark:text-slate-400 text-sm leading-relaxed max-w-sm mx-auto">
            {isEn
              ? 'Enter your email and we\'ll send you a code to reset your password.'
              : 'E-posta adresinizi girin, şifrenizi sıfırlamak için bir kod gönderelim.'}
          </p>
        </div>

        {/* Forgot password card */}
        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-8 space-y-6 shadow-xl">
          <ForgotPasswordForm locale={locale} />
          <p className="text-center text-gray-400 dark:text-slate-500 text-sm">
            <Link href="/login" locale={locale} className="text-cyan-600 hover:text-cyan-500 dark:text-indigo-400 dark:hover:text-indigo-300 underline underline-offset-2">
              {isEn ? 'Back to Sign In' : 'Girişe Dön'}
            </Link>
          </p>
        </div>

        <p className="text-center text-gray-400 dark:text-slate-600 text-xs">
          Sprintermate AI — AI-Powered Agile
        </p>
      </div>
    </div>
  );
}
