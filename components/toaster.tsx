'use client'

/**
 * Toaster — wrapper Sonner avec style Sprint C (Google Analytics dark).
 *
 * Usage: <Toaster /> dans le layout, puis dans n'importe quel composant:
 *   import { toast } from '@/lib/toast'
 *   toast.success('Sauvegardé')
 *   toast.error('Connexion perdue')
 *   toast.info('5 nouveaux points GPS importés')
 */

import { Toaster as SonnerToaster } from 'sonner'

export function Toaster() {
  return (
    <SonnerToaster
      position="top-right"
      theme="dark"
      richColors={false} // on gère les couleurs nous-mêmes via toastOptions
      closeButton
      duration={4000}
      gap={8}
      offset={16}
      toastOptions={{
        // Style cohérent avec .ga-card (Sprint C)
        classNames: {
          toast: 'ga-card !bg-ink-900 !border-ink-700 !text-ink-100 !shadow-lg !rounded-lg',
          title: '!text-sm !font-semibold !text-ink-100',
          description: '!text-xs !text-ink-300',
          actionButton: '!bg-accent !text-ink-950 !text-xs !font-semibold !rounded-md',
          cancelButton: '!bg-ink-800 !border-ink-700 !text-ink-300 !text-xs !rounded-md',
          closeButton: '!bg-ink-800 !border-ink-700 !text-ink-400 hover:!text-ink-100',
          success: '!border-data-positive/30 !bg-data-positive/5',
          error: '!border-data-negative/30 !bg-data-negative/5',
          info: '!border-info/30 !bg-info/5',
          warning: '!border-warn/30 !bg-warn/5',
        },
      }}
    />
  )
}
