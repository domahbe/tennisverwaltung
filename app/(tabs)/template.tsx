'use client';

import { motion } from 'framer-motion';

/**
 * Template wird bei jedem Routenwechsel neu gemountet → sanfte Einblend-
 * Animation ohne Exit-Phase. (AnimatePresence mit mode="wait" im Layout
 * blieb bei schnellen Tab-Wechseln hängen: Seite blieb unsichtbar und die
 * Navigation wirkte eingefroren.)
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
    >
      {children}
    </motion.div>
  );
}
