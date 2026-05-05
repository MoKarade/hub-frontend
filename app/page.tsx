'use client'

/**
 * Home — Vision Marc 2026-05-05 : assistant central conversationnel.
 *
 * Refonte complete : avant = dashboard widgets (style GA generique).
 * Maintenant = chat conversationnel plein ecran avec :
 *   - Salutation contextuelle compacte en header
 *   - HubChat occupe la majorite de l'ecran
 *   - Cmd+K pour recherche universelle (overlay global via CommandKProvider)
 *   - Toggle pour afficher le dashboard widgets (ancien comportement) en backup
 *
 * Architecture :
 *   - Component client (state du toggle)
 *   - HubChat gere le streaming SSE + historique localStorage
 *   - Sidebar inchangee (navigation principale)
 *   - HubStatus footer en mode dashboard uniquement
 */

import { useState } from 'react'
import { Sidebar } from '@/components/sidebar'
import { HubStatus } from '@/components/hub-status'
import { HubChat } from '@/components/hub-chat'
import { DashboardGrid } from '@/components/dashboard-grid'
import { useCommandK } from '@/components/command-k'
import { Brain, LayoutGrid, MessageSquare } from 'lucide-react'
import { cn } from '@/lib/utils'

type ViewMode = 'chat' | 'dashboard'

export default function HomePage() {
  const { open: openCommandK } = useCommandK()
  const [view, setView] = useState<ViewMode>('chat')

  // Salutation locale (pas SSR pour eviter mismatch)
  const now = new Date()
  const hour = now.getHours()
  const greeting =
    hour < 6 ? 'Bonsoir' : hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon apres-midi' : 'Bonsoir'

  return (
    <div className="flex min-h-screen">
      <Sidebar />

      <main className="flex-1 px-4 sm:px-6 lg:px-8 pt-16 lg:pt-4 pb-4 max-w-[1400px] flex flex-col overflow-x-hidden">
        {/* ── Top bar compacte ── */}
        <header className="flex items-center justify-between mb-3 flex-shrink-0">
          <div className="min-w-0">
            <h1 className="text-lg font-semibold tracking-tight truncate">
              {greeting} Marc
            </h1>
            <p className="text-[11px] text-ink-500 font-mono truncate">
              {now.toLocaleDateString('fr-CA', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
              })}
              <span className="ml-2">hub local · Levis QC</span>
            </p>
          </div>

          {/* View toggle + Cmd+K */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center bg-ink-900 border border-ink-700 rounded-md p-0.5">
              <button
                type="button"
                onClick={() => setView('chat')}
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-mono rounded transition-colors',
                  view === 'chat'
                    ? 'bg-accent/15 text-accent'
                    : 'text-ink-400 hover:text-ink-200',
                )}
                aria-label="Vue chat"
                title="Chat assistant"
              >
                <MessageSquare size={11} />
                <span className="hidden sm:inline">chat</span>
              </button>
              <button
                type="button"
                onClick={() => setView('dashboard')}
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-mono rounded transition-colors',
                  view === 'dashboard'
                    ? 'bg-accent/15 text-accent'
                    : 'text-ink-400 hover:text-ink-200',
                )}
                aria-label="Vue dashboard"
                title="Dashboard widgets"
              >
                <LayoutGrid size={11} />
                <span className="hidden sm:inline">widgets</span>
              </button>
            </div>
            <button
              type="button"
              onClick={openCommandK}
              className="px-2.5 py-1 text-[11px] font-mono bg-ink-900 border border-ink-700 rounded-md hover:border-accent/40 hover:text-ink-100 transition-colors text-ink-400 flex items-center gap-1.5"
              title="Recherche universelle (Cmd+K)"
            >
              <Brain size={11} />
              <span className="hidden sm:inline">⌘K</span>
            </button>
          </div>
        </header>

        {/* ── Vue principale ── */}
        {view === 'chat' ? (
          <div className="flex-1 min-h-0">
            <HubChat onOpenCommandK={openCommandK} />
          </div>
        ) : (
          <>
            <div className="flex-1 min-h-0 space-y-4">
              <DashboardGrid />
            </div>
            <div className="mt-4 shrink-0">
              <HubStatus />
            </div>
          </>
        )}
      </main>
    </div>
  )
}
