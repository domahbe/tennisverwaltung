import {
  AppNotification,
  Booking,
  ClubSettings,
  Court,
  Member,
  NewsPost,
  Team,
  Tournament,
  WaitlistEntry,
  WeatherInfo,
} from './types';

/**
 * In-Memory-Demo-Datenbank.
 * In Produktion wird dieses Modul 1:1 durch Supabase/PostgreSQL ersetzt
 * (siehe db/schema.sql) – die API-Routen bleiben unverändert.
 */
interface DB {
  members: Member[];
  courts: Court[];
  bookings: Booking[];
  waitlist: WaitlistEntry[];
  teams: Team[];
  tournaments: Tournament[];
  news: NewsPost[];
  notifications: AppNotification[];
  settings: ClubSettings;
  auditLog: { id: string; actor: string; action: string; at: string }[];
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function day(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return iso(d);
}

let counter = 1000;
export function uid(prefix = 'id'): string {
  counter += 1;
  return `${prefix}_${counter.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

function seed(): DB {
  const members: Member[] = [
    { id: 'm1', name: 'Anna Becker', email: 'anna@tc-gw.de', phone: '+49 171 1234561', avatarColor: '#FF9500', initials: 'AB', skillLevel: 'LK 8', teamId: 't1', role: 'member', status: 'aktiv', memberSince: '2018-04-01', favorites: ['m3', 'm5'], lookingForPartner: true },
    { id: 'm2', name: 'Max Schneider', email: 'max@tc-gw.de', phone: '+49 171 1234562', avatarColor: '#34C759', initials: 'MS', skillLevel: 'LK 12', teamId: 't2', role: 'member', status: 'aktiv', memberSince: '2020-06-15', favorites: [], lookingForPartner: false },
    { id: 'm3', name: 'Lena Hoffmann', email: 'lena@tc-gw.de', phone: '+49 171 1234563', avatarColor: '#AF52DE', initials: 'LH', skillLevel: 'LK 6', teamId: 't1', role: 'member', status: 'aktiv', memberSince: '2016-03-20', favorites: ['m1'], lookingForPartner: true },
    { id: 'm4', name: 'Tom Krüger', email: 'tom@tc-gw.de', phone: '+49 171 1234564', avatarColor: '#FF3B30', initials: 'TK', skillLevel: 'LK 15', teamId: 't2', role: 'member', status: 'aktiv', memberSince: '2021-09-01', favorites: [], lookingForPartner: true },
    { id: 'm5', name: 'Sarah Wagner', email: 'sarah@tc-gw.de', phone: '+49 171 1234565', avatarColor: '#5856D6', initials: 'SW', skillLevel: 'LK 9', teamId: 't3', role: 'member', status: 'aktiv', memberSince: '2019-05-12', favorites: ['m1', 'm3'], lookingForPartner: false },
    { id: 'm6', name: 'Carlos Romero', email: 'carlos@tc-gw.de', phone: '+49 171 1234566', avatarColor: '#007AFF', initials: 'CR', skillLevel: 'LK 3', teamId: null, role: 'trainer', status: 'aktiv', memberSince: '2015-01-10', favorites: [], lookingForPartner: false },
    { id: 'm7', name: 'Julia Brandt', email: 'julia@tc-gw.de', phone: '+49 171 1234567', avatarColor: '#FF2D55', initials: 'JB', skillLevel: 'LK 5', teamId: 't3', role: 'trainer', status: 'aktiv', memberSince: '2017-08-22', favorites: [], lookingForPartner: false },
    { id: 'm8', name: 'Peter Lindner', email: 'peter@tc-gw.de', phone: '+49 171 1234568', avatarColor: '#1D1D1F', initials: 'PL', skillLevel: 'LK 18', teamId: null, role: 'admin', status: 'aktiv', memberSince: '2010-02-01', favorites: [], lookingForPartner: false },
    { id: 'm9', name: 'Nina Vogel', email: 'nina@tc-gw.de', phone: '+49 171 1234569', avatarColor: '#FF9500', initials: 'NV', skillLevel: 'LK 11', teamId: 't3', role: 'member', status: 'aktiv', memberSince: '2022-04-18', favorites: [], lookingForPartner: true },
    { id: 'm10', name: 'David Albrecht', email: 'david@tc-gw.de', phone: '+49 171 1234570', avatarColor: '#34C759', initials: 'DA', skillLevel: 'LK 14', teamId: 't2', role: 'member', status: 'passiv', memberSince: '2014-11-05', favorites: [], lookingForPartner: false },
  ];

  const courts: Court[] = [
    { id: 'c1', name: 'Platz 1', surface: 'Asche', indoor: false, floodlight: true, blocked: false },
    { id: 'c2', name: 'Platz 2', surface: 'Asche', indoor: false, floodlight: true, blocked: false },
    { id: 'c3', name: 'Platz 3', surface: 'Asche', indoor: false, floodlight: false, blocked: false },
    { id: 'c4', name: 'Platz 4', surface: 'Asche', indoor: false, floodlight: false, blocked: true, blockedReason: 'Frühjahrsinstandsetzung', maintenanceUntil: day(3) },
    { id: 'c5', name: 'Halle 1', surface: 'Teppich', indoor: true, floodlight: false, blocked: false },
    { id: 'c6', name: 'Halle 2', surface: 'Hartplatz', indoor: true, floodlight: false, blocked: false },
  ];

  const today = day(0);
  const tomorrow = day(1);
  const bookings: Booking[] = [
    { id: 'b1', courtId: 'c1', date: today, startHour: 9, durationHours: 1, memberId: 'm2', players: ['m2', 'm4'], guests: [], type: 'einzel', createdAt: new Date().toISOString() },
    { id: 'b2', courtId: 'c1', date: today, startHour: 17, durationHours: 1.5, memberId: 'm1', players: ['m1', 'm3'], guests: [], type: 'einzel', createdAt: new Date().toISOString() },
    { id: 'b3', courtId: 'c2', date: today, startHour: 16, durationHours: 2, memberId: 'm6', players: ['m6'], guests: [], type: 'training', title: 'Jugendtraining U15', createdAt: new Date().toISOString() },
    { id: 'b4', courtId: 'c3', date: today, startHour: 18, durationHours: 1, memberId: 'm5', players: ['m5', 'm9'], guests: [{ name: 'Tobias Frank', fee: 10, paid: true }], type: 'doppel', createdAt: new Date().toISOString() },
    { id: 'b5', courtId: 'c5', date: today, startHour: 19, durationHours: 1, memberId: 'm3', players: ['m3', 'm1'], guests: [], type: 'einzel', createdAt: new Date().toISOString() },
    { id: 'b6', courtId: 'c2', date: tomorrow, startHour: 10, durationHours: 1, memberId: 'm1', players: ['m1', 'm5'], guests: [], type: 'einzel', createdAt: new Date().toISOString() },
    { id: 'b7', courtId: 'c6', date: tomorrow, startHour: 18, durationHours: 2, memberId: 'm7', players: ['m7'], guests: [], type: 'training', title: 'Damen 1 – Mannschaftstraining', createdAt: new Date().toISOString() },
    { id: 'b8', courtId: 'c1', date: day(2), startHour: 14, durationHours: 4, memberId: 'm8', players: [], guests: [], type: 'punktspiel', title: 'Punktspiel Herren 1 vs. TC Rotweiß', createdAt: new Date().toISOString() },
  ];

  const teams: Team[] = [
    {
      id: 't1', name: 'Damen 1', league: 'Verbandsliga', captainId: 'm3', playerIds: ['m1', 'm3'], position: 2, matchesWon: 5, matchesLost: 1,
      nextMatch: { opponent: 'TC Blau-Gold Mainz', date: day(5), home: true },
      results: [
        { opponent: 'TC Rotweiß Koblenz', date: day(-7), score: '6:3', won: true },
        { opponent: 'TV Eintracht Trier', date: day(-14), score: '4:5', won: false },
        { opponent: 'TC Grünstadt', date: day(-21), score: '7:2', won: true },
      ],
    },
    {
      id: 't2', name: 'Herren 1', league: 'Oberliga', captainId: 'm2', playerIds: ['m2', 'm4', 'm10'], position: 4, matchesWon: 3, matchesLost: 3,
      nextMatch: { opponent: 'TC Rotweiß Koblenz', date: day(2), home: true },
      results: [
        { opponent: 'TC Schwarz-Gelb', date: day(-6), score: '5:4', won: true },
        { opponent: 'TC Park Wiesbaden', date: day(-13), score: '3:6', won: false },
      ],
    },
    {
      id: 't3', name: 'Damen 2', league: 'Bezirksliga', captainId: 'm5', playerIds: ['m5', 'm9'], position: 1, matchesWon: 6, matchesLost: 0,
      nextMatch: { opponent: 'TC Olympia Bonn', date: day(9), home: false },
      results: [
        { opponent: 'TC Wittlich', date: day(-5), score: '8:1', won: true },
        { opponent: 'TC Cochem', date: day(-12), score: '6:3', won: true },
      ],
    },
  ];

  const tournaments: Tournament[] = [
    { id: 'tr1', name: 'Vereinsmeisterschaft 2026', type: 'Vereinsmeisterschaft', startDate: day(20), endDate: day(27), registrationDeadline: day(12), maxParticipants: 32, participantIds: ['m1', 'm2', 'm3', 'm4', 'm5'], status: 'anmeldung', fee: 15 },
    { id: 'tr2', name: 'Sommer LK-Turnier', type: 'LK-Turnier', startDate: day(34), endDate: day(35), registrationDeadline: day(28), maxParticipants: 24, participantIds: ['m2', 'm9'], status: 'anmeldung', fee: 25 },
    { id: 'tr3', name: 'Mixed-Schleifchenturnier', type: 'Mixed-Turnier', startDate: day(-10), endDate: day(-10), registrationDeadline: day(-15), maxParticipants: 16, participantIds: ['m1', 'm3', 'm5', 'm9', 'm2', 'm4'], status: 'beendet', fee: 10 },
  ];

  const news: NewsPost[] = [
    { id: 'n1', title: 'Sommerfest am 21. Juni 🎉', body: 'Unser traditionelles Sommerfest startet um 15 Uhr mit Schleifchenturnier, Grill und Live-Musik. Anmeldung am Schwarzen Brett oder hier in der App.', category: 'Veranstaltung', date: day(-1), pinned: true, emoji: '🎉' },
    { id: 'n2', title: 'Vereinsmeisterschaft: Anmeldung offen', body: 'Ab sofort könnt ihr euch für die Vereinsmeisterschaft 2026 anmelden. Gespielt wird in den Konkurrenzen Damen, Herren und Mixed. Meldeschluss in 12 Tagen!', category: 'Turnier', date: day(-2), pinned: false, emoji: '🏆' },
    { id: 'n3', title: 'Platz 4 wird saniert', body: 'Platz 4 erhält in dieser Woche eine Frühjahrsinstandsetzung und ist voraussichtlich ab Samstag wieder bespielbar. Danke für euer Verständnis!', category: 'Platzwart', date: day(-3), pinned: false, emoji: '🚧' },
    { id: 'n4', title: 'Neue Trainingszeiten für die Jugend', body: 'Ab nächster Woche trainiert die U15 dienstags und donnerstags von 16 bis 18 Uhr bei Carlos. Die U12 bleibt beim gewohnten Termin am Mittwoch.', category: 'Verein', date: day(-5), pinned: false, emoji: '🎾' },
    { id: 'n5', title: 'Damen 2 weiter ungeschlagen!', body: 'Mit einem souveränen 8:1 gegen den TC Wittlich bleibt unsere Damen 2 an der Tabellenspitze der Bezirksliga. Herzlichen Glückwunsch!', category: 'Verein', date: day(-5), pinned: false, emoji: '🔥' },
  ];

  const notifications: AppNotification[] = [
    { id: 'no1', memberId: 'm1', title: 'Buchung bestätigt', body: `Platz 1, heute ${''}17:00–18:30 Uhr`, type: 'booking', date: new Date().toISOString(), read: false },
    { id: 'no2', memberId: 'm1', title: 'Wartelistenplatz frei', body: 'Für morgen 10:00 Uhr ist ein Platz frei geworden.', type: 'waitlist', date: new Date(Date.now() - 3600e3).toISOString(), read: false },
    { id: 'no3', memberId: 'm1', title: 'Turnier-Info', body: 'Die Auslosung der Vereinsmeisterschaft erfolgt nach Meldeschluss.', type: 'tournament', date: new Date(Date.now() - 86400e3).toISOString(), read: true },
  ];

  return {
    members,
    courts,
    bookings,
    waitlist: [],
    teams,
    tournaments,
    news,
    notifications,
    settings: { maxBookingHours: 2, maxActiveBookingsPerMember: 3, openingHour: 7, closingHour: 22, guestFeePerHour: 10 },
    auditLog: [],
  };
}

const globalForDb = globalThis as unknown as { __tennisDb?: DB };

export function db(): DB {
  if (!globalForDb.__tennisDb) globalForDb.__tennisDb = seed();
  return globalForDb.__tennisDb;
}

export function audit(actor: string, action: string) {
  db().auditLog.unshift({ id: uid('log'), actor, action, at: new Date().toISOString() });
}

export function notify(memberId: string, title: string, body: string, type: AppNotification['type']) {
  db().notifications.unshift({ id: uid('no'), memberId, title, body, type, date: new Date().toISOString(), read: false });
}

/** Deterministisches Demo-Wetter pro Tag (in Produktion: OpenWeather/DWD-API). */
export function weatherFor(date: string): WeatherInfo {
  let h = 0;
  for (const ch of date) h = (h * 31 + ch.charCodeAt(0)) % 997;
  const conditions: WeatherInfo['condition'][] = ['sonnig', 'sonnig', 'wolkig', 'wolkig', 'regen', 'gewitter'];
  const condition = conditions[h % conditions.length];
  const icons: Record<WeatherInfo['condition'], string> = { sonnig: '☀️', wolkig: '⛅️', regen: '🌧', gewitter: '⛈' };
  const temp = 16 + (h % 14);
  const rain = condition === 'regen' ? 70 + (h % 25) : condition === 'gewitter' ? 85 : condition === 'wolkig' ? 20 + (h % 20) : h % 12;
  const wind = 5 + (h % 22);
  const playable = condition === 'sonnig' || condition === 'wolkig';
  return {
    temp,
    condition,
    icon: icons[condition],
    rainProbability: rain,
    windKmh: wind,
    playable,
    warning:
      condition === 'gewitter'
        ? 'Gewitterwarnung – Außenplätze gesperrt'
        : condition === 'regen'
          ? 'Regen erwartet – Außenplätze ggf. nicht bespielbar'
          : null,
    hourly: Array.from({ length: 8 }, (_, i) => {
      const hour = 10 + i * 1.5;
      const t = temp + Math.round(Math.sin(i / 2) * 3);
      return { hour: Math.floor(hour), temp: t, rain: Math.min(95, rain + ((h + i * 7) % 15)), icon: icons[condition] };
    }),
  };
}
