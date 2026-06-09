'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Avatar, Chevron, ListRow, PullToRefresh, Sheet } from '@/components/ui';
import { AppNotification } from '@/lib/types';
import { haptic, useTheme, useToast, useUser } from '../../providers';

const typeEmoji: Record<string, string> = {
  booking: '✅',
  waitlist: '📬',
  tournament: '🏆',
  news: '📰',
  weather: '🌧',
};

export default function ProfilePage() {
  const { user, setUser } = useUser();
  const { dark, toggle } = useTheme();
  const { toast } = useToast();
  const router = useRouter();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);

  const load = useCallback(async () => {
    const d = await fetch('/api/notifications').then((r) => r.json());
    setNotifications(d.notifications ?? []);
    setUnread(d.unread ?? 0);
  }, []);

  useEffect(() => {
    load();
    if (typeof Notification !== 'undefined') setPushEnabled(Notification.permission === 'granted');
  }, [load]);

  async function openNotifications() {
    haptic(8);
    setShowNotifications(true);
    if (unread > 0) {
      await fetch('/api/notifications', { method: 'POST' });
      setUnread(0);
    }
  }

  async function enablePush() {
    haptic(10);
    if (typeof Notification === 'undefined') {
      toast('Push wird auf diesem Gerät nicht unterstützt', 'error');
      return;
    }
    const perm = await Notification.requestPermission();
    setPushEnabled(perm === 'granted');
    toast(perm === 'granted' ? 'Push-Benachrichtigungen aktiviert 🔔' : 'Push nicht erlaubt', perm === 'granted' ? 'success' : 'error');
  }

  async function logout() {
    haptic([15, 30, 15]);
    await fetch('/api/auth/logout', { method: 'POST' });
    setUser(null);
    router.replace('/login');
  }

  if (!user) return null;
  const roleLabel = { member: 'Mitglied', trainer: 'Trainer', admin: 'Administrator', guest: 'Gast' }[user.role];

  return (
    <PullToRefresh onRefresh={load}>
      <div className="space-y-5 px-4 pt-[calc(env(safe-area-inset-top)+20px)]">
        <h1 className="text-[32px] font-bold tracking-tight">Profil</h1>

        <div className="card flex items-center gap-4 p-5">
          <Avatar initials={user.initials} color={user.avatarColor} size={64} />
          <div>
            <p className="text-[22px] font-bold">{user.name}</p>
            <p className="text-secondary text-[14px]">
              {roleLabel} · {user.skillLevel}
            </p>
          </div>
        </div>

        <div className="card overflow-hidden">
          <ListRow onClick={openNotifications}>
            <span className="text-xl">🔔</span>
            <span className="flex-1 text-[16px]">Mitteilungen</span>
            {unread > 0 && (
              <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-busy px-1.5 text-[12px] font-bold text-white">
                {unread}
              </span>
            )}
            <Chevron />
          </ListRow>
          <ListRow onClick={toggle}>
            <span className="text-xl">{dark ? '🌙' : '☀️'}</span>
            <span className="flex-1 text-[16px]">Dark Mode</span>
            <span
              className={`relative h-[31px] w-[51px] rounded-full transition-colors duration-200 ${dark ? 'bg-free' : 'bg-fill'}`}
            >
              <span
                className={`absolute top-[2px] h-[27px] w-[27px] rounded-full bg-white shadow transition-transform duration-200 ${
                  dark ? 'translate-x-[22px]' : 'translate-x-[2px]'
                }`}
              />
            </span>
          </ListRow>
          <ListRow onClick={pushEnabled ? undefined : enablePush} last>
            <span className="text-xl">📲</span>
            <span className="flex-1 text-[16px]">Push-Benachrichtigungen</span>
            <span className={`text-[14px] font-medium ${pushEnabled ? 'text-free' : 'text-[var(--primary)]'}`}>
              {pushEnabled ? 'Aktiv' : 'Aktivieren'}
            </span>
          </ListRow>
        </div>

        {(user.role === 'trainer' || user.role === 'admin') && (
          <div>
            <p className="text-secondary mb-2 px-1 text-[13px] font-semibold uppercase tracking-wide">
              {user.role === 'admin' ? 'Verwaltung' : 'Trainerbereich'}
            </p>
            <div className="card overflow-hidden">
              {user.role === 'admin' && (
                <Link href="/admin">
                  <ListRow onClick={() => {}}>
                    <span className="text-xl">📊</span>
                    <span className="flex-1 text-[16px]">Admin-Dashboard & Statistiken</span>
                    <Chevron />
                  </ListRow>
                </Link>
              )}
              <Link href="/admin/courts">
                <ListRow onClick={() => {}} last={user.role !== 'admin'}>
                  <span className="text-xl">🚧</span>
                  <span className="flex-1 text-[16px]">Plätze sperren / Wartung</span>
                  <Chevron />
                </ListRow>
              </Link>
              {user.role === 'admin' && (
                <Link href="/club?tab=members">
                  <ListRow onClick={() => {}} last>
                    <span className="text-xl">👥</span>
                    <span className="flex-1 text-[16px]">Mitglieder verwalten</span>
                    <Chevron />
                  </ListRow>
                </Link>
              )}
            </div>
          </div>
        )}

        <div className="card overflow-hidden">
          <ListRow last>
            <span className="text-xl">🔒</span>
            <div className="flex-1">
              <p className="text-[16px]">Datenschutz</p>
              <p className="text-secondary text-[12px]">
                DSGVO-konform · TLS-verschlüsselt · Daten in der EU · Auskunft & Löschung jederzeit
              </p>
            </div>
          </ListRow>
        </div>

        <button
          onClick={logout}
          className="card pressable w-full py-3.5 text-center text-[16px] font-semibold text-busy"
        >
          Abmelden
        </button>

        <p className="text-secondary pb-4 text-center text-[12px]">TC Grün-Weiß App · Version 1.0.0 · PWA</p>
      </div>

      <Sheet open={showNotifications} onClose={() => setShowNotifications(false)} title="Mitteilungen">
        {notifications.length === 0 ? (
          <p className="text-secondary py-8 text-center text-[15px]">Keine Mitteilungen</p>
        ) : (
          <div className="space-y-2 pb-2">
            {notifications.map((n) => (
              <div key={n.id} className="bg-fill flex gap-3 rounded-[14px] p-3">
                <span className="text-xl">{typeEmoji[n.type] ?? '🔔'}</span>
                <div className="flex-1">
                  <p className="text-[15px] font-semibold">{n.title}</p>
                  <p className="text-secondary text-[13px]">{n.body}</p>
                  <p className="text-secondary mt-0.5 text-[11px]">
                    {new Date(n.date).toLocaleString('de-DE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Sheet>
    </PullToRefresh>
  );
}
