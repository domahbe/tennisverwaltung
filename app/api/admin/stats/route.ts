import { NextResponse } from 'next/server';
import { currentUser, forbidden, unauthorized } from '@/lib/auth';
import { db } from '@/lib/store';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = currentUser();
  if (!user) return unauthorized();
  if (user.role !== 'admin') return forbidden();

  const { bookings, courts, members, settings, auditLog } = db();
  const openHours = settings.closingHour - settings.openingHour;
  const today = new Date().toISOString().slice(0, 10);

  // Auslastung pro Platz (heute)
  const utilization = courts.map((c) => {
    const booked = bookings
      .filter((b) => b.courtId === c.id && b.date === today)
      .reduce((sum, b) => sum + b.durationHours, 0);
    return { courtId: c.id, name: c.name, percent: Math.round((booked / openHours) * 100), blocked: c.blocked };
  });

  // Beliebte Spielzeiten (alle Buchungen)
  const byHour: Record<number, number> = {};
  for (const b of bookings) {
    for (let h = Math.floor(b.startHour); h < b.startHour + b.durationHours; h++) {
      byHour[h] = (byHour[h] ?? 0) + 1;
    }
  }
  const popularHours = Object.entries(byHour)
    .map(([hour, count]) => ({ hour: Number(hour), count }))
    .sort((a, b) => a.hour - b.hour);
  const maxCount = Math.max(1, ...popularHours.map((p) => p.count));

  // Mitgliederaktivität
  const activity = members
    .map((m) => ({
      id: m.id,
      name: m.name,
      initials: m.initials,
      avatarColor: m.avatarColor,
      bookings: bookings.filter((b) => b.memberId === m.id || b.players.includes(m.id)).length,
    }))
    .sort((a, b) => b.bookings - a.bookings)
    .slice(0, 5);

  return NextResponse.json({
    utilization,
    popularHours: popularHours.map((p) => ({ ...p, percent: Math.round((p.count / maxCount) * 100) })),
    activity,
    totals: {
      members: members.length,
      activeMembers: members.filter((m) => m.status === 'aktiv').length,
      bookingsTotal: bookings.length,
      bookingsToday: bookings.filter((b) => b.date === today).length,
      guestsTotal: bookings.reduce((s, b) => s + b.guests.length, 0),
      guestFees: bookings.reduce((s, b) => s + b.guests.reduce((x, g) => x + g.fee, 0), 0),
    },
    auditLog: auditLog.slice(0, 20),
  });
}
