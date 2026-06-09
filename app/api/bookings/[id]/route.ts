import { NextResponse } from 'next/server';
import { currentUser, forbidden, unauthorized } from '@/lib/auth';
import { overlaps } from '@/lib/booking';
import { audit, db, notify } from '@/lib/store';

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const user = currentUser();
  if (!user) return unauthorized();

  const store = db();
  const idx = store.bookings.findIndex((b) => b.id === params.id);
  if (idx === -1) return NextResponse.json({ error: 'Buchung nicht gefunden' }, { status: 404 });
  const booking = store.bookings[idx];
  if (booking.memberId !== user.id && user.role !== 'admin') return forbidden();

  store.bookings.splice(idx, 1);
  audit(user.name, `Buchung ${booking.id} storniert`);

  // Warteliste informieren: passende Einträge benachrichtigen
  const matches = store.waitlist.filter(
    (w) =>
      w.date === booking.date &&
      (w.courtId === null || w.courtId === booking.courtId) &&
      overlaps(booking, w.startHour, 1),
  );
  for (const w of matches) {
    const court = store.courts.find((c) => c.id === booking.courtId);
    notify(w.memberId, 'Wartelistenplatz frei 🎉', `${court?.name} am ${w.date} um ${w.startHour}:00 Uhr ist jetzt frei.`, 'waitlist');
    store.waitlist = store.waitlist.filter((x) => x.id !== w.id);
  }

  return NextResponse.json({ ok: true });
}
