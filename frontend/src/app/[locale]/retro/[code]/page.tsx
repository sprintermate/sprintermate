import { setRequestLocale } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import RetroBoard from '../../../../components/RetroBoard';
import GuestRetroJoinClient from '../../../../components/GuestRetroJoinClient';
import type { RetroSession } from '../../../../components/RetroBoard';

type Props = { params: Promise<{ locale: string; code: string }> };

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

async function getRetroSession(code: string, cookieHeader: string): Promise<RetroSession | null> {
  try {
    const res = await fetch(`${BACKEND}/api/retro/${code}`, {
      headers: { Cookie: cookieHeader },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return res.json() as Promise<RetroSession>;
  } catch {
    return null;
  }
}

export default async function RetroPage({ params }: Props) {
  const { locale, code } = await params;
  setRequestLocale(locale);

  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();

  const [user, session] = await Promise.all([
    getUser(cookieHeader),
    getRetroSession(code, cookieHeader),
  ]);

  if (!user) {
    // Unauthenticated: must have a valid session to join
    if (!session) {
      redirect(`/${locale}/`);
    }
    return <GuestRetroJoinClient session={session} locale={locale} />;
  }

  if (!session) {
    redirect(`/${locale}/dashboard`);
  }

  return <RetroBoard session={session} user={user} locale={locale} />;
}
