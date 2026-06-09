import { NextRequest, NextResponse } from 'next/server';
import { currentUser, unauthorized } from '@/lib/auth';
import { audit, db, notify } from '@/lib/store';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = currentUser();
  if (!user) return unauthorized();
  const { tournaments, members } = db();
  const result = tournaments.map((t) => ({
    ...t,
    registered: t.participantIds.includes(user.id),
    participants: t.participantIds.map((id) => {
      const m = members.find((x) => x.id === id);
      return m ? { id: m.id, name: m.name, initials: m.initials, avatarColor: m.avatarColor, skillLevel: m.skillLevel } : null;
    }).filter(Boolean),
  }));
  return NextResponse.json({ tournaments: result });
}

export async function POST(req: NextRequest) {
  const user = currentUser();
  if (!user) return unauthorized();
  const { tournamentId, action } = await req.json();
  const t = db().tournaments.find((x) => x.id === tournamentId);
  if (!t) return NextResponse.json({ error: 'Turnier nicht gefunden' }, { status: 404 });
  if (t.status !== 'anmeldung') return NextResponse.json({ error: 'Anmeldung ist geschlossen' }, { status: 409 });

  if (action === 'register') {
    if (t.participantIds.includes(user.id)) return NextResponse.json({ error: 'Bereits angemeldet' }, { status: 409 });
    if (t.participantIds.length >= t.maxParticipants) return NextResponse.json({ error: 'Turnier ist ausgebucht' }, { status: 409 });
    t.participantIds.push(user.id);
    notify(user.id, 'Turnieranmeldung bestätigt 🏆', `Du bist für „${t.name}" angemeldet. Startgeld: ${t.fee} €`, 'tournament');
    audit(user.name, `Anmeldung ${t.name}`);
  } else if (action === 'unregister') {
    t.participantIds = t.participantIds.filter((id) => id !== user.id);
    audit(user.name, `Abmeldung ${t.name}`);
  }
  return NextResponse.json({ ok: true, participants: t.participantIds.length });
}
