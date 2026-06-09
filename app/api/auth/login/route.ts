import { NextRequest, NextResponse } from 'next/server';
import { createSession, sessionCookieName } from '@/lib/auth';
import { audit, db } from '@/lib/store';

export async function POST(req: NextRequest) {
  const { memberId } = await req.json();
  const member = db().members.find((m) => m.id === memberId);
  if (!member) return NextResponse.json({ error: 'Unbekanntes Mitglied' }, { status: 401 });

  audit(member.name, 'Anmeldung');
  const res = NextResponse.json({
    user: {
      id: member.id,
      name: member.name,
      role: member.role,
      initials: member.initials,
      avatarColor: member.avatarColor,
      skillLevel: member.skillLevel,
    },
  });
  res.cookies.set(sessionCookieName(), createSession(member.id), {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
