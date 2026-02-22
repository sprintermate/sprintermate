import { setRequestLocale } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import RoomClient from '../../../../components/RoomClient';
import GuestJoinClient from '../../../../components/GuestJoinClient';

type Props = { params: Promise<{ locale: string; code: string }> };

const BACKEND = process.env.BACKEND_URL ?? 'http://localhost:4000';

interface UserSession {
  id: string;
  displayName: string;
  email: string;
}

interface RoomInfo {
  id: string;
  code: string;
  moderatorId: string;
  isModerator: boolean;
  projectName: string;
  organization: string;
  sprintName: string;
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

async function getRoom(code: string, cookieHeader: string): Promise<RoomInfo | null> {
  try {
    const res = await fetch(`${BACKEND}/api/rooms/${code}`, {
      headers: { Cookie: cookieHeader },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return res.json() as Promise<RoomInfo>;
  } catch {
    return null;
  }
}

export default async function RoomPage({ params }: Props) {
  const { locale, code } = await params;
  setRequestLocale(locale);

  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();

  const [user, room] = await Promise.all([
    getUser(cookieHeader),
    getRoom(code, cookieHeader),
  ]);

  // Room must exist
  if (!room) {
    // Redirect to dashboard for authenticated users, home for guests
    redirect(user ? `/${locale}/dashboard` : `/${locale}`);
  }

  // Authenticated user: full moderator/participant experience
  if (user) {
    return <RoomClient room={room} user={user} locale={locale} />;
  }

  // Unauthenticated: show guest name-entry form
  return <GuestJoinClient room={room} locale={locale} />;
}
