import { setRequestLocale } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import SprintMetricsClient from '../../../../../../components/SprintMetricsClient';
import { ThemeToggle } from '../../../../../../components/ThemeProvider';
import LogoutButton from '../../../../../../components/LogoutButton';

type Props = { 
  params: Promise<{ locale: string; projectId: string; sprintId: string }> 
};

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

async function getProject(cookieHeader: string, projectId: string): Promise<Project | null> {
  try {
    const res = await fetch(`${process.env.BACKEND_URL}/api/projects`, {
      headers: { Cookie: cookieHeader },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const projects = await res.json() as Project[];
    return projects.find((p) => p.id === projectId) || null;
  } catch {
    return null;
  }
}

interface Project {
  id: string;
  name: string;
  organization: string;
  team: string | null;
  ado_url: string | null;
  hasPat?: boolean;
  created_at: string;
}

async function getSprint(cookieHeader: string, projectId: string, sprintId: string) {
  try {
    const res = await fetch(
      `${process.env.BACKEND_URL}/api/projects/${projectId}/sprints/${sprintId}`,
      {
        headers: { Cookie: cookieHeader },
        cache: 'no-store',
      }
    );
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export default async function SprintMetricsPage({ params }: Props) {
  const { locale, projectId, sprintId } = await params;
  setRequestLocale(locale);

  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();
  const user = await getUser(cookieHeader);

  if (!user) {
    redirect(`/${locale}/login`);
  }

  const [project, sprint] = await Promise.all([
    getProject(cookieHeader, projectId),
    getSprint(cookieHeader, projectId, sprintId),
  ]);

  if (!project) {
    redirect(`/${locale}/dashboard`);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950/20">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-gray-200/60 bg-white/80 dark:border-slate-800/60 dark:bg-slate-950/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <a
              href={`/${locale}/dashboard`}
              className="flex items-center gap-2 hover:opacity-80 transition-opacity"
            >
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-indigo-600 dark:from-indigo-500 dark:to-violet-600 flex items-center justify-center shadow-lg">
                <span className="text-white font-bold text-sm">SP</span>
              </div>
              <span className="font-semibold text-gray-900 dark:text-white">Scrum Poker</span>
            </a>
            
            <div className="hidden sm:flex items-center gap-2 text-sm text-gray-500 dark:text-slate-400">
              <span>/</span>
              <span className="font-medium text-gray-700 dark:text-slate-300">{project.name}</span>
              {sprint && (
                <>
                  <span>/</span>
                  <span className="font-medium text-indigo-600 dark:text-indigo-400">{sprint.name}</span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500/30 to-indigo-600/30 border border-cyan-500/40 dark:from-indigo-500/30 dark:to-violet-600/30 dark:border-indigo-500/40 flex items-center justify-center">
                <span className="text-cyan-700 dark:text-indigo-300 text-xs font-medium">
                  {user.displayName.charAt(0).toUpperCase()}
                </span>
              </div>
              <span className="text-gray-700 dark:text-slate-300 text-sm hidden md:block">
                {user.displayName}
              </span>
            </div>

            <ThemeToggle />
            <LogoutButton locale={locale} />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <SprintMetricsClient 
          projectId={projectId}
          sprintId={sprintId}
          sprintName={sprint?.name}
          locale={locale}
        />
      </main>
    </div>
  );
}
