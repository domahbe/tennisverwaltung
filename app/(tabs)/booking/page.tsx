'use client';

import { apiFetch } from '@/lib/clientApi';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { Avatar, PullToRefresh, Segmented, Sheet, SkeletonCard, StatusDot } from '@/components/ui';
import { ClubSettings, WeatherInfo } from '@/lib/types';
import { haptic, useToast, useUser } from '../../providers';

interface CourtView {
  id: string;
  name: string;
  surface: string;
  indoor: boolean;
  floodlight: boolean;
  blocked: boolean;
  blockedReason?: string;
  freeCount: number;
  hours: { hour: number; status: 'free' | 'soon' | 'busy' | 'blocked' | 'past' }[];
  bookings: { startHour: number; durationHours: number; type: string; title?: string }[];
}

interface MemberLite {
  id: string;
  name: string;
  initials: string;
  avatarColor: string;
  skillLevel: string;
  isFavorite: boolean;
}

function isoDay(offset: number) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

function fmtTime(h: number) {
  return `${String(Math.floor(h)).padStart(2, '0')}:${h % 1 ? '30' : '00'}`;
}

const statusColor: Record<string, string> = {
  free: 'bg-free/15 text-free',
  soon: 'bg-soon/15 text-soon',
  busy: 'bg-busy/15 text-busy',
  blocked: 'bg-fill text-secondary opacity-50',
  past: 'bg-fill text-secondary opacity-35',
};

