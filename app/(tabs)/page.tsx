'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Chevron, PullToRefresh, SkeletonCard } from '@/components/ui';
import { WeatherInfo } from '@/lib/types';
import { haptic, useToast, useUser } from '../providers';

interface EnrichedBooking {
  id: string;
  date: string;
  startHour: number;
  durationHours: number;
  type: string;
  title?: string;
  memberId: string;
  court?: { name: string; surface: string; indoor: boolean };
  playerNames: string[];
}

function fmtTime(h: number) {
  return `${String(Math.floor(h)).padStart(2, '0')}:${h % 1 ? '30' : '00'}`;
}

function fmtDate(iso: string) {
  const today = new Date().toISOString().slice(0, 10);
  const t = new Date();
  t.setDate(t.getDate() + 1);
  if (iso === today) return 'Heute';
  if (iso === t.toISOString().slice(0, 10)) return 'Morgen';
  return new Date(iso + 'T12:00').toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' });
}

const stagger = {
  hidden: { opacity: 0, y: 14 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.06, duration: 0.35, ease: [0.25, 0.1, 0.25, 1] as const },
  }),
};

export default function Dashboard() {
  const { user } = useUser();
  const { toast } = useToast();
  const [bookings, setBookings] = useState<EnrichedBooking[] | null>(null);
  const [weather, setWeather] = useState<WeatherInfo | null>(null);
  const [news, setNews] = useState<{ id: string; title: string; emoji: string; category: string; date: string }[] | null>(null);
  const [nextMatch, setNextMatch] = useState<{ team: string; opponent: string; date: string; home: boolean } | null>(null);
  const [unread, setUnread] = useState(0);

  const load = useCallback(async () => {
    const [b, w, n, t, no] = await Promise.all([
      fetch('/api/bookings?mine=1').then((r) => r.json()),
      fetch('/api/weather').then((r) => r.json()),
      fetch('/api/news').then((r) => r.json()),
      fetch('/api/teams').then((r) => r.json()),
      fetch('/api/notifications').then((r) => r.json()),
    ]);
    setBookings(b.bookings ?? []);
    setWeather(w.weather);
    setNews((n.news ?? []).slice(0, 3));
    setUnread(no.unread ?? 0);
    const myTeam = (t.teams ?? []).find((team: any) => team.players.some((p: any) => p?.id === user?.id));
    if (myTeam?.nextMatch) {
      setNextMatch({ team: myTeam.name, ...myTeam.nextMatch });
    }
  }, [user?.id]);

  useEffect(() => {
    load();
  }, [load]);

  async function cancelBooking(id: string) {
    haptic([15, 30, 15]);
    const res = await fetch(`/api/bookings/${id}`, { method: 'DELETE' });
    if (res.ok) {
      toast('Buchung storniert');
      load();
    } else {
      toast('Stornierung fehlgeschlagen', 'error');
    }
  }

  const hour = new Date().getHours();
  const greeting = hour < 11 ? 'Guten Morgen' : hour < 18 ? 'Hallo' : 'Guten Abend';

  return (
    <PullToRefresh onRefresh={load}>
      <div className="space-y-5 px-4 pt-[calc(env(safe-area-inset-top)+20px)]">
        {/* Header */}
        <motion.header variants={stagger} custom={0} initial="hidden" animate="show" className="flex items-start justify-between">
          <div>
            <p className="text-secondary text-[15px] font-medium">
              {new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
            <h1 className="text-[32px] font-bold tracking-tight">
              {greeting}, {user?.name.split(' ')[0]}
            </h1>
          </div>
          <Link href="/profile" className="pressable relative mt-2">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-full font-semibold text-white"
              style={{ background: user?.avatarColor }}
            >
              {user?.initials}
            </div>
            {unread > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-busy px-1 text-[11px] font-bold text-white">
                {unread}
              </span>
            )}
          </Link>
        </motion.header>

        {/* Wetter */}
        <motion.section variants={stagger} custom={1} initial="hidden" animate="show">
          {weather ? (
            <div className="card overflow-hidden">
              <div className="flex items-center justify-between p-4 pb-3">
                <div>
                  <p className="text-secondary text-[13px] font-medium">Tennisanlage · Außenplätze</p>
                  <p className="text-[28px] font-bold">
                    {weather.icon} {weather.temp}°
                  </p>
                </div>
                <div className="text-right text-[13px]">
                  <p className="text-secondary">💧 {weather.rainProbability}% Regen</p>
                  <p className="text-secondary">💨 {weather.windKmh} km/h</p>
                  <p className={`font-semibold ${weather.playable ? 'text-free' : 'text-busy'}`}>
                    {weather.playable ? 'Bespielbar' : 'Nicht bespielbar'}
                  </p>
                </div>
              </div>
              {weather.warning && (
                <div className="bg-busy/10 px-4 py-2 text-[13px] font-medium text-busy">⚠️ {weather.warning}</div>
              )}
              <div className="separator flex gap-4 overflow-x-auto border-t px-4 py-2.5">
                {weather.hourly.map((h) => (
                  <div key={h.hour} className="flex shrink-0 flex-col items-center text-[12px]">
                    <span className="text-secondary">{h.hour} Uhr</span>
                    <span className="text-base">{h.icon}</span>
                    <span className="font-semibold">{h.temp}°</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <SkeletonCard lines={2} />
          )}
        </motion.section>

        {/* Schnell buchen */}
        <motion.section variants={stagger} custom={2} initial="hidden" animate="show">
          <Link
            href="/booking?new=1"
            onClick={() => haptic(12)}
            className="pressable flex items-center justify-between rounded-card bg-[var(--primary)] p-4 text-white shadow-fab"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/20 text-xl">🎾</span>
              <div>
                <p className="text-[17px] font-bold">Platz buchen</p>
                <p className="text-[13px] text-white/80">In 3 Klicks zum freien Platz</p>
              </div>
            </div>
            <Chevron />
          </Link>
        </motion.section>

        {/* Meine Reservierungen */}
        <motion.section variants={stagger} custom={3} initial="hidden" animate="show" className="space-y-2.5">
          <div className="flex items-baseline justify-between px-1">
            <h2 className="text-[20px] font-bold">Meine Reservierungen</h2>
            <Link href="/calendar" className="text-[15px] font-medium text-[var(--primary)]">
              Kalender
            </Link>
          </div>
          {bookings === null ? (
            <SkeletonCard lines={1} />
          ) : bookings.length === 0 ? (
            <div className="card text-secondary p-5 text-center text-[15px]">
              Keine anstehenden Reservierungen.
              <br />
              Buche jetzt deinen Platz! 🎾
            </div>
          ) : (
            bookings.slice(0, 3).map((b) => (
              <div key={b.id} className="card flex items-center gap-3 p-4">
                <div className="flex h-12 w-12 flex-col items-center justify-center rounded-[14px] bg-primary-soft text-[var(--primary)]">
                  <span className="text-[11px] font-semibold uppercase">{fmtDate(b.date).slice(0, 5)}</span>
                  <span className="text-[15px] font-bold leading-none">{fmtTime(b.startHour)}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[16px] font-semibold">
                    {b.title ?? `${b.court?.name} · ${b.type === 'doppel' ? 'Doppel' : 'Einzel'}`}
                  </p>
                  <p className="text-secondary truncate text-[13px]">
                    {b.court?.name} · {b.durationHours} Std · {b.playerNames.join(', ')}
                  </p>
                </div>
                {b.memberId === user?.id && (
                  <button
                    onClick={() => cancelBooking(b.id)}
                    className="pressable rounded-full bg-fill px-3 py-1.5 text-[13px] font-medium text-busy"
                  >
                    Stornieren
                  </button>
                )}
              </div>
            ))
          )}
        </motion.section>

        {/* Nächstes Punktspiel */}
        {nextMatch && (
          <motion.section variants={stagger} custom={4} initial="hidden" animate="show">
            <h2 className="mb-2.5 px-1 text-[20px] font-bold">Nächstes Spiel</h2>
            <Link href="/club?tab=teams" className="card pressable flex items-center gap-3 p-4">
              <span className="text-3xl">🏟</span>
              <div className="flex-1">
                <p className="text-[16px] font-semibold">
                  {nextMatch.home ? `${nextMatch.team} vs. ${nextMatch.opponent}` : `${nextMatch.opponent} vs. ${nextMatch.team}`}
                </p>
                <p className="text-secondary text-[13px]">
                  {fmtDate(nextMatch.date)} · {nextMatch.home ? 'Heimspiel' : 'Auswärts'}
                </p>
              </div>
              <Chevron />
            </Link>
          </motion.section>
        )}

        {/* News */}
        <motion.section variants={stagger} custom={5} initial="hidden" animate="show" className="space-y-2.5">
          <div className="flex items-baseline justify-between px-1">
            <h2 className="text-[20px] font-bold">Vereinsnews</h2>
            <Link href="/club" className="text-[15px] font-medium text-[var(--primary)]">
              Alle
            </Link>
          </div>
          {news === null ? (
            <SkeletonCard lines={2} />
          ) : (
            <div className="card overflow-hidden">
              {news.map((n, i) => (
                <Link
                  key={n.id}
                  href="/club"
                  className={`pressable flex items-center gap-3 px-4 py-3 ${i < news.length - 1 ? 'separator border-b' : ''}`}
                >
                  <span className="text-2xl">{n.emoji}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-semibold">{n.title}</p>
                    <p className="text-secondary text-[12px]">{n.category} · {fmtDate(n.date)}</p>
                  </div>
                  <Chevron />
                </Link>
              ))}
            </div>
          )}
        </motion.section>
      </div>
    </PullToRefresh>
  );
}
