import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import AnalysisChatClient from '../../../../components/AnalysisChatClient';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

type Props = { params: Promise<{ locale: string; id: string }> };

const BACKEND = process.env.BACKEND_URL ?? 'http://localhost:4000';

interface UserSession {
  id: string;
  displayName: string;
  email: string;
}

async function getUser(cookieHeader: string): Promise<UserSession | null> {
  try {
    const res = await fetch(`${BACKEND}/api/auth/me`, {
      headers: { Cookie: cookieHeader },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return res.json() as Promise<UserSession>;
  } catch {
    return null;
  }
}

async function getAnalysis(id: string, cookieHeader: string) {
  try {
    const res = await fetch(`${BACKEND}/api/analysis/${id}`, {
      headers: { Cookie: cookieHeader },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export default async function AnalysisPage({ params }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();

  const [user, doc] = await Promise.all([
    getUser(cookieHeader),
    getAnalysis(id, cookieHeader),
  ]);

  if (!doc) {
    redirect(`/${locale}/dashboard`);
  }

  // If user is not logged in, use guest userId
  const userId = user?.id ?? `guest:${Math.random().toString(36).slice(2, 10)}`;
  return <AnalysisChatClient initialDoc={doc} locale={locale} userId={userId} />;
}