function BookingPageInner() {
  const { user } = useUser();
  const { toast } = useToast();
  const router = useRouter();
  const params = useSearchParams();

  const [date, setDate] = useState(isoDay(0));
  const [courts, setCourts] = useState<CourtView[] | null>(null);
  const [weather, setWeather] = useState<WeatherInfo | null>(null);
  const [settings, setSettings] = useState<ClubSettings | null>(null);
  const [members, setMembers] = useState<MemberLite[]>([]);

  // Buchungs-Sheet
  const [sheet, setSheet] = useState<{ courtId: string; hour: number } | null>(null);
  const [duration, setDuration] = useState(1);
  const [players, setPlayers] = useState<string[]>([]);
  const [guestName, setGuestName] = useState('');
  const [guests, setGuests] = useState<string[]>([]);
  const [type, setType] = useState<'einzel' | 'doppel'>('einzel');
  const [submitting, setSubmitting] = useState(false);
  const [waitlistOffer, setWaitlistOffer] = useState<{ courtId: string; hour: number } | null>(null);

  const load = useCallback(async () => {
    const res = await apiFetch(`/api/courts?date=${date}`);
    const data = await res.json();
    setCourts(data.courts);
    setWeather(data.weather);
    setSettings(data.settings);
  }, [date]);

  useEffect(() => {
    setCourts(null);
    load();
  }, [load]);

  useEffect(() => {
    apiFetch('/api/members')
      .then((r) => r.json())
      .then((d) => setMembers((d.members ?? []).filter((m: MemberLite) => m.id !== user?.id)));
  }, [user?.id]);

  // FAB / „Platz buchen“: nächsten freien Slot vorschlagen (Klick 1 erledigt)
  useEffect(() => {
    if (params.get('new') === '1' && courts && !sheet) {
      outer: for (const c of courts) {
        for (const s of c.hours) {
          if (s.status === 'free' || s.status === 'soon') {
            setSheet({ courtId: c.id, hour: s.hour });
            break outer;
          }
        }
      }
      router.replace('/booking', { scroll: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, courts]);

  const sheetCourt = useMemo(() => courts?.find((c) => c.id === sheet?.courtId), [courts, sheet]);

  function openSlot(courtId: string, hour: number, status: string) {
    if (status === 'busy') {
      haptic([20, 40, 20]);
      setWaitlistOffer({ courtId, hour });
      return;
    }
    if (status !== 'free' && status !== 'soon') return;
    haptic(10);
    setDuration(1);
    setPlayers([]);
    setGuests([]);
    setType('einzel');
    setSheet({ courtId, hour });
  }

  async function book() {
    if (!sheet) return;
    setSubmitting(true);
    haptic(15);
    const res = await apiFetch('/api/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        courtId: sheet.courtId,
        date,
        startHour: sheet.hour,
        durationHours: duration,
        players,
        guests: guests.map((name) => ({ name })),
        type,
      }),
    });
    const data = await res.json();
    setSubmitting(false);
    if (res.ok) {
      haptic([10, 30, 60]);
      toast(`${sheetCourt?.name} gebucht – ${fmtTime(sheet.hour)} Uhr ✔`);
      setSheet(null);
      load();
    } else {
      toast(data.error ?? 'Buchung fehlgeschlagen', 'error');
      if (data.waitlistSuggested) {
        setWaitlistOffer({ courtId: sheet.courtId, hour: sheet.hour });
        setSheet(null);
      }
    }
  }

  async function joinWaitlist() {
    if (!waitlistOffer) return;
    const res = await apiFetch('/api/waitlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ courtId: waitlistOffer.courtId, date, startHour: waitlistOffer.hour }),
    });
    if (res.ok) toast('Auf Warteliste eingetragen – wir benachrichtigen dich 📬');
    setWaitlistOffer(null);
  }

  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return {
      iso: d.toISOString().slice(0, 10),
      day: d.toLocaleDateString('de-DE', { weekday: 'short' }).replace('.', ''),
      num: d.getDate(),
    };
  });

  return (
    <PullToRefresh onRefresh={load}>
      <div className="px-4 pt-[calc(env(safe-area-inset-top)+20px)]">
        <div className="mb-3 flex items-center justify-between">
          <h1 className="text-[32px] font-bold tracking-tight">Platz buchen</h1>
          {weather && (
            <span className="text-secondary text-[15px] font-medium">
              {weather.icon} {weather.temp}°
            </span>
          )}
        </div>

        {/* Datum: horizontale Tagesauswahl + nativer Picker */}
        <div className="-mx-4 mb-1 flex gap-2 overflow-x-auto px-4 pb-2">
          {days.map((d) => (
            <button
              key={d.iso}
              onClick={() => {
                haptic(8);
                setDate(d.iso);
              }}
              className={`pressable flex min-w-[52px] shrink-0 flex-col items-center rounded-[14px] px-2 py-2 ${
                date === d.iso ? 'bg-[var(--primary)] text-white' : 'card'
              }`}
            >
              <span className={`text-[11px] font-medium uppercase ${date === d.iso ? 'text-white/80' : 'text-secondary'}`}>
                {d.day}
              </span>
              <span className="text-[18px] font-bold">{d.num}</span>
            </button>
          ))}
          <label className="card pressable flex min-w-[52px] shrink-0 cursor-pointer flex-col items-center justify-center rounded-[14px] px-2 py-2">
            <span className="text-lg">📅</span>
            <input
              type="date"
              value={date}
              min={isoDay(0)}
              onChange={(e) => e.target.value && setDate(e.target.value)}
              className="h-0 w-0 opacity-0"
            />
          </label>
        </div>

        {weather?.warning && (
          <div className="mb-3 rounded-card bg-busy/10 px-4 py-2.5 text-[13px] font-medium text-busy">
            ⚠️ {weather.warning}
          </div>
        )}

        {/* Plätze */}
        <div className="space-y-3 pt-2">
          {courts === null ? (
            <>
              <SkeletonCard lines={3} />
              <SkeletonCard lines={3} />
              <SkeletonCard lines={3} />
            </>
          ) : (
            courts.map((c, i) => {
              const overall: 'free' | 'soon' | 'busy' | 'blocked' = c.blocked
                ? 'blocked'
                : c.freeCount === 0
                  ? 'busy'
                  : c.freeCount <= 3
                    ? 'soon'
                    : 'free';
              return (
                <motion.div
                  key={c.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05, duration: 0.3 }}
                  className="card p-4"
                >
                  <div className="mb-2.5 flex items-center justify-between">
                    <div>
                      <p className="text-[17px] font-bold">
                        {c.indoor ? '🏠' : '☀️'} {c.name}
                      </p>
                      <p className="text-secondary text-[13px]">
                        {c.surface}
                        {c.floodlight ? ' · Flutlicht' : ''}
                        {c.blocked ? ` · ${c.blockedReason}` : ` · ${c.freeCount} Slots frei`}
                      </p>
                    </div>
                    <StatusDot status={overall} />
                  </div>
                  <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
                    {c.hours.map((s) => (
                      <button
                        key={s.hour}
                        onClick={() => openSlot(c.id, s.hour, s.status)}
                        disabled={s.status === 'blocked' || s.status === 'past'}
                        className={`pressable shrink-0 rounded-[10px] px-2.5 py-1.5 text-[13px] font-semibold ${statusColor[s.status]}`}
                      >
                        {fmtTime(s.hour)}
                      </button>
                    ))}
                  </div>
                </motion.div>
              );
            })
          )}
        </div>

        <p className="text-secondary px-1 pt-4 text-center text-[12px]">
          Max. {settings?.maxBookingHours ?? 2} Std pro Buchung · max. {settings?.maxActiveBookingsPerMember ?? 3} aktive
          Buchungen · Gastgebühr {settings?.guestFeePerHour ?? 10} €/Std
        </p>
      </div>

      {/* Buchungs-Sheet (Klick 2: Slot, Klick 3: Bestätigen) */}
      <Sheet open={sheet !== null} onClose={() => setSheet(null)} title={sheetCourt ? `${sheetCourt.name} buchen` : ''}>
        {sheet && sheetCourt && (
          <div className="space-y-4">
            <div className="bg-fill flex items-center justify-between rounded-[14px] px-4 py-3">
              <div>
                <p className="text-[15px] font-semibold">
                  {new Date(date + 'T12:00').toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })}
                </p>
                <p className="text-secondary text-[13px]">
                  {fmtTime(sheet.hour)} – {fmtTime(sheet.hour + duration)} Uhr · {sheetCourt.surface}
                </p>
              </div>
              <span className="text-2xl">🎾</span>
            </div>

            <div>
              <p className="text-secondary mb-1.5 text-[13px] font-semibold uppercase tracking-wide">Dauer</p>
              <Segmented
                options={[
                  { value: '1', label: '1 Std' },
                  { value: '1.5', label: '1,5 Std' },
                  { value: '2', label: '2 Std' },
                ]}
                value={String(duration)}
                onChange={(v) => setDuration(Number(v))}
              />
            </div>

            <div>
              <p className="text-secondary mb-1.5 text-[13px] font-semibold uppercase tracking-wide">Spielart</p>
              <Segmented
                options={[
                  { value: 'einzel', label: 'Einzel' },
                  { value: 'doppel', label: 'Doppel' },
                ]}
                value={type}
                onChange={(v) => setType(v as 'einzel' | 'doppel')}
              />
            </div>

            <div>
              <p className="text-secondary mb-1.5 text-[13px] font-semibold uppercase tracking-wide">
                Mitspieler ({players.length})
              </p>
              <div className="-mx-1 flex gap-2 overflow-x-auto px-1 py-1">
                {[...members].sort((a, b) => Number(b.isFavorite) - Number(a.isFavorite)).map((m) => {
                  const sel = players.includes(m.id);
                  return (
                    <button
                      key={m.id}
                      onClick={() => {
                        haptic(8);
                        setPlayers((p) => (sel ? p.filter((x) => x !== m.id) : [...p, m.id]));
                      }}
                      className={`pressable flex shrink-0 flex-col items-center gap-1 rounded-[14px] p-2 ${
                        sel ? 'bg-primary-soft ring-2 ring-[var(--primary)]' : 'bg-fill'
                      }`}
                    >
                      <Avatar initials={m.initials} color={m.avatarColor} size={36} />
                      <span className="max-w-[64px] truncate text-[11px] font-medium">
                        {m.isFavorite ? '⭐ ' : ''}
                        {m.name.split(' ')[0]}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <p className="text-secondary mb-1.5 text-[13px] font-semibold uppercase tracking-wide">Gastspieler</p>
              {guests.map((g) => (
                <div key={g} className="bg-fill mb-1.5 flex items-center justify-between rounded-[12px] px-3 py-2">
                  <span className="text-[15px]">
                    👤 {g} · {((settings?.guestFeePerHour ?? 10) * duration).toFixed(0)} € Gastgebühr
                  </span>
                  <button onClick={() => setGuests((x) => x.filter((y) => y !== g))} className="text-busy text-[13px] font-medium">
                    Entfernen
                  </button>
                </div>
              ))}
              <div className="flex gap-2">
                <input
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  placeholder="Name des Gasts"
                  className="bg-fill flex-1 rounded-[12px] px-3 py-2.5 text-[15px] outline-none placeholder:text-[var(--text-secondary)]"
                />
                <button
                  onClick={() => {
                    if (guestName.trim()) {
                      setGuests((g) => [...g, guestName.trim()]);
                      setGuestName('');
                      haptic(8);
                    }
                  }}
                  className="pressable rounded-[12px] bg-fill px-4 text-[15px] font-semibold text-[var(--primary)]"
                >
                  +
                </button>
              </div>
              <p className="text-secondary mt-1 text-[11px]">Gastgebühren werden digital per App abgerechnet (Apple Pay / PayPal).</p>
            </div>

            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={book}
              disabled={submitting}
              className="w-full rounded-[16px] bg-[var(--primary)] py-3.5 text-[17px] font-bold text-white shadow-fab disabled:opacity-60"
            >
              {submitting ? 'Wird gebucht…' : 'Jetzt reservieren'}
            </motion.button>
          </div>
        )}
      </Sheet>

      {/* Warteliste */}
      <Sheet open={waitlistOffer !== null} onClose={() => setWaitlistOffer(null)} title="Slot belegt">
        <div className="space-y-4 pb-2">
          <p className="text-secondary text-[15px]">
            Dieser Zeitraum ist bereits reserviert. Möchtest du auf die Warteliste? Wir benachrichtigen dich per Push,
            sobald der Platz frei wird.
          </p>
          <button
            onClick={joinWaitlist}
            className="pressable w-full rounded-[16px] bg-[var(--primary)] py-3.5 text-[17px] font-bold text-white"
          >
            Auf Warteliste setzen
          </button>
          <button onClick={() => setWaitlistOffer(null)} className="text-secondary w-full py-1 text-[15px] font-medium">
            Abbrechen
          </button>
        </div>
      </Sheet>
    </PullToRefresh>
  );
}

export default function BookingPage() {
  return (
    <Suspense fallback={<div className="px-4 pt-16"><SkeletonCard lines={3} /></div>}>
      <BookingPageInner />
    </Suspense>
  );
}
