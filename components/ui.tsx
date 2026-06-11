'use client';

import { ReactNode, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { haptic } from '@/app/providers';

/* ---------- Segmented Control (Apple-Stil) ----------
   Thumb bewusst ohne layoutId/Layout-Projektion animiert: layoutId-Elemente
   in schließenden Sheets blockierten AnimatePresence-Exits (unsichtbares
   Overlay blieb stehen → Buttons wirkten tot). Eine reine Transform-
   Animation hat dieses Problem nicht. */
export function Segmented({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  const index = Math.max(0, options.findIndex((o) => o.value === value));
  return (
    <div className="bg-fill relative flex rounded-[10px] p-0.5">
      <motion.span
        aria-hidden
        className="absolute bottom-0.5 top-0.5 rounded-[8px] bg-[var(--card-opaque)] shadow-sm"
        style={{ width: `calc((100% - 4px) / ${options.length})` }}
        initial={false}
        animate={{ x: `${index * 100}%` }}
        transition={{ type: 'spring', stiffness: 500, damping: 35 }}
      />
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => {
            haptic();
            onChange(o.value);
          }}
          className="relative z-10 flex-1 rounded-[8px] px-2 py-1.5 text-[13px] font-medium"
        >
          <span className={value === o.value ? '' : 'text-secondary'}>{o.label}</span>
        </button>
      ))}
    </div>
  );
}

/* ---------- Bottom Sheet ---------- */
export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}) {
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="sheet-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]"
        />
      )}
      {open && (
        <motion.div
          key="sheet-panel"
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', stiffness: 380, damping: 38 }}
          drag="y"
          dragConstraints={{ top: 0 }}
          dragElastic={{ top: 0, bottom: 0.6 }}
          onDragEnd={(_, info) => {
            if (info.offset.y > 120 || info.velocity.y > 600) onClose();
          }}
          className="card fixed inset-x-0 bottom-0 z-50 max-h-[88dvh] overflow-hidden rounded-b-none rounded-t-sheet pb-[env(safe-area-inset-bottom)]"
        >
          <div className="flex justify-center pb-1 pt-2.5">
            <div className="bg-fill h-1 w-10 rounded-full" />
          </div>
          {title && <h2 className="px-5 pb-2 pt-1 text-[20px] font-bold">{title}</h2>}
          <div className="max-h-[76dvh] overflow-y-auto px-5 pb-6">{children}</div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ---------- Avatar (Foto oder Initialen) ---------- */
export function Avatar({
  initials,
  color,
  size = 40,
  photo,
}: {
  initials: string;
  color: string;
  size?: number;
  photo?: string | null;
}) {
  if (photo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photo}
        alt={initials}
        className="shrink-0 rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full font-semibold text-white"
      style={{ width: size, height: size, background: color, fontSize: size * 0.38 }}
    >
      {initials}
    </div>
  );
}

/* ---------- Skeletons ---------- */
export function SkeletonCard({ lines = 2, height }: { lines?: number; height?: number }) {
  return (
    <div className="card space-y-3 p-4" style={height ? { height } : undefined}>
      <div className="skeleton h-4 w-2/5" />
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="skeleton h-3" style={{ width: `${85 - i * 18}%` }} />
      ))}
    </div>
  );
}

/* ---------- Status Badge ---------- */
export function StatusDot({ status }: { status: 'free' | 'soon' | 'busy' | 'blocked' }) {
  const colors = { free: '#34C759', soon: '#FF9500', busy: '#FF3B30', blocked: '#8E8E93' };
  const labels = { free: 'Frei', soon: 'Bald belegt', busy: 'Belegt', blocked: 'Gesperrt' };
  return (
    <span className="flex items-center gap-1.5 text-[13px] font-medium" style={{ color: colors[status] }}>
      <span className="h-2 w-2 rounded-full" style={{ background: colors[status] }} />
      {labels[status]}
    </span>
  );
}

/* ---------- Pull to Refresh ---------- */
export function PullToRefresh({ onRefresh, children }: { onRefresh: () => Promise<void>; children: ReactNode }) {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef<number | null>(null);

  return (
    <div
      onTouchStart={(e) => {
        if (window.scrollY <= 0) startY.current = e.touches[0].clientY;
        else startY.current = null;
      }}
      onTouchMove={(e) => {
        if (startY.current === null || refreshing) return;
        const dy = e.touches[0].clientY - startY.current;
        if (dy > 0 && window.scrollY <= 0) setPull(Math.min(90, dy * 0.45));
      }}
      onTouchEnd={async () => {
        if (pull > 55 && !refreshing) {
          haptic(15);
          setRefreshing(true);
          setPull(48);
          await onRefresh();
          setRefreshing(false);
        }
        setPull(0);
        startY.current = null;
      }}
    >
      <div
        className="flex items-center justify-center overflow-hidden transition-[height] duration-200"
        style={{ height: pull, transitionDuration: refreshing || pull === 0 ? '200ms' : '0ms' }}
      >
        <motion.div
          animate={refreshing ? { rotate: 360 } : { rotate: pull * 4 }}
          transition={refreshing ? { repeat: Infinity, duration: 0.8, ease: 'linear' } : { duration: 0 }}
          className="text-xl"
        >
          🎾
        </motion.div>
      </div>
      {children}
    </div>
  );
}

/* ---------- Liste mit iOS-Trennern ---------- */
export function ListRow({
  children,
  onClick,
  last = false,
}: {
  children: ReactNode;
  onClick?: () => void;
  last?: boolean;
}) {
  return (
    <div
      onClick={onClick}
      className={`flex min-h-[52px] items-center gap-3 px-4 py-2.5 ${onClick ? 'pressable cursor-pointer' : ''} ${
        last ? '' : 'separator border-b'
      }`}
    >
      {children}
    </div>
  );
}

export function Chevron() {
  return (
    <svg width="8" height="14" viewBox="0 0 8 14" fill="none" className="text-secondary shrink-0 opacity-60">
      <path d="M1 1l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
