import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import AnalysisPageClient from '../../../components/AnalysisPageClient';
import LogoutButton from '../../../components/LogoutButton';
import AISettingsButton from '../../../components/AISettingsButton';
import { ThemeToggle } from '../../../components/ThemeProvider';
import { Link } from '../../../i18n/navigation';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

type Props = { params: Promise<{ locale: string }> };

interface UserSession {
  id: string;
  displayName: string;
  email: string;
}

async function getUser(cookieHeader: string): Promise<UserSession | null> {
  try {
    const res = await fetch(`${process.env.BACKEND_URL ?? 'http://localhost:4000'}/api/auth/me`, {
      headers: { Cookie: cookieHeader },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return res.json() as Promise<UserSession>;
  } catch {
    return null;
  }
}

async function getProjects(cookieHeader: string) {
  try {
    const res = await fetch(`${process.env.BACKEND_URL ?? 'http://localhost:4000'}/api/projects`, {
      headers: { Cookie: cookieHeader },
      cache: 'no-store',
    });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export default async function AnalysisPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();
  const user = await getUser(cookieHeader);

  if (!user) {
    redirect(`/${locale}/login`);
  }

  const projects = await getProjects(cookieHeader);

  return (
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-slate-950 overflow-hidden">
      {/* Header */}
      <header className="shrink-0 border-b border-gray-200/60 bg-white/80 dark:border-slate-800/60 dark:bg-slate-950/80 backdrop-blur-md z-10">
        <div className="px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Back to dashboard */}
            <Link
              href="/dashboard"
              className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700 dark:text-slate-500 dark:hover:text-slate-200 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Dashboard
            </Link>

            <span className="text-gray-200 dark:text-slate-700">/</span>

            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-violet-600/20 border border-violet-500/30 flex items-center justify-center">
                <span className="text-violet-400 text-xs">🔍</span>
              </div>
              <span className="font-semibold text-sm text-gray-900 dark:text-white">Analysis Agent</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-cyan-600/30 border border-cyan-500/40 dark:bg-indigo-600/30 dark:border-indigo-500/40 flex items-center justify-center">
                <span className="text-cyan-700 dark:text-indigo-300 text-xs font-medium">
                  {user.displayName.charAt(0).toUpperCase()}
                </span>
              </div>
              <span className="text-gray-700 dark:text-slate-300 text-sm hidden sm:block">{user.displayName}</span>
            </div>
            <AISettingsButton />
            <ThemeToggle />
            <LogoutButton locale={locale} />
          </div>
        </div>
      </header>

      {/* Full-height client area */}
      <div className="flex-1 overflow-hidden">
        <AnalysisPageClient projects={projects} locale={locale} />
      </div>
    </div>
  );
}
