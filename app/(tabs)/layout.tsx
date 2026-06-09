'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { BottomNav, FAB } from '@/components/BottomNav';
import { useUser } from '../providers';

export default function TabsLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useUser();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <div className="mx-auto max-w-lg space-y-4 px-4 pt-[calc(env(safe-area-inset-top)+24px)]">
        <div className="skeleton h-8 w-1/2" />
        <div className="skeleton h-36 rounded-card" />
        <div className="skeleton h-24 rounded-card" />
        <div className="skeleton h-24 rounded-card" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg pb-[calc(env(safe-area-inset-bottom)+88px)]">
      <AnimatePresence mode="wait">
        <motion.main
          key={pathname}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
        >
          {children}
        </motion.main>
      </AnimatePresence>
      <FAB />
      <BottomNav />
    </div>
  );
}
