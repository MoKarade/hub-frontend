'use client'

/**
 * Providers — wrapper client pour app/layout.tsx.
 *
 * Regroupe tous les providers globaux qui nécessitent 'use client'
 * (framer-motion AnimatePresence, LayoutProvider, futurs: ThemeProvider, etc.)
 * pour garder app/layout.tsx en Server Component.
 */

import { LayoutProvider } from '@/lib/layout-context'

interface ProvidersProps {
  children: React.ReactNode
}

export function Providers({ children }: ProvidersProps) {
  return (
    <LayoutProvider>
      {children}
    </LayoutProvider>
  )
}
