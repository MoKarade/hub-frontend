'use client'

/**
 * Providers — wrapper client pour app/layout.tsx.
 *
 * Regroupe tous les providers globaux qui nécessitent 'use client'
 * (framer-motion AnimatePresence, LayoutProvider, futurs: ThemeProvider, etc.)
 * pour garder app/layout.tsx en Server Component.
 */

import type { ReactNode } from 'react'
import { AnimatePresence } from 'framer-motion'
import { LayoutProvider } from '@/lib/layout-context'

interface ProvidersProps {
  children: ReactNode
}

export function Providers({ children }: ProvidersProps) {
  return (
    <LayoutProvider>
      {/* AnimatePresence ici active les animations exit() sur toutes les pages */}
      <AnimatePresence mode="wait">
        {children}
      </AnimatePresence>
    </LayoutProvider>
  )
}
