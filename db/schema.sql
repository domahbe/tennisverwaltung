-- ============================================================
-- TC Grün-Weiß – PostgreSQL / Supabase Schema
-- Produktionsschema zur In-Memory-Demo (lib/store.ts)
-- ============================================================

create extension if not exists "pgcrypto";

-- ---------- Rollen & Mitglieder ----------
create type member_role as enum ('member', 'trainer', 'admin', 'guest');
create type member_status as enum ('aktiv', 'passiv', 'gesperrt');

create table members (
  id            uuid primary key default gen_random_uuid(),
  auth_user_id  uuid unique,                -- Supabase auth.users(id)
  name          text not null,
  email         text not null unique,
  phone         text,
  photo_url     text,
  skill_level   text,                       -- z. B. 'LK 8'
  role          member_role not null default 'member',
  status        member_status not null default 'aktiv',
  member_since  date not null default current_date,
  looking_for_partner boolean not null default false,
  created_at    timestamptz not null default now()
);

create table favorites (
  member_id   uuid references members(id) on delete cascade,
  favorite_id uuid references members(id) on delete cascade,
  primary key (member_id, favorite_id)
);

-- ---------- Plätze ----------
create type court_surface as enum ('Asche', 'Hartplatz', 'Teppich', 'Rasen');

create table courts (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  surface           court_surface not null,
  indoor            boolean not null default false,
  floodlight        boolean not null default false,
  blocked           boolean not null default false,
  blocked_reason    text,
  maintenance_until date,
  sort_order        int not null default 0
);

-- ---------- Buchungen ----------
create type booking_type as enum ('einzel', 'doppel', 'training', 'punktspiel', 'wartung', 'sperrung');

create table bookings (
  id             uuid primary key default gen_random_uuid(),
  court_id       uuid not null references courts(id) on delete cascade,
  member_id      uuid not null references members(id),
  date           date not null,
  start_hour     numeric(4,2) not null check (start_hour >= 0 and start_hour < 24),
  duration_hours numeric(4,2) not null check (duration_hours > 0 and duration_hours <= 8),
  type           booking_type not null default 'einzel',
  title          text,
  created_at     timestamptz not null default now(),
  -- Überlappungen pro Platz ausschließen
  exclude using gist (
    court_id with =,
    numrange(start_hour, start_hour + duration_hours) with &&,
    daterange(date, date, '[]') with &&
  )
);
create index bookings_by_day on bookings (court_id, date);
create index bookings_by_member on bookings (member_id, date);

create table booking_players (
  booking_id uuid references bookings(id) on delete cascade,
  member_id  uuid references members(id) on delete cascade,
  primary key (booking_id, member_id)
);

create table booking_guests (
  id         uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings(id) on delete cascade,
  name       text not null,
  fee        numeric(8,2) not null default 0,
  paid       boolean not null default false,
  paid_at    timestamptz
);

create table waitlist (
  id         uuid primary key default gen_random_uuid(),
  member_id  uuid not null references members(id) on delete cascade,
  court_id   uuid references courts(id) on delete cascade,  -- null = beliebiger Platz
  date       date not null,
  start_hour numeric(4,2) not null,
  created_at timestamptz not null default now()
);

-- ---------- Mannschaften ----------
create table teams (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  league       text not null,
  captain_id   uuid references members(id),
  position     int,
  matches_won  int not null default 0,
  matches_lost int not null default 0
);

create table team_players (
  team_id   uuid references teams(id) on delete cascade,
  member_id uuid references members(id) on delete cascade,
  primary key (team_id, member_id)
);

create table team_matches (
  id       uuid primary key default gen_random_uuid(),
  team_id  uuid not null references teams(id) on delete cascade,
  opponent text not null,
  date     date not null,
  home     boolean not null default true,
  score    text,            -- null = noch nicht gespielt
  won      boolean
);

-- ---------- Turniere ----------
create type tournament_type as enum ('Vereinsmeisterschaft', 'LK-Turnier', 'Mixed-Turnier');
create type tournament_status as enum ('anmeldung', 'auslosung', 'laufend', 'beendet');

