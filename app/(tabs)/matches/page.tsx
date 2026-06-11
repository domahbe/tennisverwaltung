'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { apiFetch } from '@/lib/clientApi';
import { Avatar, PullToRefresh, Segmented, Sheet, SkeletonCard } from '@/components/ui';
import { OpenMatch } from '@/lib/types';
import { haptic, useToast, useUser } from '../../providers';

interface MatchView extends OpenMatch {
  host: { id: string; name: string; initials: string; avatarColor: string; photo?: string | null; skillLevel: string };
  players: { id: string; name: string; initials: string; avatarColor: string; photo?: string | null }[];
  joined: boolean;
}

const inputCls =
  'bg-fill w-full rounded-[12px] px-4 py-3 text-[16px] outline-none placeholder:text-[var(--text-secondary)] focus:ring-2 focus:ring-[var(--primary)]';

function isoDay(offset: number) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

function fmtDate(iso: string) {
  if (iso === isoDay(0)) return 'Heute';
  if (iso === isoDay(1)) return 'Morgen';
  return new Date(iso + 'T12:00').toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' });
}

function fmtTime(h: number) {
  return `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.round((h % 1) * 60)).padStart(2, '0')}`;
}

/** Match als base64url für den WhatsApp-Link kodieren (Demo: Daten leben pro Gerät). */
function encodeMatch(m: OpenMatch): string {
  const json = JSON.stringify(m);
  return btoa(unescape(encodeURIComponent(json))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decodeMatch(s: string): OpenMatch | null {
  try {
    const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(decodeURIComponent(escape(atob(b64))));
  } catch {
    return null;
  }
}

function shareUrl(m: OpenMatch): string {
  const base = `${location.origin}${process.env.NEXT_PUBLIC_BASE_PATH || ''}`;
  return `${base}/matches/?m=${encodeMatch(m)}`;
}

function whatsappShare(m: OpenMatch, hostName: string) {
  haptic(10);
  const text =
    `🎾 ${m.type === 'doppel' ? 'Doppel' : 'Einzel'} beim TC Graben-Neudorf!\n` +
    `📅 ${fmtDate(m.date)} um ${fmtTime(m.startHour)} Uhr\n` +
    `🏆 ${m.skillRange}\n` +
    (m.note ? `💬 ${m.note}\n` : '') +
    `\nSpiel mit ${hostName}! Hier zusagen:\n${shareUrl(m)}`;
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
}

function MatchesInner() {
  const { user } = useUser();
  const { toast } = useToast();
  const router = useRouter();
  const params = useSearchParams();
  const [matches, setMatches] = useState<MatchView[] | null>(null);
  const [imported, setImported] = useState<OpenMatch | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [shareAfterCreate, setShareAfterCreate] = useState<OpenMatch | null>(null);

  // Formular
  const [type, setType] = useState<'einzel' | 'doppel'>('einzel');
  const [date, setDate] = useState(isoDay(1));
  const [time, setTime] = useState('18:00');
  const [skillRange, setSkillRange] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const d = await apiFetch('/api/matches').then((r) => r.json());
    setMatches(d.matches ?? []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Per WhatsApp-Link geteiltes Spiel
  useEffect(() => {
    const m = params.get('m');
    if (m) {
      const decoded = decodeMatch(m);
      if (decoded) setImported(decoded);
      router.replace('/matches', { scroll: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  async function join(match: OpenMatch, importedPayload?: OpenMatch) {
    haptic(12);
    const res = await apiFetch(`/api/matches/${match.id}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(importedPayload ? { imported: importedPayload } : {}),
    });
    const data = await res.json();
    if (res.ok) {
      haptic([10, 30, 60]);
      toast('Du bist dabei! 🎾');
      setImported(null);
      load();
    } else {
      toast(data.error ?? 'Beitritt fehlgeschlagen', 'error');
    }
  }

  async function leave(match: MatchView) {
    haptic([15, 30, 15]);
    const res = await apiFetch(`/api/matches/${match.id}/leave`, { method: 'POST' });
    if (res.ok) {
      toast(match.hostId === user?.id ? 'Spiel gelöscht' : 'Abgemeldet');
      load();
    }
  }

  async function create() {
    haptic(12);
    setBusy(true);
    const [h, min] = time.split(':').map(Number);
    const res = await apiFetch('/api/matches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type,
        date,
        startHour: h + (min >= 30 ? 0.5 : 0),
        skillRange: skillRange || 'alle Spielstärken',
        note,
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (res.ok) {
      setCreateOpen(false);
      setShareAfterCreate(data.match);
      load();
    } else {
      toast(data.error ?? 'Erstellen fehlgeschlagen', 'error');
    }
  }

  return (
    <PullToRefresh onRefresh={load}>
      <div className="space-y-4 px-4 pt-[calc(env(safe-area-inset-top)+20px)]">
        <div className="flex items-center justify-between">
          <h1 className="text-[32px] font-bold tracking-tight">Spielpartner</h1>
          <button
            onClick={() => {
              haptic(10);
              setCreateOpen(true);
            }}
            className="glass-shine pressable rounded-full bg-[var(--primary)] px-4 py-2 text-[15px] font-bold text-white"
          >
            + Spiel erstellen
          </button>
        </div>
        <p className="text-secondary -mt-2 text-[14px]">
          Erstelle ein offenes Einzel oder Doppel und teile es per WhatsApp – wie bei Playtomic.
        </p>

        {matches === null ? (
          <>
            <SkeletonCard lines={3} />
            <SkeletonCard lines={3} />
          </>
        ) : matches.length === 0 ? (
          <div className="card space-y-3 p-6 text-center">
            <p className="text-3xl">🎾</p>
            <p className="text-secondary text-[15px]">Gerade keine offenen Spiele – erstelle das erste!</p>
            <button
              onClick={() => {
                haptic(10);
                setCreateOpen(true);
              }}
              className="glass-shine pressable w-full rounded-[14px] bg-[var(--primary)] py-3 text-[15px] font-bold text-white"
            >
              Spiel erstellen & per WhatsApp teilen
            </button>
          </div>
        ) : (
          matches.map((m, i) => {
            const free = m.maxPlayers - m.playerIds.length;
            return (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="card p-4"
              >
                <div className="mb-2 flex items-center gap-3">
                  <Avatar initials={m.host.initials} color={m.host.avatarColor} photo={m.host.photo} size={44} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[16px] font-bold">
                      {m.type === 'doppel' ? '👥 Doppel' : '🎾 Einzel'} · {fmtDate(m.date)} {fmtTime(m.startHour)} Uhr
                    </p>
                    <p className="text-secondary truncate text-[13px]">
                      {m.host.name} ({m.host.skillLevel}) · {m.skillRange}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-[12px] font-bold ${
                      free > 0 ? 'bg-free/15 text-free' : 'bg-fill text-secondary'
                    }`}
                  >
                    {free > 0 ? `${free} Platz${free > 1 ? '​e' : ''} frei` : 'Voll'}
                  </span>
                </div>
                {m.note && <p className="text-secondary mb-2.5 text-[14px]">{m.note}</p>}
                <div className="mb-3 flex items-center gap-2">
                  <div className="flex -space-x-2">
                    {m.players.map((p) => (
                      <div key={p.id} className="rounded-full ring-2 ring-[var(--bg)]">
                        <Avatar initials={p.initials} color={p.avatarColor} photo={p.photo} size={30} />
                      </div>
                    ))}
                    {Array.from({ length: free }).map((_, j) => (
                      <div
                        key={j}
                        className="bg-fill text-secondary flex h-[30px] w-[30px] items-center justify-center rounded-full text-[13px] ring-2 ring-[var(--bg)]"
                      >
                        ?
                      </div>
                    ))}
                  </div>
                  <span className="text-secondary text-[12px]">
                    {m.playerIds.length}/{m.maxPlayers} Spieler
                  </span>
                </div>
                <div className="flex gap-2">
                  {m.joined ? (
                    <button
                      onClick={() => leave(m)}
                      className="pressable flex-1 rounded-[14px] bg-fill py-2.5 text-[15px] font-bold text-busy"
                    >
                      {m.hostId === user?.id ? 'Spiel löschen' : 'Abmelden'}
                    </button>
                  ) : (
                    <button
                      onClick={() => join(m)}
                      disabled={free === 0}
                      className="glass-shine pressable flex-1 rounded-[14px] bg-[var(--primary)] py-2.5 text-[15px] font-bold text-white disabled:opacity-50"
                    >
                      Mitspielen
                    </button>
                  )}
                  <button
                    onClick={() => whatsappShare(m, m.host.name)}
                    className="pressable rounded-[14px] bg-[#25D366] px-4 py-2.5 text-[15px] font-bold text-white"
                  >
                    WhatsApp
                  </button>
                </div>
              </motion.div>
            );
          })
        )}
      </div>

      {/* Spiel erstellen */}
      <Sheet open={createOpen} onClose={() => setCreateOpen(false)} title="Offenes Spiel erstellen">
        <div className="space-y-4 pb-2">
          <Segmented
            options={[
              { value: 'einzel', label: '🎾 Einzel (2)' },
              { value: 'doppel', label: '👥 Doppel (4)' },
            ]}
            value={type}
            onChange={(v) => setType(v as 'einzel' | 'doppel')}
          />
          <div className="flex gap-2">
            <div className="flex-1">
              <p className="text-secondary mb-1 text-[13px] font-semibold uppercase tracking-wide">Datum</p>
              <input type="date" value={date} min={isoDay(0)} onChange={(e) => setDate(e.target.value)} className={inputCls} />
            </div>
            <div className="flex-1">
              <p className="text-secondary mb-1 text-[13px] font-semibold uppercase tracking-wide">Uhrzeit</p>
              <input type="time" value={time} step={1800} onChange={(e) => setTime(e.target.value)} className={inputCls} />
            </div>
          </div>
          <div>
            <p className="text-secondary mb-1 text-[13px] font-semibold uppercase tracking-wide">Spielstärke</p>
            <input
              value={skillRange}
              onChange={(e) => setSkillRange(e.target.value)}
              placeholder="z. B. LK 10–16 (leer = alle)"
              className={inputCls}
            />
          </div>
          <div>
            <p className="text-secondary mb-1 text-[13px] font-semibold uppercase tracking-wide">Nachricht</p>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="z. B. Lockeres Match, danach Getränk? 🍻"
              maxLength={200}
              className={inputCls}
            />
          </div>
          <button
            onClick={create}
            disabled={busy}
            className="glass-shine pressable w-full rounded-[16px] bg-[var(--primary)] py-3.5 text-[17px] font-bold text-white disabled:opacity-60"
          >
            {busy ? 'Wird erstellt…' : 'Spiel erstellen'}
          </button>
        </div>
      </Sheet>

      {/* Nach dem Erstellen: direkt teilen */}
      <Sheet open={shareAfterCreate !== null} onClose={() => setShareAfterCreate(null)} title="Spiel erstellt 🎉">
        {shareAfterCreate && (
          <div className="space-y-4 pb-2">
            <p className="text-secondary text-[15px]">
              Dein {shareAfterCreate.type === 'doppel' ? 'Doppel' : 'Einzel'} am {fmtDate(shareAfterCreate.date)} um{' '}
              {fmtTime(shareAfterCreate.startHour)} Uhr ist online. Teile es jetzt, damit sich Mitspieler eintragen können!
            </p>
            <button
              onClick={() => whatsappShare(shareAfterCreate, user?.name ?? '')}
              className="pressable w-full rounded-[16px] bg-[#25D366] py-3.5 text-[17px] font-bold text-white"
            >
              Per WhatsApp teilen
            </button>
            <button
              onClick={async () => {
                await navigator.clipboard?.writeText(shareUrl(shareAfterCreate));
                toast('Link kopiert 📋');
              }}
              className="pressable w-full rounded-[16px] bg-fill py-3.5 text-[17px] font-bold text-[var(--primary)]"
            >
              Link kopieren
            </button>
            <button onClick={() => setShareAfterCreate(null)} className="text-secondary w-full py-1 text-[15px] font-medium">
              Fertig
            </button>
          </div>
        )}
      </Sheet>

      {/* Per Link geöffnetes Spiel */}
      <Sheet open={imported !== null} onClose={() => setImported(null)} title="Einladung zum Spiel 🎾">
        {imported && (
          <div className="space-y-4 pb-2">
            <div className="bg-fill rounded-[14px] p-4">
              <p className="text-[17px] font-bold">
                {imported.type === 'doppel' ? '👥 Doppel' : '🎾 Einzel'} · {fmtDate(imported.date)} um{' '}
                {fmtTime(imported.startHour)} Uhr
              </p>
              <p className="text-secondary mt-1 text-[14px]">{imported.skillRange}</p>
              {imported.note && <p className="text-secondary mt-1 text-[14px]">💬 {imported.note}</p>}
            </div>
            <button
              onClick={() => join(imported, imported)}
              className="glass-shine pressable w-full rounded-[16px] bg-[var(--primary)] py-3.5 text-[17px] font-bold text-white"
            >
              Zusagen & mitspielen
            </button>
            <button onClick={() => setImported(null)} className="text-secondary w-full py-1 text-[15px] font-medium">
              Ablehnen
            </button>
          </div>
        )}
      </Sheet>
    </PullToRefresh>
  );
}

export default function MatchesPage() {
  return (
    <Suspense
      fallback={
        <div className="px-4 pt-16">
          <SkeletonCard lines={3} />
        </div>
      }
    >
      <MatchesInner />
    </Suspense>
  );
}
