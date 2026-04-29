'use client'

/**
 * app/template.tsx — transition de page pour Next.js App Router.
 *
 * Contrairement à layout.tsx (qui persiste entre navigations),
 * template.tsx re-monte à chaque changement de route. Cela permet
 * à framer-motion d'animer l'entrée de chaque page.
 *
 * Pattern recommandé par framer-motion pour Next.js App Router.
 */

import { motion } from 'framer-motion'
import { pageTransition } from '@/lib/motion'

export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      variants={pageTransition}
      initial="initial"
      animate="animate"
    >
      {children}
    </motion.div>
  )
}
