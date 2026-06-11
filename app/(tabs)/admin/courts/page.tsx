'use client';

import { apiFetch } from '@/lib/clientApi';

import { useCallback, useEffect, useState } from 'react';
import { Sheet, SkeletonCard, StatusDot } from '@/components/ui';
import { haptic, useToast, useUser } from '../../../providers';

interface CourtView {
  id: string;
  name: string;
  surface: string;
  indoor: boolean;
  blocked: boolean;
  blockedReason?: string;
  maintenanceUntil?: string;
  freeCount: number;
}

export default function AdminCourtsPage() {
  const { user } = useUser();
  const { toast } = useToast();
  const [courts, setCourts] = useState<CourtView[] | null>(null);
  const [blocking, setBlocking] = useState<CourtView | null>(null);
  const [reason, setReason] = useState('Wartung');
  const [until, setUntil] = useState(''); // optional: automatisches Freigeben

  const load = useCallback(async () => {
    const d = await apiFetch('/api/courts').then((r) => r.json());
    setCourts(d.courts);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const canManage = user && (user.role === 'admin' || user.role === 'trainer');

  async function setBlockedState(court: CourtView, blocked: boolean, blockReason?: string) {
    haptic(12);
    const res = await apiFetch(`/api/courts/${court.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ blocked, reason: blockReason, until: until || undefined }),
    });
    if (res.ok) {
      toast(blocked ? `${court.name} gesperrt 🚧` : `${court.name} freigegeben ✅`);
      setBlocking(null);
      load();
    } else {
      toast('Aktion fehlgeschlagen', 'error');
    }
  }

  if (!canManage) {
    return (
      <div className="px-4 pt-24 text-center">
        <p className="text-4xl">🔒</p>
        <p className="mt-2 text-[17px] font-semibold">Kein Zugriff</p>
        <p className="text-secondary text-[14px]">Nur für Trainer und Verwaltung.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 px-4 pt-[calc(env(safe-area-inset-top)+20px)]">
      <h1 className="text-[32px] font-bold tracking-tight">Platzverwaltung</h1>
      <p className="text-secondary -mt-2 text-[14px]">Plätze sperren, Wartungen planen, Trainerzeiten blockieren.</p>

      {courts === null ? (
        <SkeletonCard lines={4} />
      ) : (
        <div className="space-y-3">
          {courts.map((c) => (
            <div key={c.id} className="card flex items-center gap-3 p-4">
              <span className="text-2xl">{c.indoor ? '🏠' : '☀️'}</span>
              <div className="flex-1">
                <p className="text-[16px] font-bold">{c.name}</p>
                <p className="text-secondary text-[13px]">
                  {c.surface}
                  {c.blocked ? ` · ${c.blockedReason}` : ` · ${c.freeCount} Slots frei heute`}
                  {c.blocked && c.maintenanceUntil
                    ? ` · bis ${new Date(c.maintenanceUntil + 'T12:00').toLocaleDateString('de-DE', { day: 'numeric', month: 'short' })}`
                    : ''}
                </p>
                <StatusDot status={c.blocked ? 'blocked' : 'free'} />
              </div>
              {c.blocked ? (
                <button
                  onClick={() => setBlockedState(c, false)}
                  className="pressable rounded-full bg-free/15 px-4 py-2 text-[14px] font-semibold text-free"
                >
                  Freigeben
                </button>
              ) : (
                <button
                  onClick={() => {
                    setReason('Wartung');
                    setUntil('');
                    setBlocking(c);
                  }}
                  className="pressable rounded-full bg-busy/15 px-4 py-2 text-[14px] font-semibold text-busy"
                >
                  Sperren
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <Sheet open={blocking !== null} onClose={() => setBlocking(null)} title={`${blocking?.name ?? ''} sperren`}>
        <div className="space-y-3 pb-2">
          <p className="text-secondary text-[13px] font-semibold uppercase tracking-wide">Grund</p>
          {['Wartung', 'Regenpause / Platz unbespielbar', 'Trainerzeit', 'Punktspiel', 'Veranstaltung'].map((r) => (
            <button
              key={r}
              onClick={() => setReason(r)}
              className={`pressable w-full rounded-[14px] px-4 py-3 text-left text-[15px] font-medium ${
                reason === r ? 'bg-primary-soft text-[var(--primary)] ring-2 ring-[var(--primary)]' : 'bg-fill'
              }`}
            >
              {r}
            </button>
          ))}
          <p className="text-secondary pt-1 text-[13px] font-semibold uppercase tracking-wide">
            Gesperrt bis <span className="font-normal normal-case">(optional)</span>
          </p>
          <input
            type="date"
            value={until}
            min={new Date().toISOString().slice(0, 10)}
            onChange={(e) => setUntil(e.target.value)}
            className="bg-fill w-full rounded-[12px] px-4 py-3 text-[16px] outline-none"
          />
          <p className="text-secondary -mt-1 px-1 text-[12px]">
            Mit Datum wird der Platz danach automatisch freigegeben – ohne bleibt er gesperrt, bis er manuell freigegeben
            wird.
          </p>
          <button
            onClick={() => blocking && setBlockedState(blocking, true, reason)}
            className="pressable mt-2 w-full rounded-[16px] bg-busy py-3.5 text-[17px] font-bold text-white"
          >
            Platz sperren
          </button>
        </div>
      </Sheet>
    </div>
  );
}
