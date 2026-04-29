'use client'

/**
 * DashboardGrid — client component qui orchestre la home.
 *
 * Responsabilités :
 *   - SSE via useEventSource → pulse ring sur le widget finances quand new_transaction arrive
 *   - Passage de tous les widgets au WidgetGrid (drag-drop + col-span)
 *
 * Extracté de app/page.tsx (Server Component) pour pouvoir utiliser
 * des hooks React (useState, useEffect, useEventSource).
 */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Widget } from '@/components/widget'
import { WidgetGrid } from '@/components/widget-grid'
import { AiSearchCard } from '@/components/ai-search-card'
import { LiveStatCards } from '@/components/live-stat-cards'
import { InsightList } from '@/components/insight-list'
import { SpendingChart } from '@/components/spending-chart'
import { AppTile } from '@/components/app-tile'
import { useEventSource } from '@/lib/use-event-source'
import {
  Wallet,
  MapPin,
  Sparkles,
  Brain,
  BarChart2,
  LayoutGrid,
  Activity,
} from 'lucide-react'

// ── Config ────────────────────────────────────────────────────────────────────

const API_BASE = process.env.NEXT_PUBLIC_HUB_API_URL ?? 'http://localhost:8000'
const SSE_URL = `${API_BASE}/v1/events/stream`

/** Durée du ring-pulse en ms après un event new_transaction. */
const PULSE_DURATION_MS = 2_000

/** IDs dans l'ordre source — doit correspondre à l'ordre des enfants du WidgetGrid. */
const WIDGET_IDS = [
  'ai-search',
  'finances-overview',
  'insights',
  'spending-chart',
  'locations',
  'health',
  'apps',
] as const

// ── Component ─────────────────────────────────────────────────────────────────

export function DashboardGrid() {
  const { lastEvent } = useEventSource(SSE_URL)
  const [pulseFinances, setPulseFinances] = useState(false)

  // Déclenche le ring-pulse 2 s à chaque nouvelle transaction
  useEffect(() => {
    if (lastEvent?.type === 'new_transaction') {
      setPulseFinances(true)
      const t = setTimeout(() => setPulseFinances(false), PULSE_DURATION_MS)
      return () => clearTimeout(t)
    }
  }, [lastEvent])

  return (
    <WidgetGrid ids={[...WIDGET_IDS]}>

      {/* ── ai-search ── */}
      <Widget
        id="ai-search"
        title="Recherche IA"
        subtitle="Qwen 2.5 14B · local"
        icon={Brain}
        defaultSize="full"
      >
        <AiSearchCard />
      </Widget>

      {/* ── finances-overview ── */}
      <Widget
        id="finances-overview"
        title="Vue d'ensemble"
        subtitle="finances · live"
        icon={Wallet}
        defaultSize="lg"
        pulse={pulseFinances}
        focusContent={
          <div className="text-sm text-ink-400 p-4">
            <p>
              Mode focus finances complet — disponible dès que tu cliques sur{' '}
              <Link href="/finances" className="text-accent hover:underline">
                /finances →
              </Link>
            </p>
          </div>
        }
        headerActions={
          <Link
            href="/finances"
            className="text-[10px] font-mono text-accent/70 hover:text-accent transition-colors shrink-0 hidden sm:block"
          >
            tout voir →
          </Link>
        }
      >
        <LiveStatCards />
      </Widget>

      {/* ── insights ── */}
      <Widget
        id="insights"
        title="Insights"
        icon={Sparkles}
        badge="Phase 4+"
        defaultSize="sm"
      >
        <InsightList />
      </Widget>

      {/* ── spending-chart ── */}
      <Widget
        id="spending-chart"
        title="Dépenses · 30 jours"
        subtitle="par jour · CAD"
        icon={BarChart2}
        defaultSize="full"
        headerActions={
          <Link
            href="/finances"
            className="text-[10px] font-mono text-accent/70 hover:text-accent transition-colors shrink-0 hidden sm:block"
          >
            détails →
          </Link>
        }
      >
        <SpendingChart />
      </Widget>

      {/* ── locations ── */}
      <Widget
        id="locations"
        title="Localisation"
        subtitle="Google Maps Timeline"
        icon={MapPin}
        defaultSize="md"
        headerActions={
          <Link
            href="/locations"
            className="text-[10px] font-mono text-accent/70 hover:text-accent transition-colors shrink-0 hidden sm:block"
          >
            carte →
          </Link>
        }
      >
        <div className="flex flex-col items-center justify-center py-8 gap-2 text-center">
          <MapPin size={22} className="text-ink-600" />
          <p className="text-sm text-ink-400">
            En attente de ton Google Takeout
          </p>
          <p className="text-[11px] text-ink-600 font-mono">
            takeout.google.com → Localisation → Records.json
          </p>
          <Link
            href="/locations"
            className="mt-2 text-xs text-accent hover:text-accent-light transition-colors font-mono"
          >
            voir la carte →
          </Link>
        </div>
      </Widget>

      {/* ── health ── */}
      <Widget
        id="health"
        title="Santé"
        subtitle="Garmin · Google Fit"
        icon={Activity}
        badge="Phase 5"
        defaultSize="md"
      >
        <div className="flex flex-col items-center justify-center py-8 gap-2 text-center">
          <Activity size={22} className="text-ink-600" />
          <p className="text-sm text-ink-400">Module Garmin + Google Fit</p>
          <p className="text-[11px] text-ink-600 font-mono">
            pas · sommeil · fréquence cardiaque · VO2max
          </p>
          <span className="mt-2 text-[10px] font-mono text-ink-600 bg-ink-800 border border-ink-700 px-2 py-1 rounded">
            disponible en Phase 5
          </span>
        </div>
      </Widget>

      {/* ── apps ── */}
      <Widget
        id="apps"
        title="Mes apps"
        subtitle="embarquées versionnées"
        icon={LayoutGrid}
        defaultSize="full"
        badge="Phase 2+"
      >
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <AppTile
            name="Trajets"
            description="Carte des déplacements"
            href="/apps/trajets"
            icon={MapPin}
            versions={[]}
            accentColor="bg-info/15 text-info"
          />
          <AppTile
            name="Finance"
            description="Comptes, abos, placements"
            href="/apps/finance"
            icon={Wallet}
            versions={[]}
            accentColor="bg-accent/15 text-accent"
          />
          <div className="panel p-4 border-dashed border-ink-700/60 flex items-center justify-center text-xs text-ink-600 hover:text-ink-400 hover:border-ink-600 transition-colors cursor-pointer col-span-1">
            + Ajouter une app
          </div>
        </div>
      </Widget>

    </WidgetGrid>
  )
}
