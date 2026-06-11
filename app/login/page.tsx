'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { apiFetch } from '@/lib/clientApi';
import { Avatar, Segmented } from '@/components/ui';
import { haptic, useToast, useUser } from '../providers';

const demoUsers = [
  { id: 'm1', name: 'Anna Becker', role: 'Mitglied', initials: 'AB', color: '#FF9500', desc: 'LK 8 · Damen 1' },
  { id: 'm6', name: 'Carlos Romero', role: 'Trainer', initials: 'CR', color: '#007AFF', desc: 'Cheftrainer' },
  { id: 'm8', name: 'Peter Lindner', role: 'Admin', initials: 'PL', color: '#1D1D1F', desc: 'Vereinsverwaltung' },
];

const inputCls =
  'bg-fill w-full rounded-[12px] px-4 py-3 text-[16px] outline-none placeholder:text-[var(--text-secondary)] focus:ring-2 focus:ring-[var(--primary)]';

export default function LoginPage() {
  const router = useRouter();
  const { setUser } = useUser();
  const { toast } = useToast();
  const [mode, setMode] = useState('demo');
  const [register, setRegister] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  async function finishLogin(res: { ok: boolean; json: () => Promise<any> }) {
    const data = await res.json();
    if (!res.ok) {
      toast(data.error ?? 'Anmeldung fehlgeschlagen', 'error');
      setBusy(null);
      return;
    }
    setUser(data.user);
    router.replace('/');
  }

  async function demoLogin(memberId: string) {
    haptic(12);
    setBusy(memberId);
    await finishLogin(
      await apiFetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId }),
      }),
    );
  }

  async function submitEmail(e: React.FormEvent) {
    e.preventDefault();
    haptic(12);
    setBusy('email');
    const path = register ? '/api/auth/register' : '/api/auth/login';
    await finishLogin(
      await apiFetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(register ? { name, email, password } : { email, password }),
      }),
    );
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-6 pb-12 pt-[env(safe-area-inset-top)]">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
        className="mb-8 text-center"
      >
        <div className="glass-shine mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-[22px] bg-[var(--primary)] text-4xl">
          🎾
        </div>
        <h1 className="text-[34px] font-bold tracking-tight">TC Grün-Weiß</h1>
        <p className="text-secondary mt-1 text-[17px]">Platzbuchung & Vereinsleben</p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.12, duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
        className="space-y-4"
      >
        <Segmented
          options={[
            { value: 'demo', label: 'Demo-Rollen' },
            { value: 'email', label: 'E-Mail & Passwort' },
          ]}
          value={mode}
          onChange={(v) => {
            setMode(v);
            setBusy(null);
          }}
        />

        {mode === 'demo' && (
          <div className="card overflow-hidden">
            <p className="text-secondary px-4 pb-1 pt-4 text-[13px] font-medium uppercase tracking-wide">
              Schnell ausprobieren – Rolle wählen
            </p>
            {demoUsers.map((u, i) => (
              <button
                key={u.id}
                onClick={() => demoLogin(u.id)}
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
          </div>
        )}

        {mode === 'email' && (
          <form onSubmit={submitEmail} className="card space-y-3 p-4">
            <p className="text-[17px] font-bold">{register ? 'Konto erstellen' : 'Anmelden'}</p>
            {register && (
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Vor- und Nachname"
                autoComplete="name"
                required
                className={inputCls}
              />
            )}
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="E-Mail-Adresse"
              autoComplete="email"
              required
              className={inputCls}
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={register ? 'Passwort (min. 8 Zeichen)' : 'Passwort'}
              autoComplete={register ? 'new-password' : 'current-password'}
              required
              minLength={register ? 8 : 1}
              className={inputCls}
            />
            <motion.button
              whileTap={{ scale: 0.97 }}
              type="submit"
              disabled={busy !== null}
              className="glass-shine w-full rounded-[16px] bg-[var(--primary)] py-3.5 text-[17px] font-bold text-white disabled:opacity-60"
            >
              {busy === 'email' ? 'Einen Moment…' : register ? 'Registrieren' : 'Anmelden'}
            </motion.button>
            <button
              type="button"
              onClick={() => {
                haptic(8);
                setRegister(!register);
              }}
              className="w-full py-1 text-center text-[14px] font-medium text-[var(--primary)]"
            >
              {register ? 'Schon ein Konto? Jetzt anmelden' : 'Noch kein Konto? Jetzt registrieren'}
            </button>
          </form>
        )}
      </motion.div>

      <p className="text-secondary mt-6 text-center text-[12px]">
        Demo: Konten werden nur auf diesem Gerät gespeichert · Produktion: Supabase Auth · DSGVO-konform
      </p>
    </div>
  );
}
