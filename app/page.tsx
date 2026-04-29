/**
 * Dashboard home — Sprint B.
 *
 * Server Component : génère uniquement la salutation dynamique + le shell.
 * Tous les widgets sont dans <DashboardGrid> (Client Component) qui gère :
 *   - SSE (useEventSource → pulse ring sur finances)
 *   - Drag-and-drop (dnd-kit via WidgetGrid)
 *   - Persistance du layout (LayoutContext)
 *
 * force-dynamic : new Date() pour la salutation — évite le mismatch SSR/hydration.
 */

import Link from 'next/link'
import { Sidebar } from '@/components/sidebar'
import { HubStatus } from '@/components/hub-status'
import { DashboardGrid } from '@/components/dashboard-grid'
import { Brain } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default function DashboardPage() {
  const now = new Date()
  const hour = now.getHours()
  const greeting =
    hour < 6 ? 'Bonsoir' : hour < 12 ? 'Bonjour' : hour < 18 ? 'Bonne après-midi' : 'Bonsoir'

  return (
    <div className="flex min-h-screen">
      <Sidebar />

      <main className="flex-1 px-6 py-6 max-w-[1400px] space-y-4 overflow-x-hidden">
        {/* ── Top bar ── */}
        <header className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {greeting} Marc
            </h1>
            <p className="text-sm text-ink-400 mt-0.5">
              {now.toLocaleDateString('fr-CA', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
              })}
              <span className="font-mono text-xs text-ink-500 ml-2">
                hub local · Lévis QC
              </span>
            </p>
          </div>
          <Link
            href="/search"
            className="px-3 py-1.5 text-xs font-mono bg-ink-800 border border-ink-700 rounded-md hover:border-ink-600 hover:text-ink-100 transition-colors text-ink-400 hidden md:flex items-center gap-1.5"
          >
            <Brain size={11} />
            ⌘K · rechercher
          </Link>
        </header>

        {/* ── Widget grid (sortable, SSE-live) ── */}
        <DashboardGrid />

        {/* ── Status footer ── */}
        <HubStatus />
      </main>
    </div>
  )
}
