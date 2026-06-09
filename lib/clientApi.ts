'use client';

import { bookingsFor, overlaps, slotStatus, validateBooking } from './booking';
import { audit, db, notify, uid, weatherFor } from './store';
import { Booking, SessionUser } from './types';

/**
 * Client-seitige API für den statischen Betrieb (GitHub Pages, PWA offline).
 * Spiegelt die REST-Endpunkte aus docs/API.md 1:1 – gleiche Pfade, gleiche
 * Antwortformate –, arbeitet aber auf der Demo-Datenbank im Browser und
 * persistiert sie in localStorage. In Produktion wird dieses Modul durch
 * echte fetch()-Aufrufe gegen Supabase/PostgreSQL ersetzt.
 */

const DB_KEY = 'tcgw_db_v2';
const SESSION_KEY = 'tcgw_session';

let hydrated = false;

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function hydrate() {
  if (hydrated || typeof window === 'undefined') return;
  hydrated = true;
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (raw) {
      const { day, data } = JSON.parse(raw);
      // Demo-Daten hängen am aktuellen Datum → täglich frisch seeden
      if (day === todayIso() && data?.members?.length) {
        (globalThis as unknown as { __tennisDb?: unknown }).__tennisDb = data;
        return;
      }
    }
  } catch {}
  db(); // seeden
  persist();
}

function persist() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(DB_KEY, JSON.stringify({ day: todayIso(), data: db() }));
  } catch {}
}

function sessionUser(): SessionUser | null {
  if (typeof window === 'undefined') return null;
  const id = localStorage.getItem(SESSION_KEY);
  if (!id) return null;
  const m = db().members.find((x) => x.id === id);
  if (!m) return null;
  return { id: m.id, name: m.name, role: m.role, initials: m.initials, avatarColor: m.avatarColor, skillLevel: m.skillLevel };
}

class ApiError extends Error {
  constructor(
    public status: number,
    public payload: Record<string, unknown>,
  ) {
    super(String(payload.error ?? status));
  }
}

const err = (status: number, error: string, extra: Record<string, unknown> = {}): never => {
  throw new ApiError(status, { error, ...extra });
};

function requireUser(): SessionUser {
  const u = sessionUser();
  if (!u) err(401, 'Nicht angemeldet');
  return u as SessionUser;
}

function enrichBooking(b: Booking) {
  const { members, courts } = db();
  return {
    ...b,
    court: courts.find((c) => c.id === b.courtId),
    playerNames: b.players.map((id) => members.find((m) => m.id === id)?.name ?? 'Unbekannt'),
  };
}

function fmtClock(h: number) {
  return `${String(Math.floor(h)).padStart(2, '0')}:${h % 1 ? '30' : '00'}`;
}

/* ---------------- Endpunkte ---------------- */

