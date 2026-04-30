'use client'

/**
 * DashboardGrid — orchestrateur de la home (Sprint C).
 *
 * Layout fixe (drag-drop désactivé sur demande Marc 2026-04-30) :
 *   1. KPI strip prominent en haut (LiveStatCards full width)
 *   2. Grille fixe 3 colonnes :
 *      - Recherche IA (full)
 *      - Spending chart (lg) + Insights (sm)
 *      - Recent transactions (lg) + Localisation (sm)
 *      - Santé (full) + Apps (full)
 *
 * Responsabilités :
 *   - SSE via useEventSource → pulse ring sur les widgets pertinents
 *   - Pas de WidgetGrid (sortable) : grille CSS directe
 */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Widget } from '@/components/widget'
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

// Col-span pour grille fixe (3 cols sur desktop, 2 sur tablet, 1 mobile)
const SPAN_FULL = 'col-span-1 sm:col-span-2 md:col-span-3'
const SPAN_LG = 'col-span-1 sm:col-span-2'
const SPAN_SM = 'col-span-1'

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

      {/* ── Grille de widgets fixe (drag-drop retiré sur demande Marc) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">

        <div className={SPAN_FULL}>
          <Widget id="ai-search" title="Recherche IA" subtitle="Qwen 2.5 14B · local" icon={Brain}>
            <AiSearchCard />
          </Widget>
        </div>

        <div className={SPAN_LG}>
          <Widget
            id="spending-chart"
            title="Dépenses · 30 jours"
            subtitle="par jour · CAD"
            icon={BarChart2}
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
        </div>

        <div className={SPAN_SM}>
          <Widget id="insights" title="Insights" icon={Sparkles} badge="Phase 4+">
            <InsightList />
          </Widget>
        </div>

        <div className={SPAN_LG}>
          <Widget
            id="recent-transactions"
            title="Transactions récentes"
            subtitle="comptes + cartes"
            icon={ArrowLeftRight}
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
        </div>

        <div className={SPAN_SM}>
          <Widget
            id="locations"
            title="Localisation"
            subtitle="Google Maps Timeline"
            icon={MapPin}
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
              <p className="text-[12px] text-ink-400">En attente du Google Takeout</p>
              <p className="text-[10px] text-ink-600 font-mono leading-relaxed">
                takeout.google.com →<br />
                Localisation → Records.json
              </p>
            </div>
          </Widget>
        </div>

        <div className={SPAN_FULL}>
          <Widget id="health" title="Santé" subtitle="Garmin · Google Fit" icon={Activity} badge="Phase 5">
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
        </div>

        <div className={SPAN_FULL}>
          <Widget id="apps" title="Mes apps" subtitle="intégrées dans les pages" icon={LayoutGrid}>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <AppTile
                name="Trajets"
                description="Carte des déplacements"
                href="/locations?tab=app"
                icon={MapPin}
                versions={[]}
                accentColor="bg-info/15 text-info"
              />
              <AppTile
                name="Finance"
                description="Comptes, abos, placements"
                href="/finances?tab=app"
                icon={Wallet}
                versions={[]}
                accentColor="bg-accent/15 text-accent"
              />
              <div className="ga-card border-dashed border-ink-700/60 p-4 flex items-center justify-center text-xs text-ink-600 hover:text-ink-400 hover:border-ink-600 transition-colors cursor-pointer">
                + Ajouter une app
              </div>
            </div>
          </Widget>
        </div>

      </div>
    </div>
  )
}
