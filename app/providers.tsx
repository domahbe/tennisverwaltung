'use client';

import { apiFetch } from '@/lib/clientApi';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { SessionUser } from '@/lib/types';

/* ---------- Haptik ---------- */
export function haptic(pattern: number | number[] = 10) {
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(pattern);
  } catch {}
}

/* ---------- Theme ---------- */
interface ThemeCtx {
  dark: boolean;
  toggle: () => void;
}
const ThemeContext = createContext<ThemeCtx>({ dark: false, toggle: () => {} });
export const useTheme = () => useContext(ThemeContext);

/* ---------- User ---------- */
interface UserCtx {
  user: SessionUser | null;
  loading: boolean;
  refresh: () => Promise<void>;
  setUser: (u: SessionUser | null) => void;
}
const UserContext = createContext<UserCtx>({ user: null, loading: true, refresh: async () => {}, setUser: () => {} });
export const useUser = () => useContext(UserContext);

/* ---------- Toast ---------- */
interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}
const ToastContext = createContext<{ toast: (msg: string, type?: Toast['type']) => void }>({ toast: () => {} });
export const useToast = () => useContext(ToastContext);

export function Providers({ children }: { children: React.ReactNode }) {
  const [dark, setDark] = useState(false);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    setDark(document.documentElement.classList.contains('dark'));
  }, []);

  const toggle = useCallback(() => {
    haptic();
    setDark((d) => {
      const next = !d;
      document.documentElement.classList.toggle('dark', next);
      localStorage.setItem('theme', next ? 'dark' : 'light');
      return next;
    });
  }, []);

  const refresh = useCallback(async () => {
    try {
      const res = await apiFetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const toast = useCallback((message: string, type: Toast['type'] = 'success') => {
    haptic(type === 'error' ? [30, 50, 30] : 10);
    const id = Date.now();
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2800);
  }, []);

  return (
    <ThemeContext.Provider value={{ dark, toggle }}>
      <UserContext.Provider value={{ user, loading, refresh, setUser }}>
        <ToastContext.Provider value={{ toast }}>
          {children}
          <div className="pointer-events-none fixed inset-x-0 top-0 z-[100] flex flex-col items-center gap-2 pt-[calc(env(safe-area-inset-top)+12px)]">
            <AnimatePresence>
              {toasts.map((t) => (
                <motion.div
                  key={t.id}
                  initial={{ y: -60, opacity: 0, scale: 0.9 }}
                  animate={{ y: 0, opacity: 1, scale: 1 }}
                  exit={{ y: -40, opacity: 0, scale: 0.95 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                  className="glass flex items-center gap-2 rounded-full border px-5 py-3 text-[15px] font-medium shadow-card"
                >
                  <span>{t.type === 'success' ? '✅' : t.type === 'error' ? '⚠️' : 'ℹ️'}</span>
                  {t.message}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </ToastContext.Provider>
      </UserContext.Provider>
    </ThemeContext.Provider>
  );
}
