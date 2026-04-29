'use client'

/**
 * DashboardGrid — orchestrateur de la home (Sprint C).
 *
 * Layout Google Analytics :
 *   1. KPI strip prominent en haut (LiveStatCards full width, hors WidgetGrid)
 *   2. WidgetGrid sortable :
 *      - Recherche IA (full)
 *      - Spending chart (lg) + Insights (sm)
 *      - Recent transactions (lg) + Localisation (sm)
 *      - Santé (full) + Apps (full)
 *
 * Responsabilités :
 *   - SSE via useEventSource → pulse ring sur les widgets pertinents
 *   - Layout fixe bien pensé en grille 3 colonnes (col-span auto par taille)
 */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Widget } from '@/components/widget'
import { WidgetGrid } from '@/components/widget-grid'
import { AiSearchCard } from '@/components/ai-search-card'
import { LiveStatCards } from '@/components/live-stat-cards'
import { InsightList } from '@/components/insight-list'
import { SpendingChart } from '@/components/spending-chart'
import { RecentTransactions } from '@/components/recent-transactions'
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
  ArrowLeftRight,
} from 'lucide-react'

// ── Config ────────────────────────────────────────────────────────────────────

const API_BASE = process.env.NEXT_PUBLIC_HUB_API_URL ?? 'http://localhost:8000'
const SSE_URL = `${API_BASE}/v1/events/stream`

const PULSE_DURATION_MS = 2_000

const WIDGET_IDS = [
  'ai-search',
  'spending-chart',
  'insights',
  'recent-transactions',
  'locations',
  'health',
  'apps',
] as const

// ── Component ─────────────────────────────────────────────────────────────────

export function DashboardGrid() {
  const { lastEvent } = useEventSource(SSE_URL)
  const [pulseTransactions, setPulseTransactions] = useState(false)

  // Ring-pulse 2s sur le widget Recent transactions à chaque new_transaction
  useEffect(() => {
    if (lastEvent?.type === 'new_transaction') {
      setPulseTransactions(true)
      const t = setTimeout(() => setPulseTransactions(false), PULSE_DURATION_MS)
      return () => clearTimeout(t)
    }
  }, [lastEvent])

  return (
    <div className="space-y-4">

      {/* ── KPI strip (Google Analytics style — toujours en haut, non-sortable) ── */}
      <section aria-labelledby="kpi-heading">
        <h2 id="kpi-heading" className="sr-only">
          Indicateurs clés
        </h2>
        <LiveStatCards />
      </section>

      {/* ── Grille de widgets sortable ── */}
      <WidgetGrid ids={[...WIDGET_IDS]}>

        {/* ── ai-search (full width) ── */}
        <Widget
          id="ai-search"
          title="Recherche IA"
          subtitle="Qwen 2.5 14B · local"
          icon={Brain}
          defaultSize="full"
        >
          <AiSearchCard />
        </Widget>

        {/* ── spending-chart (lg = 2 cols) ── */}
        <Widget
          id="spending-chart"
          title="Dépenses · 30 jours"
          subtitle="par jour · CAD"
          icon={BarChart2}
          defaultSize="lg"
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

        {/* ── insights (sm = 1 col) ── */}
        <Widget
          id="insights"
          title="Insights"
          icon={Sparkles}
          badge="Phase 4+"
          defaultSize="sm"
        >
          <InsightList />
        </Widget>

        {/* ── recent-transactions (lg = 2 cols) ── */}
        <Widget
          id="recent-transactions"
          title="Transactions récentes"
          subtitle="comptes + cartes"
          icon={ArrowLeftRight}
          defaultSize="lg"
          noPadding
          pulse={pulseTransactions}
          headerActions={
            <Link
              href="/finances"
              className="text-[10px] font-mono text-accent/70 hover:text-accent transition-colors shrink-0 hidden sm:block"
            >
              tout voir →
            </Link>
          }
        >
          <RecentTransactions limit={8} />
        </Widget>

        {/* ── locations (sm = 1 col) ── */}
        <Widget
          id="locations"
          title="Localisation"
          subtitle="Google Maps Timeline"
          icon={MapPin}
          defaultSize="sm"
          headerActions={
            <Link
              href="/locations"
              className="text-[10px] font-mono text-accent/70 hover:text-accent transition-colors shrink-0 hidden sm:block"
            >
              carte →
            </Link>
          }
        >
          <div className="flex flex-col items-center justify-center py-6 gap-2 text-center">
            <MapPin size={20} className="text-ink-600" />
            <p className="text-[12px] text-ink-400">
              En attente du Google Takeout
            </p>
            <p className="text-[10px] text-ink-600 font-mono leading-relaxed">
              takeout.google.com →<br />
              Localisation → Records.json
            </p>
          </div>
        </Widget>

        {/* ── health (full width) ── */}
        <Widget
          id="health"
          title="Santé"
          subtitle="Garmin · Google Fit"
          icon={Activity}
          badge="Phase 5"
          defaultSize="full"
        >
          <div className="flex flex-col items-center justify-center py-6 gap-2 text-center">
            <Activity size={20} className="text-ink-600" />
            <p className="text-sm text-ink-400">Module Garmin + Google Fit</p>
            <p className="text-[11px] text-ink-600 font-mono">
              pas · sommeil · fréquence cardiaque · VO2max
            </p>
            <span className="mt-2 text-[10px] font-mono text-ink-600 bg-ink-800 border border-ink-700 px-2 py-1 rounded">
              disponible en Phase 5
            </span>
          </div>
        </Widget>

        {/* ── apps (full width) ── */}
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
            <div className="ga-card border-dashed border-ink-700/60 p-4 flex items-center justify-center text-xs text-ink-600 hover:text-ink-400 hover:border-ink-600 transition-colors cursor-pointer">
              + Ajouter une app
            </div>
          </div>
        </Widget>

      </WidgetGrid>
    </div>
  )
}
