import { setRequestLocale } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import DashboardClient from '../../../components/DashboardClient';
import LogoutButton from '../../../components/LogoutButton';
import AISettingsButton from '../../../components/AISettingsButton';

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
    <div className="min-h-screen bg-slate-950">
      {/* Header */}
      <header className="border-b border-slate-800/60 bg-slate-950/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
              <span className="text-white font-bold text-sm">SP</span>
            </div>
            <span className="font-semibold text-white">Scrum Poker</span>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center">
                <span className="text-indigo-300 text-xs font-medium">
                  {user.displayName.charAt(0).toUpperCase()}
                </span>
              </div>
              <span className="text-slate-300 text-sm hidden sm:block">{user.displayName}</span>
            </div>

            <AISettingsButton />
            <LogoutButton locale={locale} />
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Welcome */}
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-white">
            Welcome, {user.displayName}!
          </h1>
          <p className="text-slate-400 mt-1 text-sm">{user.email}</p>
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
