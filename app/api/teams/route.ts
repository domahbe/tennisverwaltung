import { NextResponse } from 'next/server';
import { currentUser, unauthorized } from '@/lib/auth';
import { db } from '@/lib/store';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!currentUser()) return unauthorized();
  const { teams, members } = db();
  const result = teams.map((t) => ({
    ...t,
    captain: members.find((m) => m.id === t.captainId)?.name ?? '–',
    players: t.playerIds.map((id) => {
      const m = members.find((x) => x.id === id);
      return m ? { id: m.id, name: m.name, initials: m.initials, avatarColor: m.avatarColor, skillLevel: m.skillLevel } : null;
    }).filter(Boolean),
  }));
  return NextResponse.json({ teams: result });
}
