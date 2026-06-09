'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { PullToRefresh, Segmented, SkeletonCard } from '@/components/ui';
import { haptic, useUser } from '../../providers';

interface CourtView {
  id: string;
  name: string;
  blocked: boolean;
  indoor: boolean;
  bookings: { id: string; startHour: number; durationHours: number; type: string; title?: string; memberId: string; players: string[] }[];
}

const HOUR_PX = 52;
const START = 7;
const END = 22;

function isoDay(offset: number) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

const typeStyle: Record<string, { bg: string; label: string }> = {
  einzel: { bg: '#007AFF', label: 'Einzel' },
  doppel: { bg: '#5856D6', label: 'Doppel' },
  training: { bg: '#FF9500', label: 'Training' },
  punktspiel: { bg: '#34C759', label: 'Punktspiel' },
  wartung: { bg: '#8E8E93', label: 'Wartung' },
  sperrung: { bg: '#FF3B30', label: 'Gesperrt' },
};

export default function CalendarPage() {
  const { user } = useUser();
  const [mode, setMode] = useState('day');
  const [date, setDate] = useState(isoDay(0));
  const [courts, setCourts] = useState<CourtView[] | null>(null);
  const [week, setWeek] = useState<Record<string, number> | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/courts?date=${date}`);
    const data = await res.json();
    setCourts(data.courts);
  }, [date]);

  useEffect(() => {
    setCourts(null);
    load();
  }, [load]);

  useEffect(() => {
    if (mode !== 'week') return;
    (async () => {
      const counts: Record<string, number> = {};
      await Promise.all(
        Array.from({ length: 7 }, (_, i) => isoDay(i)).map(async (d) => {
          const r = await fetch(`/api/bookings?date=${d}`).then((x) => x.json());
          counts[d] = (r.bookings ?? []).length;
        }),
      );
      setWeek(counts);
    })();
  }, [mode]);

  const nowOffset = useMemo(() => {
    if (date !== isoDay(0)) return null;
    const now = new Date();
    const h = now.getHours() + now.getMinutes() / 60;
    if (h < START || h > END) return null;
    return (h - START) * HOUR_PX;
  }, [date]);

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return {
      iso: d.toISOString().slice(0, 10),
      label: d.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' }),
      short: d.toLocaleDateString('de-DE', { weekday: 'short' }).replace('.', ''),
      num: d.getDate(),
    };
  });

  return (
    <PullToRefresh onRefresh={load}>
      <div className="px-4 pt-[calc(env(safe-area-inset-top)+20px)]">
        <h1 className="mb-3 text-[32px] font-bold tracking-tight">Kalender</h1>
        <div className="mb-3">
          <Segmented
            options={[
              { value: 'day', label: 'Tag' },
              { value: 'week', label: 'Woche' },
            ]}
            value={mode}
            onChange={setMode}
          />
        </div>

        {mode === 'day' && (
          <>
            <div className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-1">
              {days.map((d) => (
                <button
                  key={d.iso}
                  onClick={() => {
                    haptic(8);
                    setDate(d.iso);
                  }}
                  className={`pressable flex min-w-[48px] shrink-0 flex-col items-center rounded-[14px] px-2 py-1.5 ${
                    date === d.iso ? 'bg-[var(--primary)] text-white' : 'card'
                  }`}
                >
                  <span className={`text-[11px] uppercase ${date === d.iso ? 'text-white/80' : 'text-secondary'}`}>{d.short}</span>
                  <span className="text-[17px] font-bold">{d.num}</span>
                </button>
              ))}
            </div>

            {courts === null ? (
              <SkeletonCard lines={6} height={420} />
            ) : (
              <div className="card overflow-hidden p-0">
                {/* Kopfzeile mit Platznamen */}
                <div className="separator flex border-b">
                  <div className="w-12 shrink-0" />
                  <div className="flex flex-1 overflow-x-auto">
                    {courts.map((c) => (
                      <div key={c.id} className="min-w-[88px] flex-1 px-1 py-2 text-center text-[12px] font-semibold">
                        {c.indoor ? '🏠' : '☀️'} {c.name}
                      </div>
                    ))}
                  </div>
                </div>
                {/* Timeline */}
                <div className="relative flex" style={{ height: (END - START) * HOUR_PX }}>
                  <div className="relative w-12 shrink-0">
                    {Array.from({ length: END - START }, (_, i) => (
                      <span
                        key={i}
                        className="text-secondary absolute right-2 text-[11px]"
                        style={{ top: i * HOUR_PX - 7 }}
                      >
                        {i === 0 ? '' : `${START + i}:00`}
                      </span>
                    ))}
                  </div>
                  <div className="relative flex flex-1 overflow-x-auto">
                    {/* Stundenlinien */}
                    {Array.from({ length: END - START }, (_, i) => (
                      <div
                        key={i}
                        className="separator pointer-events-none absolute inset-x-0 border-t"
                        style={{ top: i * HOUR_PX }}
                      />
                    ))}
                    {courts.map((c) => (
                      <div key={c.id} className="separator relative min-w-[88px] flex-1 border-l">
                        {c.blocked && (
                          <div className="absolute inset-0 bg-fill opacity-60">
                            <p className="text-secondary mt-8 rotate-0 text-center text-[11px] font-medium">🚧 Gesperrt</p>
                          </div>
                        )}
                        {c.bookings.map((b) => {
                          const st = typeStyle[b.type] ?? typeStyle.einzel;
                          const mine = b.memberId === user?.id || b.players.includes(user?.id ?? '');
                          return (
                            <motion.div
                              key={b.id}
                              initial={{ opacity: 0, scale: 0.95 }}
                              animate={{ opacity: 1, scale: 1 }}
                              className="absolute inset-x-0.5 overflow-hidden rounded-[8px] px-1.5 py-1"
                              style={{
                                top: (b.startHour - START) * HOUR_PX + 1,
                                height: b.durationHours * HOUR_PX - 3,
                                background: mine ? st.bg : `${st.bg}26`,
                                color: mine ? '#fff' : st.bg,
                              }}
                            >
                              <p className="truncate text-[10px] font-bold leading-tight">{b.title ?? st.label}</p>
                              <p className="truncate text-[9px] opacity-80">
                                {`${Math.floor(b.startHour)}:${b.startHour % 1 ? '30' : '00'}`} · {b.durationHours} h
                              </p>
                            </motion.div>
                          );
                        })}
                      </div>
                    ))}
                    {/* Jetzt-Linie */}
                    {nowOffset !== null && (
                      <div className="pointer-events-none absolute inset-x-0 z-10" style={{ top: nowOffset }}>
                        <div className="flex items-center">
                          <span className="-ml-1 h-2 w-2 rounded-full bg-busy" />
                          <div className="h-px flex-1 bg-busy" />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="text-secondary flex flex-wrap gap-3 px-1 pt-3 text-[12px]">
              {Object.entries(typeStyle).slice(0, 4).map(([k, v]) => (
                <span key={k} className="flex items-center gap-1">
                  <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: v.bg }} />
                  {v.label}
                </span>
              ))}
            </div>
          </>
        )}

        {mode === 'week' && (
          <div className="card overflow-hidden">
            {days.map((d, i) => (
              <button
                key={d.iso}
                onClick={() => {
                  setMode('day');
                  setDate(d.iso);
                  haptic(8);
                }}
                className={`pressable flex w-full items-center gap-3 px-4 py-3 text-left ${
                  i < days.length - 1 ? 'separator border-b' : ''
                }`}
              >
                <div className="w-12 text-center">
                  <p className="text-secondary text-[11px] uppercase">{d.short}</p>
                  <p className="text-[20px] font-bold">{d.num}</p>
                </div>
                <div className="flex-1">
                  <p className="text-[15px] font-semibold">{d.label}</p>
                  <p className="text-secondary text-[13px]">
                    {week === null ? '…' : `${week[d.iso] ?? 0} Buchungen`}
                  </p>
                </div>
                <div className="flex gap-0.5">
                  {Array.from({ length: Math.min(5, week?.[d.iso] ?? 0) }, (_, j) => (
                    <span key={j} className="h-1.5 w-1.5 rounded-full bg-[var(--primary)]" />
                  ))}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </PullToRefresh>
  );
}