function handle(path: string, method: string, params: URLSearchParams, body: Record<string, any>): unknown {
  const store = db();

  if (path === '/api/auth/login' && method === 'POST') {
    const member = store.members.find((m) => m.id === body.memberId);
    if (!member) err(401, 'Unbekanntes Mitglied');
    localStorage.setItem(SESSION_KEY, member!.id);
    audit(member!.name, 'Anmeldung');
    return { user: sessionUser() };
  }

  if (path === '/api/auth/logout' && method === 'POST') {
    localStorage.removeItem(SESSION_KEY);
    return { ok: true };
  }

  if (path === '/api/auth/me') {
    const user = sessionUser();
    if (!user) err(401, 'Nicht angemeldet');
    return { user };
  }

  const user = requireUser();

  if (path === '/api/courts' && method === 'GET') {
    const date = params.get('date') ?? todayIso();
    const weather = weatherFor(date);
    const courts = store.courts.map((court) => {
      const hours: { hour: number; status: string }[] = [];
      for (let h = store.settings.openingHour; h < store.settings.closingHour; h++) {
        hours.push({ hour: h, status: slotStatus(court, date, h) });
      }
      return {
        ...court,
        hours,
        freeCount: hours.filter((s) => s.status === 'free' || s.status === 'soon').length,
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
    return { courts, weather, settings: store.settings };
  }

  const courtPatch = path.match(/^\/api\/courts\/([^/]+)$/);
  if (courtPatch && method === 'PATCH') {
    if (user.role !== 'admin' && user.role !== 'trainer') err(403, 'Keine Berechtigung');
    const court = store.courts.find((c) => c.id === courtPatch[1]);
    if (!court) err(404, 'Platz nicht gefunden');
    if (typeof body.blocked === 'boolean') {
      court!.blocked = body.blocked;
      court!.blockedReason = body.blocked ? (body.reason ?? 'Gesperrt') : undefined;
      court!.maintenanceUntil = body.blocked ? body.until : undefined;
      audit(user.name, `${court!.name} ${body.blocked ? 'gesperrt' : 'freigegeben'}`);
    }
    return { court };
  }

  if (path === '/api/bookings' && method === 'GET') {
    let list = store.bookings.slice();
    if (params.get('mine') === '1') {
      list = list.filter((b) => (b.memberId === user.id || b.players.includes(user.id)) && b.date >= todayIso());
    }
    const date = params.get('date');
    if (date) list = list.filter((b) => b.date === date);
    list.sort((a, b) => (a.date === b.date ? a.startHour - b.startHour : a.date.localeCompare(b.date)));
    return { bookings: list.map(enrichBooking) };
  }

  if (path === '/api/bookings' && method === 'POST') {
    const { courtId, date, startHour, durationHours, players = [], guests = [], type = 'einzel', title } = body;
    const check = validateBooking(user.id, courtId, date, startHour, durationHours);
    if (!check.ok) err(409, check.error!, { waitlistSuggested: check.waitlistSuggested ?? false });

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
        fee: store.settings.guestFeePerHour * durationHours,
        paid: false,
      })),
      type,
      title,
      createdAt: new Date().toISOString(),
    };
    store.bookings.push(booking);
    audit(user.name, `Buchung ${booking.id}: ${courtId} am ${date} um ${fmtClock(startHour)}`);

    const court = store.courts.find((c) => c.id === courtId);
    notify(user.id, 'Buchung bestätigt ✅', `${court?.name}, ${date} um ${fmtClock(startHour)} Uhr`, 'booking');
    for (const p of booking.players.filter((x) => x !== user.id)) {
      notify(p, 'Neues Spiel 🎾', `${user.name} hat dich für ${court?.name} am ${date} um ${fmtClock(startHour)} Uhr eingetragen.`, 'booking');
    }
    return { booking: enrichBooking(booking) };
  }

  const bookingDelete = path.match(/^\/api\/bookings\/([^/]+)$/);
  if (bookingDelete && method === 'DELETE') {
    const idx = store.bookings.findIndex((b) => b.id === bookingDelete[1]);
    if (idx === -1) err(404, 'Buchung nicht gefunden');
    const booking = store.bookings[idx];
    if (booking.memberId !== user.id && user.role !== 'admin') err(403, 'Keine Berechtigung');
    store.bookings.splice(idx, 1);
    audit(user.name, `Buchung ${booking.id} storniert`);

    const matches = store.waitlist.filter(
      (w) => w.date === booking.date && (w.courtId === null || w.courtId === booking.courtId) && overlaps(booking, w.startHour, 1),
    );
    for (const w of matches) {
      const court = store.courts.find((c) => c.id === booking.courtId);
      notify(w.memberId, 'Wartelistenplatz frei 🎉', `${court?.name} am ${w.date} um ${w.startHour}:00 Uhr ist jetzt frei.`, 'waitlist');
      store.waitlist = store.waitlist.filter((x) => x.id !== w.id);
    }
    return { ok: true };
  }

  if (path === '/api/waitlist' && method === 'POST') {
    const entry = {
      id: uid('w'),
      memberId: user.id,
      courtId: body.courtId ?? null,
      date: body.date,
      startHour: body.startHour,
      createdAt: new Date().toISOString(),
    };
    store.waitlist.push(entry);
    return { entry };
  }

  if (path === '/api/members' && method === 'GET') {
    const q = (params.get('q') ?? '').toLowerCase();
    const me = store.members.find((m) => m.id === user.id);
    return {
      members: store.members
        .filter((m) => m.name.toLowerCase().includes(q) || m.skillLevel.toLowerCase().includes(q))
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
        })),
    };
  }

  if (path === '/api/members/favorites' && method === 'POST') {
    const me = store.members.find((m) => m.id === user.id)!;
    if (me.favorites.includes(body.memberId)) me.favorites = me.favorites.filter((id) => id !== body.memberId);
    else me.favorites.push(body.memberId);
    return { favorites: me.favorites };
  }

  if (path === '/api/news') {
    return {
      news: store.news.slice().sort((a, b) => (a.pinned === b.pinned ? b.date.localeCompare(a.date) : a.pinned ? -1 : 1)),
    };
  }

  if (path === '/api/teams') {
    return {
      teams: store.teams.map((t) => ({
        ...t,
        captain: store.members.find((m) => m.id === t.captainId)?.name ?? '–',
        players: t.playerIds
          .map((id) => {
            const m = store.members.find((x) => x.id === id);
            return m ? { id: m.id, name: m.name, initials: m.initials, avatarColor: m.avatarColor, skillLevel: m.skillLevel } : null;
          })
          .filter(Boolean),
      })),
    };
  }

  if (path === '/api/tournaments' && method === 'GET') {
    return {
      tournaments: store.tournaments.map((t) => ({
        ...t,
        registered: t.participantIds.includes(user.id),
        participants: t.participantIds
          .map((id) => {
            const m = store.members.find((x) => x.id === id);
            return m ? { id: m.id, name: m.name, initials: m.initials, avatarColor: m.avatarColor, skillLevel: m.skillLevel } : null;
          })
          .filter(Boolean),
      })),
    };
  }

  if (path === '/api/tournaments' && method === 'POST') {
    const t = store.tournaments.find((x) => x.id === body.tournamentId);
    if (!t) err(404, 'Turnier nicht gefunden');
    if (t!.status !== 'anmeldung') err(409, 'Anmeldung ist geschlossen');
    if (body.action === 'register') {
      if (t!.participantIds.includes(user.id)) err(409, 'Bereits angemeldet');
      if (t!.participantIds.length >= t!.maxParticipants) err(409, 'Turnier ist ausgebucht');
      t!.participantIds.push(user.id);
      notify(user.id, 'Turnieranmeldung bestätigt 🏆', `Du bist für „${t!.name}" angemeldet. Startgeld: ${t!.fee} €`, 'tournament');
      audit(user.name, `Anmeldung ${t!.name}`);
    } else if (body.action === 'unregister') {
      t!.participantIds = t!.participantIds.filter((id) => id !== user.id);
      audit(user.name, `Abmeldung ${t!.name}`);
    }
    return { ok: true, participants: t!.participantIds.length };
  }

  if (path === '/api/weather') {
    return { weather: weatherFor(params.get('date') ?? todayIso()) };
  }

  if (path === '/api/notifications' && method === 'GET') {
    const notifications = store.notifications.filter((n) => n.memberId === user.id);
    return { notifications, unread: notifications.filter((n) => !n.read).length };
  }

  if (path === '/api/notifications' && method === 'POST') {
    for (const n of store.notifications) if (n.memberId === user.id) n.read = true;
    return { ok: true };
  }

  if (path === '/api/admin/stats') {
    if (user.role !== 'admin') err(403, 'Keine Berechtigung');
    const openHours = store.settings.closingHour - store.settings.openingHour;
    const today = todayIso();

    const utilization = store.courts.map((c) => {
      const booked = store.bookings
        .filter((b) => b.courtId === c.id && b.date === today)
        .reduce((sum, b) => sum + b.durationHours, 0);
      return { courtId: c.id, name: c.name, percent: Math.round((booked / openHours) * 100), blocked: c.blocked };
    });

    const byHour: Record<number, number> = {};
    for (const b of store.bookings) {
      for (let h = Math.floor(b.startHour); h < b.startHour + b.durationHours; h++) byHour[h] = (byHour[h] ?? 0) + 1;
    }
    const popularHours = Object.entries(byHour)
      .map(([hour, count]) => ({ hour: Number(hour), count }))
      .sort((a, b) => a.hour - b.hour);
    const maxCount = Math.max(1, ...popularHours.map((p) => p.count));

    const activity = store.members
      .map((m) => ({
        id: m.id,
        name: m.name,
        initials: m.initials,
        avatarColor: m.avatarColor,
        bookings: store.bookings.filter((b) => b.memberId === m.id || b.players.includes(m.id)).length,
      }))
      .sort((a, b) => b.bookings - a.bookings)
      .slice(0, 5);

    return {
      utilization,
      popularHours: popularHours.map((p) => ({ ...p, percent: Math.round((p.count / maxCount) * 100) })),
      activity,
      totals: {
        members: store.members.length,
        activeMembers: store.members.filter((m) => m.status === 'aktiv').length,
        bookingsTotal: store.bookings.length,
        bookingsToday: store.bookings.filter((b) => b.date === today).length,
        guestsTotal: store.bookings.reduce((s, b) => s + b.guests.length, 0),
        guestFees: store.bookings.reduce((s, b) => s + b.guests.reduce((x, g) => x + g.fee, 0), 0),
      },
      auditLog: store.auditLog.slice(0, 20),
    };
  }

  err(404, `Unbekannter Endpunkt: ${method} ${path}`);
}

export interface ApiResponse {
  ok: boolean;
  status: number;
  json: () => Promise<any>;
}

/** Drop-in-Ersatz für fetch('/api/…') – gleiche Signatur, gleiche Antwortform. */
export async function apiFetch(
  input: string,
  init?: { method?: string; headers?: Record<string, string>; body?: string },
): Promise<ApiResponse> {
  hydrate();
  const url = new URL(input, 'http://local');
  const method = (init?.method ?? 'GET').toUpperCase();
  let body: Record<string, any> = {};
  try {
    body = init?.body ? JSON.parse(init.body) : {};
  } catch {}

  // kleine Latenz, damit Skeleton-Loader/Übergänge natürlich wirken
  await new Promise((r) => setTimeout(r, 60 + Math.random() * 120));

  try {
    const data = handle(url.pathname, method, url.searchParams, body);
    persist();
    return { ok: true, status: 200, json: async () => data };
  } catch (e) {
    if (e instanceof ApiError) {
      const { status, payload } = e;
      return { ok: false, status, json: async () => payload };
    }
    throw e;
  }
}
