import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';

import { cookies } from 'next/headers';
import AnalysisChatClient from '../../../components/AnalysisChatClient';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

type Props = { params: Promise<{ locale: string }> };

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

export default async function AnalysisNewPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();

  const user = await getUser(cookieHeader);
  // If user is not logged in, use guest userId
  const userId = user?.id ?? `guest:${Math.random().toString(36).slice(2, 10)}`;
  return <AnalysisChatClient locale={locale} userId={userId} />;
}
