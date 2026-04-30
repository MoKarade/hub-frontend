'use client'

/**
 * Providers — wrapper client pour app/layout.tsx.
 *
 * Regroupe tous les providers globaux qui nécessitent 'use client'
 * (LayoutProvider, futurs: ThemeProvider, etc.) pour garder
 * app/layout.tsx en Server Component.
 *
 * Note: les transitions de page sont gérées dans app/template.tsx
 * (motion.div avec pageTransition variants), pas ici. AnimatePresence
 * au niveau layout cause des conflits de key avec les autres enfants
 * (InstallPrompt, etc.) et ne donne pas de vrai exit() en App Router.
 */

import type { ReactNode } from 'react'
import { LayoutProvider } from '@/lib/layout-context'

interface ProvidersProps {
  children: ReactNode
}

export function Providers({ children }: ProvidersProps) {
  return <LayoutProvider>{children}</LayoutProvider>
}
