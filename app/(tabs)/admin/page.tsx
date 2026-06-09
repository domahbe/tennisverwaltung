'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Avatar, PullToRefresh, SkeletonCard } from '@/components/ui';
import { useUser } from '../../providers';

interface Stats {
  utilization: { courtId: string; name: string; percent: number; blocked: boolean }[];
  popularHours: { hour: number; count: number; percent: number }[];
  activity: { id: string; name: string; initials: string; avatarColor: string; bookings: number }[];
  totals: {
    members: number;
    activeMembers: number;
    bookingsTotal: number;
    bookingsToday: number;
    guestsTotal: number;
    guestFees: number;
  };
  auditLog: { id: string; actor: string; action: string; at: string }[];
}

export default function AdminPage() {
  const { user } = useUser();
  const [stats, setStats] = useState<Stats | null>(null);
  const [denied, setDenied] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/stats');
    if (!res.ok) {
      setDenied(true);
      return;
    }
    setStats(await res.json());
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (denied || (user && user.role !== 'admin')) {
    return (
      <div className="px-4 pt-24 text-center">
        <p className="text-4xl">🔒</p>
        <p className="mt-2 text-[17px] font-semibold">Kein Zugriff</p>
        <p className="text-secondary text-[14px]">Dieser Bereich ist der Vereinsverwaltung vorbehalten.</p>
      </div>
    );
  }

  return (
    <PullToRefresh onRefresh={load}>
      <div className="space-y-5 px-4 pt-[calc(env(safe-area-inset-top)+20px)]">
        <div className="flex items-center justify-between">
          <h1 className="text-[32px] font-bold tracking-tight">Statistiken</h1>
          <Link href="/admin/courts" className="text-[15px] font-medium text-[var(--primary)]">
            Plätze verwalten
          </Link>
        </div>

        {stats === null ? (
          <>
            <SkeletonCard lines={2} />
            <SkeletonCard lines={4} />
          </>
        ) : (
          <>
            {/* Kennzahlen */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Mitglieder', value: stats.totals.members, sub: `${stats.totals.activeMembers} aktiv`, emoji: '👥' },
                { label: 'Buchungen heute', value: stats.totals.bookingsToday, sub: `${stats.totals.bookingsTotal} gesamt`, emoji: '📅' },
                { label: 'Gastspieler', value: stats.totals.guestsTotal, sub: 'diese Saison', emoji: '🎟' },
                { label: 'Gastgebühren', value: `${stats.totals.guestFees} €`, sub: 'eingenommen', emoji: '💶' },
              ].map((k, i) => (
                <motion.div
                  key={k.label}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="card p-4"
                >
                  <p className="text-xl">{k.emoji}</p>
                  <p className="mt-1 text-[24px] font-bold leading-tight">{k.value}</p>
                  <p className="text-secondary text-[12px]">
                    {k.label} · {k.sub}
                  </p>
                </motion.div>
              ))}
            </div>

            {/* Auslastung */}
            <section className="card p-4">
              <h2 className="mb-3 text-[17px] font-bold">Auslastung heute</h2>
              <div className="space-y-2.5">
                {stats.utilization.map((u) => (
                  <div key={u.courtId}>
                    <div className="mb-1 flex justify-between text-[13px]">
                      <span className="font-medium">
                        {u.name}
                        {u.blocked && ' 🚧'}
                      </span>
                      <span className="text-secondary">{u.percent}%</span>
                    </div>
                    <div className="bg-fill h-2 overflow-hidden rounded-full">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${u.percent}%` }}
                        transition={{ duration: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
                        className={`h-full rounded-full ${u.percent > 70 ? 'bg-busy' : u.percent > 40 ? 'bg-soon' : 'bg-free'}`}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Beliebte Zeiten */}
            <section className="card p-4">
              <h2 className="mb-3 text-[17px] font-bold">Beliebte Spielzeiten</h2>
              <div className="flex h-28 items-end gap-1">
                {stats.popularHours.map((p) => (
                  <div key={p.hour} className="flex flex-1 flex-col items-center gap-1">
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: `${Math.max(6, p.percent)}%` }}
                      transition={{ duration: 0.5 }}
                      className="w-full rounded-t-[4px] bg-[var(--primary)]"
                      style={{ opacity: 0.35 + (p.percent / 100) * 0.65 }}
                    />
                    <span className="text-secondary text-[9px]">{p.hour}</span>
                  </div>
                ))}
              </div>
            </section>

            {/* Aktivste Mitglieder */}
            <section className="card overflow-hidden">
              <h2 className="px-4 pb-1 pt-4 text-[17px] font-bold">Aktivste Mitglieder</h2>
              {stats.activity.map((a, i) => (
                <div
                  key={a.id}
                  className={`flex items-center gap-3 px-4 py-2.5 ${i < stats.activity.length - 1 ? 'separator border-b' : ''}`}
                >
                  <span className="text-secondary w-5 text-[15px] font-bold">{i + 1}</span>
                  <Avatar initials={a.initials} color={a.avatarColor} size={36} />
                  <span className="flex-1 text-[15px] font-medium">{a.name}</span>
                  <span className="text-secondary text-[13px]">{a.bookings} Buchungen</span>
                </div>
              ))}
            </section>

            {/* Audit-Log */}
            <section className="card p-4">
              <h2 className="mb-2 text-[17px] font-bold">Audit-Log</h2>
              {stats.auditLog.length === 0 ? (
                <p className="text-secondary text-[13px]">Noch keine Einträge in dieser Sitzung.</p>
              ) : (
                <div className="space-y-1.5">
                  {stats.auditLog.map((l) => (
                    <p key={l.id} className="text-secondary text-[12px]">
                      <span className="font-semibold text-[var(--text)]">{l.actor}</span> · {l.action} ·{' '}
                      {new Date(l.at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </PullToRefresh>
  );
}
