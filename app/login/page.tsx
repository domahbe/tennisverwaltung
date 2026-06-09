'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Avatar } from '@/components/ui';
import { haptic, useToast, useUser } from '../providers';

const demoUsers = [
  { id: 'm1', name: 'Anna Becker', role: 'Mitglied', initials: 'AB', color: '#FF9500', desc: 'LK 8 · Damen 1' },
  { id: 'm6', name: 'Carlos Romero', role: 'Trainer', initials: 'CR', color: '#007AFF', desc: 'Cheftrainer' },
  { id: 'm8', name: 'Peter Lindner', role: 'Admin', initials: 'PL', color: '#1D1D1F', desc: 'Vereinsverwaltung' },
];

export default function LoginPage() {
  const router = useRouter();
  const { setUser } = useUser();
  const { toast } = useToast();
  const [busy, setBusy] = useState<string | null>(null);

  async function login(memberId: string) {
    haptic(12);
    setBusy(memberId);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setUser(data.user);
      router.replace('/');
    } catch {
      toast('Anmeldung fehlgeschlagen', 'error');
      setBusy(null);
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-6 pb-12 pt-[env(safe-area-inset-top)]">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
        className="mb-10 text-center"
      >
        <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-[22px] bg-[var(--primary)] text-4xl shadow-fab">
          🎾
        </div>
        <h1 className="text-[34px] font-bold tracking-tight">TC Grün-Weiß</h1>
        <p className="text-secondary mt-1 text-[17px]">Platzbuchung & Vereinsleben</p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
        className="card overflow-hidden"
      >
        <p className="text-secondary px-4 pb-1 pt-4 text-[13px] font-medium uppercase tracking-wide">
          Demo – Rolle wählen
        </p>
        {demoUsers.map((u, i) => (
          <button
            key={u.id}
            onClick={() => login(u.id)}
            disabled={busy !== null}
            className={`pressable flex w-full items-center gap-3 px-4 py-3 text-left ${
              i < demoUsers.length - 1 ? 'separator border-b' : ''
            }`}
          >
            <Avatar initials={u.initials} color={u.color} size={44} />
            <div className="flex-1">
              <p className="text-[17px] font-semibold">{u.name}</p>
              <p className="text-secondary text-[13px]">
                {u.role} · {u.desc}
              </p>
            </div>
            {busy === u.id ? (
              <motion.span
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }}
                className="text-lg"
              >
                🎾
              </motion.span>
            ) : (
              <span className="text-[15px] font-medium text-[var(--primary)]">Anmelden</span>
            )}
          </button>
        ))}
      </motion.div>

      <p className="text-secondary mt-6 text-center text-[12px]">
        In Produktion: Anmeldung per E-Mail & Passkey (Supabase Auth) · DSGVO-konform
      </p>
    </div>
  );
}
