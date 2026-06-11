'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { apiFetch } from '@/lib/clientApi';
import { PhotoCropper } from '@/components/PhotoCropper';
import { Avatar, SkeletonCard, Toggle } from '@/components/ui';
import { Member, PrivacySettings, SocialLinks } from '@/lib/types';
import { haptic, useToast, useUser } from '../../../providers';

const inputCls =
  'bg-fill w-full rounded-[12px] px-4 py-3 text-[16px] outline-none placeholder:text-[var(--text-secondary)] focus:ring-2 focus:ring-[var(--primary)]';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-secondary mb-1 px-1 text-[13px] font-semibold uppercase tracking-wide">{label}</p>
      {children}
    </div>
  );
}

export default function ProfileEditPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { refresh } = useUser();
  const fileRef = useRef<HTMLInputElement>(null);
  const [profile, setProfile] = useState<Member | null>(null);
  const [socials, setSocials] = useState<SocialLinks>({});
  const [privacy, setPrivacy] = useState<PrivacySettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [cropFile, setCropFile] = useState<File | null>(null);

  // Passwort-Bereich: bewusst eingeklappt; bei vorhandenem Passwort erst
  // Verifizierung des aktuellen Passworts, dann neues festlegen
  const [hasPassword, setHasPassword] = useState(false);
  const [pwStep, setPwStep] = useState<'hidden' | 'verify' | 'set'>('hidden');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPassword2, setNewPassword2] = useState('');

  useEffect(() => {
    apiFetch('/api/profile')
      .then((r) => r.json())
      .then((d) => {
        setProfile(d.profile);
        setSocials(d.profile.socials ?? {});
        setPrivacy(d.profile.privacy);
        setHasPassword(d.hasPassword);
      });
  }, []);

  async function verifyCurrentPassword() {
    haptic(10);
    const res = await apiFetch('/api/auth/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: currentPassword }),
    });
    if (res.ok) {
      setPwStep('set');
    } else {
      toast('Aktuelles Passwort ist falsch', 'error');
    }
  }

  async function save() {
    if (!profile || !privacy) return;
    if (newPassword && newPassword !== newPassword2) {
      toast('Die neuen Passwörter stimmen nicht überein', 'error');
      return;
    }
    haptic(12);
    setSaving(true);
    const res = await apiFetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: profile.name,
        email: profile.email,
        phone: profile.phone,
        skillLevel: profile.skillLevel,
        statusText: profile.statusText ?? '',
        lookingForPartner: profile.lookingForPartner,
        photo: profile.photo ?? null,
        socials,
        privacy,
        ...(newPassword ? { currentPassword, newPassword } : {}),
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (res.ok) {
      toast('Profil gespeichert ✅');
      await refresh();
      router.back();
    } else {
      toast(data.error ?? 'Speichern fehlgeschlagen', 'error');
    }
  }

  if (!profile || !privacy) {
    return (
      <div className="space-y-4 px-4 pt-[calc(env(safe-area-inset-top)+20px)]">
        <SkeletonCard lines={3} />
        <SkeletonCard lines={4} />
      </div>
    );
  }

  const privacyRows: { key: keyof PrivacySettings; label: string; desc: string }[] = [
    { key: 'showPhoto', label: 'Profilbild', desc: 'Foto in Mitgliederliste & Spielen' },
    { key: 'showStatus', label: 'Status', desc: 'Dein Status in der Mitgliedersuche' },
    { key: 'showSocials', label: 'Social Media', desc: 'Verlinkte Profile anzeigen' },
    { key: 'showEmail', label: 'E-Mail-Adresse', desc: 'Für andere Mitglieder sichtbar' },
    { key: 'showPhone', label: 'Telefonnummer', desc: 'Für andere Mitglieder sichtbar' },
  ];

  return (
    <div className="space-y-5 px-4 pb-8 pt-[calc(env(safe-area-inset-top)+20px)]">
      <div className="flex items-center justify-between">
        <button onClick={() => router.back()} className="pressable text-[16px] font-medium text-[var(--primary)]">
          ‹ Zurück
        </button>
        <h1 className="text-[20px] font-bold">Persönliche Daten</h1>
        <span className="w-14" />
      </div>

      {/* Foto */}
      <div className="card flex flex-col items-center gap-3 p-5">
        <Avatar initials={profile.initials} color={profile.avatarColor} photo={profile.photo} size={96} />
        <div className="flex gap-4">
          <button
            onClick={() => fileRef.current?.click()}
            className="pressable text-[15px] font-semibold text-[var(--primary)]"
          >
            {profile.photo ? 'Foto ändern' : 'Foto hochladen'}
          </button>
          {profile.photo && (
            <button
              onClick={() => setProfile({ ...profile, photo: null })}
              className="pressable text-[15px] font-semibold text-busy"
            >
              Entfernen
            </button>
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            setCropFile(e.target.files?.[0] ?? null);
            e.target.value = '';
          }}
        />
      </div>

      {/* Stammdaten */}
      <div className="card space-y-3 p-4">
        <Field label="Name">
          <input value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} className={inputCls} />
        </Field>
        <Field label="E-Mail">
          <input
            type="email"
            value={profile.email}
            onChange={(e) => setProfile({ ...profile, email: e.target.value })}
            className={inputCls}
          />
        </Field>
        <Field label="Telefon">
          <input
            type="tel"
            value={profile.phone}
            onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
            placeholder="+49 …"
            className={inputCls}
          />
        </Field>
        <Field label="Spielstärke (LK 1–25)">
          <div className="bg-fill flex items-center rounded-[12px] px-4">
            <span className="text-secondary pr-2 text-[16px] font-semibold">LK</span>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={25}
              value={profile.skillLevel.replace(/\D/g, '')}
              onChange={(e) => {
                const n = e.target.value.replace(/\D/g, '').slice(0, 2);
                setProfile({ ...profile, skillLevel: n ? `LK ${Math.min(25, Math.max(1, Number(n)))}` : 'LK ' });
              }}
              className="w-full bg-transparent py-3 text-[16px] outline-none"
            />
          </div>
          <p className="text-secondary mt-1 px-1 text-[12px]">DTB-Leistungsklasse: 1 (beste) bis 25</p>
        </Field>
      </div>

      {/* Status */}
      <div className="card space-y-3 p-4">
        <Field label="Status (wie bei WhatsApp)">
          <input
            value={profile.statusText ?? ''}
            onChange={(e) => setProfile({ ...profile, statusText: e.target.value })}
            placeholder="z. B. Suche Doppelpartner fürs Wochenende 🎾"
            maxLength={90}
            className={inputCls}
          />
          <p className="text-secondary mt-1 px-1 text-[12px]">
            Wird anderen Mitgliedern in der Suche angezeigt · {(profile.statusText ?? '').length}/90
          </p>
        </Field>
        <div className="flex items-center justify-between px-1">
          <div>
            <p className="text-[15px] font-medium">Ich suche Spielpartner</p>
            <p className="text-secondary text-[12px]">Im Filter „Spielpartner" auffindbar</p>
          </div>
          <Toggle
            on={profile.lookingForPartner}
            onChange={() => setProfile({ ...profile, lookingForPartner: !profile.lookingForPartner })}
          />
        </div>
      </div>

      {/* Socials */}
      <div className="card space-y-3 p-4">
        <Field label="Instagram">
          <input
            value={socials.instagram ?? ''}
            onChange={(e) => setSocials({ ...socials, instagram: e.target.value })}
            placeholder="@benutzername"
            className={inputCls}
          />
        </Field>
        <Field label="Facebook">
          <input
            value={socials.facebook ?? ''}
            onChange={(e) => setSocials({ ...socials, facebook: e.target.value })}
            placeholder="Profilname"
            className={inputCls}
          />
        </Field>
        <Field label="TikTok">
          <input
            value={socials.tiktok ?? ''}
            onChange={(e) => setSocials({ ...socials, tiktok: e.target.value })}
            placeholder="@benutzername"
            className={inputCls}
          />
        </Field>
        <Field label="Website">
          <input
            value={socials.website ?? ''}
            onChange={(e) => setSocials({ ...socials, website: e.target.value })}
            placeholder="meine-seite.de"
            className={inputCls}
          />
        </Field>
      </div>

      {/* Sichtbarkeit */}
      <div className="card overflow-hidden">
        <p className="text-secondary px-4 pb-1 pt-4 text-[13px] font-semibold uppercase tracking-wide">
          Sichtbarkeit für andere Mitglieder
        </p>
        {privacyRows.map((row, i) => (
          <div
            key={row.key}
            className={`flex items-center gap-3 px-4 py-3 ${i < privacyRows.length - 1 ? 'separator border-b' : ''}`}
          >
            <div className="flex-1">
              <p className="text-[15px] font-medium">{row.label}</p>
              <p className="text-secondary text-[12px]">{row.desc}</p>
            </div>
            <Toggle on={privacy[row.key]} onChange={() => setPrivacy({ ...privacy, [row.key]: !privacy[row.key] })} />
          </div>
        ))}
      </div>

      {/* Passwort – dezent versteckt hinter einem Textlink */}
      {pwStep === 'hidden' ? (
        <button
          onClick={() => {
            haptic(8);
            setPwStep(hasPassword ? 'verify' : 'set');
          }}
          className="text-secondary w-full py-1 text-center text-[14px] font-medium"
        >
          Passwort ändern…
        </button>
      ) : (
        <div className="card space-y-3 p-4">
          <div className="flex items-center justify-between">
            <p className="text-secondary px-1 text-[13px] font-semibold uppercase tracking-wide">Passwort ändern</p>
            <button
              onClick={() => {
                setPwStep('hidden');
                setCurrentPassword('');
                setNewPassword('');
                setNewPassword2('');
              }}
              className="text-secondary text-[13px] font-medium"
            >
              Abbrechen
            </button>
          </div>
          {pwStep === 'verify' ? (
            <>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Aktuelles Passwort"
                autoComplete="current-password"
                className={inputCls}
              />
              <button
                onClick={verifyCurrentPassword}
                disabled={!currentPassword}
                className="pressable w-full rounded-[14px] bg-fill py-2.5 text-[15px] font-bold text-[var(--primary)] disabled:opacity-50"
              >
                Bestätigen
              </button>
            </>
          ) : (
            <>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Neues Passwort (min. 8 Zeichen)"
                autoComplete="new-password"
                minLength={8}
                className={inputCls}
              />
              <input
                type="password"
                value={newPassword2}
                onChange={(e) => setNewPassword2(e.target.value)}
                placeholder="Neues Passwort wiederholen"
                autoComplete="new-password"
                className={inputCls}
              />
              {newPassword2.length > 0 && newPassword !== newPassword2 && (
                <p className="px-1 text-[12px] font-medium text-busy">Die Passwörter stimmen nicht überein</p>
              )}
              <p className="text-secondary px-1 text-[12px]">Wird beim Speichern übernommen.</p>
            </>
          )}
        </div>
      )}

      <motion.button
        whileTap={{ scale: 0.97 }}
        onClick={save}
        disabled={saving}
        className="glass-shine w-full rounded-[16px] bg-[var(--primary)] py-3.5 text-[17px] font-bold text-white disabled:opacity-60"
      >
        {saving ? 'Wird gespeichert…' : 'Speichern'}
      </motion.button>

      <PhotoCropper
        file={cropFile}
        onCancel={() => setCropFile(null)}
        onDone={(photo) => {
          setProfile((p) => (p ? { ...p, photo } : p));
          setCropFile(null);
          haptic(10);
          toast('Foto zugeschnitten – beim Speichern wird es übernommen');
        }}
      />
    </div>
  );
}
