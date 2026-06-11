import { db, weatherFor } from './store';
import { Booking, Court } from './types';

export type SlotStatus = 'free' | 'soon' | 'busy' | 'blocked' | 'past';

export function overlaps(b: Booking, startHour: number, durationHours: number): boolean {
  return startHour < b.startHour + b.durationHours && b.startHour < startHour + durationHours;
}

export function bookingsFor(courtId: string, date: string): Booking[] {
  return db()
    .bookings.filter((b) => b.courtId === courtId && b.date === date)
    .sort((a, b) => a.startHour - b.startHour);
}

export function slotStatus(court: Court, date: string, hour: number, now = new Date(), playable?: boolean): SlotStatus {
  if (court.blocked) return 'blocked';
  if (!court.indoor && !(playable ?? weatherFor(date).playable)) return 'blocked';
  const todayIso = now.toISOString().slice(0, 10);
  const nowHour = now.getHours() + now.getMinutes() / 60;
  if (date < todayIso || (date === todayIso && hour + 1 <= nowHour)) return 'past';
  const taken = bookingsFor(court.id, date).some((b) => overlaps(b, hour, 1));
  if (taken) return 'busy';
  // "bald belegt": freier Slot, der in weniger als 2 Stunden beginnt oder direkt vor einer Buchung endet
  if (date === todayIso && hour - nowHour < 2) return 'soon';
  return 'free';
}

export interface ValidationResult {
  ok: boolean;
  error?: string;
  waitlistSuggested?: boolean;
}

export function validateBooking(
  memberId: string,
  courtId: string,
  date: string,
  startHour: number,
  durationHours: number,
): ValidationResult {
  const { settings, bookings, courts, members } = db();
  const court = courts.find((c) => c.id === courtId);
  const member = members.find((m) => m.id === memberId);
  if (!court) return { ok: false, error: 'Platz nicht gefunden' };
  if (!member) return { ok: false, error: 'Mitglied nicht gefunden' };
  if (member.status === 'gesperrt') return { ok: false, error: 'Dein Konto ist gesperrt' };
  if (court.blocked) return { ok: false, error: `${court.name} ist gesperrt (${court.blockedReason ?? 'Wartung'})` };

  if (durationHours > settings.maxBookingHours && member.role === 'member')
    return { ok: false, error: `Maximale Buchungsdauer: ${settings.maxBookingHours} Stunden` };
  if (startHour < settings.openingHour || startHour + durationHours > settings.closingHour)
    return { ok: false, error: `Buchbar von ${settings.openingHour}:00 bis ${settings.closingHour}:00 Uhr` };

  const todayIso = new Date().toISOString().slice(0, 10);
  if (date < todayIso) return { ok: false, error: 'Datum liegt in der Vergangenheit' };

  const conflict = bookings.find((b) => b.courtId === courtId && b.date === date && overlaps(b, startHour, durationHours));
  if (conflict) return { ok: false, error: 'Der Platz ist in diesem Zeitraum bereits belegt', waitlistSuggested: true };

  if (member.role === 'member') {
    const active = bookings.filter((b) => b.memberId === memberId && b.date >= todayIso && b.type !== 'training');
    if (active.length >= settings.maxActiveBookingsPerMember)
      return { ok: false, error: `Buchungslimit erreicht (max. ${settings.maxActiveBookingsPerMember} aktive Buchungen)` };
  }

  return { ok: true };
}
