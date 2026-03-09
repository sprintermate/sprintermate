import type { Metadata } from 'next';
import { setRequestLocale, getTranslations } from 'next-intl/server';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import DashboardClient from '../../../components/DashboardClient';
import LogoutButton from '../../../components/LogoutButton';
import AISettingsButton from '../../../components/AISettingsButton';
import { ThemeToggle } from '../../../components/ThemeProvider';

type Props = { params: Promise<{ locale: string }> };

interface UserSession {
  id: string;
  displayName: string;
  email: string;
}

async function getUser(cookieHeader: string): Promise<UserSession | null> {
  try {
    const res = await fetch(`${process.env.BACKEND_URL}/api/auth/me`, {
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
    const res = await fetch(`${process.env.BACKEND_URL}/api/projects`, {
      headers: { Cookie: cookieHeader },
      cache: 'no-store',
    });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

async function getRooms(cookieHeader: string) {
  try {
    const res = await fetch(`${process.env.BACKEND_URL}/api/rooms`, {
      headers: { Cookie: cookieHeader },
      cache: 'no-store',
    });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export default async function DashboardPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('dashboard');

  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();
  const user = await getUser(cookieHeader);

  if (!user) {
    redirect(`/${locale}/login`);
  }

  const [projects, rooms] = await Promise.all([
    getProjects(cookieHeader),
    getRooms(cookieHeader),
  ]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950">
      {/* Header */}
      <header className="border-b border-gray-200/60 bg-white/80 dark:border-slate-800/60 dark:bg-slate-950/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-cyan-600 dark:bg-indigo-600 flex items-center justify-center">
              <span className="text-white font-bold text-sm">SA</span>
            </div>
            <span className="font-semibold text-gray-900 dark:text-white">Sprintermate AI</span>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-cyan-600/30 border border-cyan-500/40 dark:bg-indigo-600/30 dark:border-indigo-500/40 flex items-center justify-center">
                <span className="text-cyan-700 dark:text-indigo-300 text-xs font-medium">
                  {user.displayName.charAt(0).toUpperCase()}
                </span>
              </div>
              <span className="text-gray-700 dark:text-slate-300 text-sm hidden sm:block">{user.displayName}</span>
            </div>

            <ThemeToggle />
            {process.env.NEXT_PUBLIC_IS_PRODUCTION_AI !== 'true' && <AISettingsButton />}
            <LogoutButton locale={locale} />
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Welcome */}
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            {t('welcome', { name: user.displayName })}
          </h1>
          <p className="text-gray-500 dark:text-slate-400 mt-1 text-sm">{user.email}</p>
        </div>

        <DashboardClient
          user={user}
          initialProjects={projects}
          initialRooms={rooms}
          locale={locale}
        />
      </main>
    </div>
  );
}
