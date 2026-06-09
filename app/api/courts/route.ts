import { NextRequest, NextResponse } from 'next/server';
import { currentUser, unauthorized } from '@/lib/auth';
import { bookingsFor, slotStatus } from '@/lib/booking';
import { db, weatherFor } from '@/lib/store';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  if (!currentUser()) return unauthorized();
  const date = req.nextUrl.searchParams.get('date') ?? new Date().toISOString().slice(0, 10);
  const { courts, settings } = db();
  const weather = weatherFor(date);

  const result = courts.map((court) => {
    const hours: { hour: number; status: string }[] = [];
    for (let h = settings.openingHour; h < settings.closingHour; h++) {
      hours.push({ hour: h, status: slotStatus(court, date, h) });
    }
    const freeCount = hours.filter((s) => s.status === 'free' || s.status === 'soon').length;
    return {
      ...court,
      hours,
      freeCount,
      bookings: bookingsFor(court.id, date).map((b) => ({
        id: b.id,
        startHour: b.startHour,
        durationHours: b.durationHours,
        type: b.type,
        title: b.title,
        memberId: b.memberId,
        players: b.players,
        guests: b.guests.map((g) => ({ name: g.name })),
      })),
    };
  });

  return NextResponse.json({ courts: result, weather, settings });
}
