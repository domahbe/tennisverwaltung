'use client';

import { bookingsFor, overlaps, slotStatus, validateBooking } from './booking';
import { DEFAULT_PRIVACY, audit, db, notify, uid, weatherFor } from './store';
import { Booking, Member, OpenMatch, SessionUser } from './types';

/**
 * Client-seitige API für den statischen Betrieb (GitHub Pages, PWA offline).
 * Spiegelt die REST-Endpunkte aus docs/API.md 1:1 – gleiche Pfade, gleiche
 * Antwortformate –, arbeitet aber auf der Demo-Datenbank im Browser und
 * persistiert sie in localStorage. In Produktion wird dieses Modul durch
 * echte fetch()-Aufrufe gegen Supabase/PostgreSQL ersetzt.
 */

const DB_KEY = 'tcgw_db_v3';
const SESSION_KEY = 'tcgw_session';

let hydrated = false;

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Fehlende Felder älterer/gespeicherter Mitglieder mit Defaults auffüllen. */
function normalizeMember(m: Member): Member {
  return {
    ...m,
    photo: m.photo ?? null,
    statusText: m.statusText ?? '',
    socials: m.socials ?? {},
    privacy: { ...DEFAULT_PRIVACY, ...(m.privacy ?? {}) },
    favorites: m.favorites ?? [],
  };
}

function hydrate() {
  if (hydrated || typeof window === 'undefined') return;
  hydrated = true;
  let carryOverMembers: Member[] | null = null;
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (raw) {
      const { day, data } = JSON.parse(raw);
      if (data?.members?.length) {
        // Demo-Daten hängen am aktuellen Datum → täglich frisch seeden,
        // aber Konten/Profile (Registrierungen, Fotos, Socials) bleiben erhalten
        if (day === todayIso()) {
          data.members = data.members.map(normalizeMember);
          data.matches = data.matches ?? [];
          (globalThis as unknown as { __tennisDb?: unknown }).__tennisDb = data;
          return;
        }
        carryOverMembers = data.members.map(normalizeMember);
      }
    }
  } catch {}
  const fresh = db(); // seeden
  if (carryOverMembers) {
    const seededIds = new Set(fresh.members.map((m) => m.id));
    for (const stored of carryOverMembers) {
      const idx = fresh.members.findIndex((m) => m.id === stored.id);
      if (idx >= 0) fresh.members[idx] = stored; // Profil-Änderungen übernehmen
      else if (!seededIds.has(stored.id)) fresh.members.push(stored); // registrierte Konten behalten
    }
  } else {
    fresh.members = fresh.members.map(normalizeMember);
  }
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
  return {
    id: m.id,
    name: m.name,
    role: m.role,
    initials: m.initials,
    avatarColor: m.avatarColor,
    skillLevel: m.skillLevel,
    photo: m.photo ?? null,
  };
}