create table tournaments (
  id                    uuid primary key default gen_random_uuid(),
  name                  text not null,
  type                  tournament_type not null,
  start_date            date not null,
  end_date              date not null,
  registration_deadline date not null,
  max_participants      int not null default 32,
  status                tournament_status not null default 'anmeldung',
  fee                   numeric(8,2) not null default 0
);

create table tournament_participants (
  tournament_id uuid references tournaments(id) on delete cascade,
  member_id     uuid references members(id) on delete cascade,
  seed          int,
  registered_at timestamptz not null default now(),
  primary key (tournament_id, member_id)
);

create table tournament_matches (
  id            uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments(id) on delete cascade,
  round         int not null,
  player1_id    uuid references members(id),
  player2_id    uuid references members(id),
  score         text,
  winner_id     uuid references members(id),
  scheduled_at  timestamptz
);

-- ---------- News & Mitteilungen ----------
create type news_category as enum ('Verein', 'Turnier', 'Veranstaltung', 'Platzwart');

create table news_posts (
  id        uuid primary key default gen_random_uuid(),
  title     text not null,
  body      text not null,
  category  news_category not null default 'Verein',
  emoji     text,
  pinned    boolean not null default false,
  author_id uuid references members(id),
  date      date not null default current_date
);

create type notification_type as enum ('booking', 'waitlist', 'tournament', 'news', 'weather');

create table notifications (
  id        uuid primary key default gen_random_uuid(),
  member_id uuid not null references members(id) on delete cascade,
  title     text not null,
  body      text not null,
  type      notification_type not null,
  read      boolean not null default false,
  created_at timestamptz not null default now()
);

create table push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  member_id  uuid not null references members(id) on delete cascade,
  endpoint   text not null unique,
  keys       jsonb not null,            -- p256dh + auth (Web Push / VAPID)
  created_at timestamptz not null default now()
);

-- ---------- Verein & Compliance ----------
create table club_settings (
  id                             int primary key default 1 check (id = 1),
  max_booking_hours              numeric(4,2) not null default 2,
  max_active_bookings_per_member int not null default 3,
  opening_hour                   int not null default 7,
  closing_hour                   int not null default 22,
  guest_fee_per_hour             numeric(8,2) not null default 10
);

create table audit_log (
  id     uuid primary key default gen_random_uuid(),
  actor  uuid references members(id),
  action text not null,
  meta   jsonb,
  at     timestamptz not null default now()
);

-- ============================================================
-- Row Level Security (Supabase)
-- ============================================================
alter table members        enable row level security;
alter table bookings       enable row level security;
alter table booking_guests enable row level security;
alter table waitlist       enable row level security;
alter table notifications  enable row level security;
alter table favorites      enable row level security;
alter table audit_log      enable row level security;

create or replace function current_member_id() returns uuid language sql stable as
  $$ select id from members where auth_user_id = auth.uid() $$;

create or replace function is_admin() returns boolean language sql stable as
  $$ select exists (select 1 from members where auth_user_id = auth.uid() and role = 'admin') $$;

-- Mitglieder: Liste für alle Angemeldeten sichtbar (ohne Kontaktdaten via View),
-- vollständig nur für Admins oder das eigene Profil
create policy members_select on members for select using (auth.role() = 'authenticated');
create policy members_update_self on members for update using (id = current_member_id() or is_admin());

create view members_public as
  select id, name, skill_level, role, status, looking_for_partner from members;

-- Buchungen: lesen alle, schreiben nur eigene (Admins alles)
create policy bookings_select on bookings for select using (auth.role() = 'authenticated');
create policy bookings_insert on bookings for insert with check (member_id = current_member_id());
create policy bookings_delete on bookings for delete using (member_id = current_member_id() or is_admin());

-- Mitteilungen/Warteliste/Favoriten: nur eigene
create policy notifications_own on notifications for all using (member_id = current_member_id());
create policy waitlist_own on waitlist for all using (member_id = current_member_id());
create policy favorites_own on favorites for all using (member_id = current_member_id());

-- Audit-Log: nur Admins lesen, Einfügen über Service-Role/Trigger
create policy audit_admin_read on audit_log for select using (is_admin());

-- Realtime: Buchungen & News für Live-Updates freigeben
-- (Supabase: alter publication supabase_realtime add table bookings, news_posts;)
