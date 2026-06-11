export type Role = 'member' | 'trainer' | 'admin' | 'guest';

export type SkillLevel = string; // LK 1 – LK 25

export interface SocialLinks {
  instagram?: string;
  facebook?: string;
  tiktok?: string;
  website?: string;
}

/** Was andere Mitglieder sehen dürfen (DSGVO: Opt-in pro Feld). */
export interface PrivacySettings {
  showEmail: boolean;
  showPhone: boolean;
  showSocials: boolean;
  showStatus: boolean;
  showPhoto: boolean;
}

export interface Member {
  id: string;
  name: string;
  email: string;
  phone: string;
  avatarColor: string;
  initials: string;
  /** Profilbild als Data-URL (Demo); Produktion: Supabase Storage */
  photo?: string | null;
  /** Kurzer Status wie bei WhatsApp, sichtbar in der Mitgliedersuche */
  statusText?: string;
  socials?: SocialLinks;
  privacy?: PrivacySettings;
  /** SHA-256-Hash (Demo); Produktion: Supabase Auth */
  passwordHash?: string;
  skillLevel: SkillLevel;
  teamId: string | null;
  role: Role;
  status: 'aktiv' | 'passiv' | 'gesperrt';
  memberSince: string;
  favorites: string[]; // member ids
  lookingForPartner: boolean;
}

/** Offenes Spiel zur Spielpartner-Suche (Playtomic-Prinzip). */
export interface OpenMatch {
  id: string;
  hostId: string;
  type: 'einzel' | 'doppel';
  date: string;
  startHour: number;
  skillRange: string; // z. B. "LK 8–14"
  note: string;
  playerIds: string[]; // inkl. Host
  maxPlayers: number; // 2 bei Einzel, 4 bei Doppel
  createdAt: string;
}

export type Surface = 'Asche' | 'Hartplatz' | 'Teppich' | 'Rasen';

export interface Court {
  id: string;
  name: string;
  surface: Surface;
  indoor: boolean;
  floodlight: boolean;
  blocked: boolean;
  blockedReason?: string;
  maintenanceUntil?: string;
}

export type BookingType = 'einzel' | 'doppel' | 'training' | 'punktspiel' | 'wartung' | 'sperrung';

export interface Booking {
  id: string;
  courtId: string;
  date: string; // YYYY-MM-DD
  startHour: number; // 7..22 (decimal allowed: 7.5)
  durationHours: number;
  memberId: string;
  players: string[]; // member ids
  guests: { name: string; fee: number; paid: boolean }[];
  type: BookingType;
  title?: string;
  createdAt: string;
}

export interface WaitlistEntry {
  id: string;
  memberId: string;
  courtId: string | null; // null = any court
  date: string;
  startHour: number;
  createdAt: string;
}

export interface Team {
  id: string;
  name: string;
  league: string;
  captainId: string;
  playerIds: string[];
  position: number;
  matchesWon: number;
  matchesLost: number;
  nextMatch?: { opponent: string; date: string; home: boolean };
  results: { opponent: string; date: string; score: string; won: boolean }[];
}

export interface Tournament {
  id: string;
  name: string;
  type: 'Vereinsmeisterschaft' | 'LK-Turnier' | 'Mixed-Turnier';
  startDate: string;
  endDate: string;
  registrationDeadline: string;
  maxParticipants: number;
  participantIds: string[];
  status: 'anmeldung' | 'auslosung' | 'laufend' | 'beendet';
  fee: number;
}

export interface NewsPost {
  id: string;
  title: string;
  body: string;
  category: 'Verein' | 'Turnier' | 'Veranstaltung' | 'Platzwart';
  date: string;
  pinned: boolean;
  emoji: string;
}

export interface AppNotification {
  id: string;
  memberId: string;
  title: string;
  body: string;
  type: 'booking' | 'waitlist' | 'tournament' | 'news' | 'weather';
  date: string;
  read: boolean;
}

export interface ClubSettings {
  maxBookingHours: number;
  maxActiveBookingsPerMember: number;
  openingHour: number;
  closingHour: number;
  guestFeePerHour: number;
}

export interface WeatherInfo {
  temp: number;
  condition: 'sonnig' | 'wolkig' | 'regen' | 'gewitter';
  icon: string;
  rainProbability: number;
  windKmh: number;
  playable: boolean;
  warning: string | null;
  hourly: { hour: number; temp: number; rain: number; icon: string }[];
}

export interface SessionUser {
  id: string;
  name: string;
  role: Role;
  initials: string;
  avatarColor: string;
  skillLevel: string;
  photo?: string | null;
}