async function sha256(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function initialsOf(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .slice(0, 2)
    .join('');
}

const AVATAR_COLORS = ['#FF9500', '#34C759', '#AF52DE', '#FF3B30', '#5856D6', '#007AFF', '#FF2D55', '#00C7BE'];

/** Öffentliches Mitglieder-Profil unter Beachtung der Privacy-Einstellungen. */
function publicMember(m: Member, viewerRole: string) {
  const p = { ...DEFAULT_PRIVACY, ...(m.privacy ?? {}) };
  const isAdmin = viewerRole === 'admin';
  return {
    id: m.id,
    name: m.name,
    initials: m.initials,
    avatarColor: m.avatarColor,
    photo: p.showPhoto || isAdmin ? (m.photo ?? null) : null,
    statusText: p.showStatus || isAdmin ? (m.statusText ?? '') : '',
    socials: p.showSocials || isAdmin ? (m.socials ?? {}) : {},
    skillLevel: m.skillLevel,
    teamId: m.teamId,
    role: m.role,
    status: m.status,
    lookingForPartner: m.lookingForPartner,
    memberSince: m.memberSince,
    email: p.showEmail || isAdmin ? m.email : null,
    phone: p.showPhone || isAdmin ? m.phone : null,
  };
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

async function handle(path: string, method: string, params: URLSearchParams, body: Record<string, any>): Promise<unknown> {
  const store = db();

  if (path === '/api/auth/login' && method === 'POST') {
    let member: Member | undefined;
    if (body.memberId) {
      // Demo-Schnellanmeldung über Rollenauswahl
      member = store.members.find((m) => m.id === body.memberId);
      if (!member) err(401, 'Unbekanntes Mitglied');
    } else {
      // Anmeldung mit E-Mail & Passwort
      const email = String(body.email ?? '').trim().toLowerCase();
      member = store.members.find((m) => m.email.toLowerCase() === email);
      if (!member) err(401, 'Kein Konto mit dieser E-Mail gefunden');
      if (!member!.passwordHash) err(401, 'Für dieses Demo-Konto bitte die Schnellanmeldung nutzen');
      const hash = await sha256(String(body.password ?? ''));
      if (hash !== member!.passwordHash) err(401, 'Falsches Passwort');
    }
    if (member!.status === 'gesperrt') err(403, 'Dein Konto ist gesperrt');
    localStorage.setItem(SESSION_KEY, member!.id);
    audit(member!.name, 'Anmeldung');
    return { user: sessionUser() };
  }

  if (path === '/api/auth/register' && method === 'POST') {
    const name = String(body.name ?? '').trim();
    const email = String(body.email ?? '').trim().toLowerCase();
    const password = String(body.password ?? '');
    if (name.length < 3) err(400, 'Bitte gib deinen vollständigen Namen an');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) err(400, 'Bitte gib eine gültige E-Mail-Adresse an');
    if (password.length < 8) err(400, 'Passwort muss mindestens 8 Zeichen haben');
    if (store.members.some((m) => m.email.toLowerCase() === email)) err(409, 'Diese E-Mail ist bereits registriert');

    const member: Member = {
      id: uid('m'),
      name,
      email,
      phone: '',
      avatarColor: AVATAR_COLORS[store.members.length % AVATAR_COLORS.length],
      initials: initialsOf(name),
      photo: null,
      statusText: '',
      socials: {},
      privacy: { ...DEFAULT_PRIVACY },
      passwordHash: await sha256(password),
      skillLevel: 'LK 25',
      teamId: null,
      role: 'member',
      status: 'aktiv',
      memberSince: todayIso(),
      favorites: [],
      lookingForPartner: false,
    };
    store.members.push(member);
    localStorage.setItem(SESSION_KEY, member.id);
    audit(member.name, 'Registrierung');
    notify(member.id, 'Willkommen im TC Grün-Weiß! 🎾', 'Vervollständige dein Profil unter Profil → Persönliche Daten.', 'news');
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
          ...publicMember(m, user.role),
          isFavorite: me?.favorites.includes(m.id) ?? false,
        })),
    };
  }

  if (path === '/api/profile' && method === 'GET') {
    const me = store.members.find((m) => m.id === user.id)!;
    const { passwordHash: _ph, ...safe } = me;
    return {
      profile: { ...safe, privacy: { ...DEFAULT_PRIVACY, ...(me.privacy ?? {}) } },
      hasPassword: Boolean(me.passwordHash),
    };
  }

  if (path === '/api/profile' && method === 'PATCH') {
    const me = store.members.find((m) => m.id === user.id)!;
    if (typeof body.name === 'string' && body.name.trim().length >= 3) {
      me.name = body.name.trim();
      me.initials = initialsOf(me.name);
    }
    if (typeof body.email === 'string' && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(body.email.trim())) {
      const email = body.email.trim().toLowerCase();
      if (store.members.some((m) => m.id !== me.id && m.email.toLowerCase() === email)) err(409, 'E-Mail bereits vergeben');
      me.email = email;
    }
    if (typeof body.phone === 'string') me.phone = body.phone.trim();
    if (typeof body.skillLevel === 'string') me.skillLevel = body.skillLevel.trim();
    if (typeof body.statusText === 'string') me.statusText = body.statusText.trim().slice(0, 90);
    if (typeof body.lookingForPartner === 'boolean') me.lookingForPartner = body.lookingForPartner;
    if (body.socials && typeof body.socials === 'object') {
      me.socials = {
        instagram: String(body.socials.instagram ?? '').replace(/^@/, '').trim() || undefined,
        facebook: String(body.socials.facebook ?? '').trim() || undefined,
        tiktok: String(body.socials.tiktok ?? '').replace(/^@/, '').trim() || undefined,
        website: String(body.socials.website ?? '').replace(/^https?:\/\//, '').trim() || undefined,
      };
    }
    if (body.privacy && typeof body.privacy === 'object') {
      me.privacy = { ...DEFAULT_PRIVACY, ...(me.privacy ?? {}), ...body.privacy };
    }
    if (typeof body.photo === 'string' || body.photo === null) {
      // Data-URL, clientseitig auf 256px verkleinert (Demo); Produktion: Supabase Storage
      if (typeof body.photo === 'string' && body.photo.length > 400_000) err(413, 'Bild ist zu groß');
      me.photo = body.photo;
    }
    if (typeof body.newPassword === 'string' && body.newPassword.length > 0) {
      if (body.newPassword.length < 8) err(400, 'Neues Passwort muss mindestens 8 Zeichen haben');
      if (me.passwordHash) {
        const old = await sha256(String(body.currentPassword ?? ''));
        if (old !== me.passwordHash) err(401, 'Aktuelles Passwort ist falsch');
      }
      me.passwordHash = await sha256(body.newPassword);
    }
    audit(me.name, 'Profil aktualisiert');
    const { passwordHash: _ph2, ...safe } = me;
    return { profile: safe, user: sessionUser() };
  }

  /* ---------- Spielpartner-Suche (offene Matches) ---------- */

  if (path === '/api/matches' && method === 'GET') {
    const today = todayIso();
    store.matches = store.matches.filter((x) => x.date >= today);
    return {
      matches: store.matches
        .slice()
        .sort((a, b) => (a.date === b.date ? a.startHour - b.startHour : a.date.localeCompare(b.date)))
        .map((x) => ({
          ...x,
          host: publicMember(store.members.find((m) => m.id === x.hostId) ?? store.members[0], user.role),
          players: x.playerIds
            .map((id) => store.members.find((m) => m.id === id))
            .filter(Boolean)
            .map((m) => publicMember(m as Member, user.role)),
          joined: x.playerIds.includes(user.id),
        })),
    };
  }

  if (path === '/api/matches' && method === 'POST') {
    const type = body.type === 'doppel' ? 'doppel' : 'einzel';
    const match: OpenMatch = {
      id: uid('om'),
      hostId: user.id,
      type,
      date: body.date,
      startHour: Number(body.startHour),
      skillRange: String(body.skillRange ?? 'alle Spielstärken').slice(0, 40),
      note: String(body.note ?? '').slice(0, 200),
      playerIds: [user.id],
      maxPlayers: type === 'doppel' ? 4 : 2,
      createdAt: new Date().toISOString(),
    };
    store.matches.push(match);
    audit(user.name, `Offenes Spiel erstellt (${type}, ${match.date})`);
    return { match };
  }

  const matchJoin = path.match(/^\/api\/matches\/([^/]+)\/(join|leave)$/);
  if (matchJoin && method === 'POST') {
    let match = store.matches.find((x) => x.id === matchJoin[1]);
    // Über WhatsApp-Link geteiltes Spiel auf diesem Gerät importieren
    if (!match && body.imported) {
      match = { ...(body.imported as OpenMatch), id: matchJoin[1] };
      if (!store.members.some((m) => m.id === match!.hostId)) match!.hostId = user.id;
      match!.playerIds = match!.playerIds.filter((id) => store.members.some((m) => m.id === id));
      if (match!.playerIds.length === 0) match!.playerIds = [match!.hostId];
      store.matches.push(match!);
    }
    if (!match) err(404, 'Spiel nicht gefunden');
    if (matchJoin[2] === 'join') {
      if (match!.playerIds.includes(user.id)) err(409, 'Du bist schon dabei');
      if (match!.playerIds.length >= match!.maxPlayers) err(409, 'Das Spiel ist bereits voll');
      match!.playerIds.push(user.id);
      notify(match!.hostId, 'Mitspieler gefunden 🎾', `${user.name} spielt bei deinem ${match!.type === 'doppel' ? 'Doppel' : 'Einzel'} am ${match!.date} mit!`, 'booking');
    } else {
      if (match!.hostId === user.id) {
        store.matches = store.matches.filter((x) => x.id !== match!.id);
        return { ok: true, removed: true };
      }
      match!.playerIds = match!.playerIds.filter((id) => id !== user.id);
    }
    return { ok: true, players: match!.playerIds.length };
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
    const data = await handle(url.pathname, method, url.searchParams, body);
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
