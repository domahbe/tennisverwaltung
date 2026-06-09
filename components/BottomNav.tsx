'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { haptic } from '@/app/providers';

const tabs = [
  {
    href: '/',
    label: 'Heute',
    icon: (a: boolean) => (
      <svg width="26" height="26" viewBox="0 0 24 24" fill={a ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={a ? 0 : 1.8}>
        <path d="M3 10.5L12 3l9 7.5V20a1 1 0 01-1 1h-5v-6h-6v6H4a1 1 0 01-1-1v-9.5z" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    href: '/booking',
    label: 'Buchen',
    icon: (a: boolean) => (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={a ? 2.4 : 1.8}>
        <rect x="3" y="4" width="18" height="16" rx="3" />
        <path d="M12 4v16M3 12h18" />
      </svg>
    ),
  },
  {
    href: '/calendar',
    label: 'Kalender',
    icon: (a: boolean) => (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={a ? 2.4 : 1.8}>
        <rect x="3" y="5" width="18" height="16" rx="3" />
        <path d="M3 10h18M8 3v4M16 3v4" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: '/club',
    label: 'Verein',
    icon: (a: boolean) => (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={a ? 2.4 : 1.8}>
        <circle cx="9" cy="8" r="3.2" />
        <circle cx="16.5" cy="9.5" r="2.6" />
        <path d="M3.5 19c.6-3 2.8-5 5.5-5s4.9 2 5.5 5M14.5 14.3c2.3.3 4 2 4.5 4.7" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: '/profile',
    label: 'Profil',
    icon: (a: boolean) => (
      <svg width="26" height="26" viewBox="0 0 24 24" fill={a ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={a ? 0 : 1.8}>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21c.8-4 4-6.5 8-6.5s7.2 2.5 8 6.5" strokeLinecap="round" />
      </svg>
    ),
  },
];

export function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <nav className="glass fixed inset-x-0 bottom-0 z-30 border-t safe-bottom">
      <div className="mx-auto flex max-w-lg items-stretch">
        {tabs.map((t) => {
          const active = t.href === '/' ? pathname === '/' : pathname.startsWith(t.href);
          return (
            <Link
              key={t.href}
              href={t.href}
              onClick={() => haptic(8)}
              className="flex flex-1 flex-col items-center gap-0.5 pb-1.5 pt-2"
            >
              <span className={active ? 'text-[var(--primary)]' : 'text-secondary'}>{t.icon(active)}</span>
              <span className={`text-[10px] font-medium ${active ? 'text-[var(--primary)]' : 'text-secondary'}`}>
                {t.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function FAB() {
  const router = useRouter();
  const pathname = usePathname();
  if (pathname.startsWith('/booking')) return null;
  return (
    <motion.button
      whileTap={{ scale: 0.88 }}
      onClick={() => {
        haptic(12);
        router.push('/booking?new=1');
      }}
      aria-label="Platz buchen"
      className="fixed bottom-[calc(env(safe-area-inset-bottom)+76px)] right-5 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--primary)] text-white shadow-fab"
    >
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
        <path d="M12 5v14M5 12h14" strokeLinecap="round" />
      </svg>
    </motion.button>
  );
}
