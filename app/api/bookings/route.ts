import { NextRequest, NextResponse } from 'next/server';
import { currentUser, unauthorized } from '@/lib/auth';
import { validateBooking } from '@/lib/booking';
import { audit, db, notify, uid } from '@/lib/store';
import { Booking } from '@/lib/types';

export const dynamic = 'force-dynamic';

function enrich(b: Booking) {
  const { members, courts } = db();
  return {
    ...b,
    court: courts.find((c) => c.id === b.courtId),
    playerNames: b.players.map((id) => members.find((m) => m.id === id)?.name ?? 'Unbekannt'),
  };
}

export async function GET(req: NextRequest) {
  const user = currentUser();
  if (!user) return unauthorized();
  const mine = req.nextUrl.searchParams.get('mine') === '1';
  const date = req.nextUrl.searchParams.get('date');
  let list = db().bookings.slice();
  if (mine) {
    const today = new Date().toISOString().slice(0, 10);
    list = list.filter((b) => (b.memberId === user.id || b.players.includes(user.id)) && b.date >= today);
  }
  if (date) list = list.filter((b) => b.date === date);
  list.sort((a, b) => (a.date === b.date ? a.startHour - b.startHour : a.date.localeCompare(b.date)));
  return NextResponse.json({ bookings: list.map(enrich) });
}

export async function POST(req: NextRequest) {
  const user = currentUser();
  if (!user) return unauthorized();
  const body = await req.json();
  const { courtId, date, startHour, durationHours, players = [], guests = [], type = 'einzel', title } = body;

  const check = validateBooking(user.id, courtId, date, startHour, durationHours);
  if (!check.ok) {
    return NextResponse.json({ error: check.error, waitlistSuggested: check.waitlistSuggested ?? false }, { status: 409 });
  }

  const { settings } = db();
  const booking: Booking = {
    id: uid('b'),
    courtId,
    date,
    startHour,
    durationHours,
    memberId: user.id,
    players: Array.from(new Set([user.id, ...players])),
    guests: (guests as { name: string }[]).map((g) => ({
      name: g.name,
      fee: settings.guestFeePerHour * durationHours,
      paid: false,
    })),
    type,
    title,
    createdAt: new Date().toISOString(),
  };
  db().bookings.push(booking);
  audit(user.name, `Buchung ${booking.id}: ${courtId} am ${date} um ${startHour}:00`);

  const court = db().courts.find((c) => c.id === courtId);
  const time = `${String(Math.floor(startHour)).padStart(2, '0')}:${startHour % 1 ? '30' : '00'}`;
  notify(user.id, 'Buchung bestätigt ✅', `${court?.name}, ${date} um ${time} Uhr`, 'booking');
  for (const p of booking.players.filter((p) => p !== user.id)) {
    notify(p, 'Neues Spiel 🎾', `${user.name} hat dich für ${court?.name} am ${date} um ${time} Uhr eingetragen.`, 'booking');
  }

  return NextResponse.json({ booking: enrich(booking) }, { status: 201 });
}
