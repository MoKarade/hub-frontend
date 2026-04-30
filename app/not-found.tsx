'use client'

/**
 * 404 page custom — design Sprint C cohérent.
 *
 * Remplace le 404 noir par défaut de Next.js. S'affiche pour toutes les routes
 * non-matchées. Inclut la sidebar pour qu'on puisse naviguer ailleurs facilement.
 */

import Link from 'next/link'
import { Sidebar } from '@/components/sidebar'
import { HubStatus } from '@/components/hub-status'
import { ArrowLeft, MapPinOff } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 px-4 sm:px-6 lg:px-8 pt-16 lg:pt-6 pb-6 max-w-[1400px] flex flex-col">
        <div className="flex-1 flex items-center justify-center py-12">
          <div className="ga-card p-8 max-w-lg text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-ink-800 border border-ink-700 flex items-center justify-center">
              <MapPinOff size={28} className="text-ink-400" />
            </div>

            <div className="font-mono text-[10px] text-ink-500 uppercase tracking-wider mb-1">
              404 · page non trouvée
            </div>
            <h1 className="text-xl font-semibold tracking-tight mb-2">
              Tu es allé un peu trop loin
            </h1>
            <p className="text-sm text-ink-400 leading-relaxed mb-6">
              Cette route n&apos;existe pas (encore). Soit elle est prévue pour une phase future,
              soit l&apos;URL est tapée à la main et ne correspond à aucune page connue du hub.
            </p>

            <div className="flex items-center justify-center gap-2 flex-wrap">
              <Link
                href="/"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-accent text-ink-950 text-sm font-semibold hover:bg-accent-light transition-colors"
              >
                <ArrowLeft size={14} />
                Retour au dashboard
              </Link>
              <Link
                href="/search"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-ink-800 border border-ink-700 text-ink-200 text-sm hover:bg-ink-700 transition-colors"
              >
                Rechercher
              </Link>
            </div>
          </div>
        </div>

        <div className="mt-auto">
          <HubStatus />
        </div>
      </main>
    </div>
  )
}
