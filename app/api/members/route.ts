import { NextRequest, NextResponse } from 'next/server';
import { currentUser, unauthorized } from '@/lib/auth';
import { db } from '@/lib/store';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const user = currentUser();
  if (!user) return unauthorized();
  const q = (req.nextUrl.searchParams.get('q') ?? '').toLowerCase();
  const me = db().members.find((m) => m.id === user.id);
  const list = db()
    .members.filter((m) => m.name.toLowerCase().includes(q) || m.skillLevel.toLowerCase().includes(q))
    .map((m) => ({
      id: m.id,
      name: m.name,
      initials: m.initials,
      avatarColor: m.avatarColor,
      skillLevel: m.skillLevel,
      teamId: m.teamId,
      role: m.role,
      status: m.status,
      lookingForPartner: m.lookingForPartner,
      isFavorite: me?.favorites.includes(m.id) ?? false,
      // Kontaktdaten nur für Admins (DSGVO: Datensparsamkeit)
      ...(user.role === 'admin' ? { email: m.email, phone: m.phone, memberSince: m.memberSince } : {}),
    }));
  return NextResponse.json({ members: list });
}
