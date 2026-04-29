/**
 * Dashboard home — redesign Sprint A.
 *
 * Layout : sidebar fixe + contenu principal en grille de widgets.
 * Chaque section est maintenant un Widget (titre, icône, pin, focus, size).
 * Les animations sont gérées par framer-motion via app/template.tsx (page transition)
 * et par les composants Widget/LiveStatCards (stagger, hover).
 *
 * Server Component — pas de 'use client' nécessaire.
 * Les widgets sont des Client Components importés ici, ce qui est valide en Next.js App Router.
 *
 * force-dynamic : la page utilise new Date() pour la salutation. Sans dynamic,
 * Next.js pourrait figer la date au build, causant un mismatch d'hydratation.
 */

export const dynamic = 'force-dynamic'

import { Sidebar } from '@/components/sidebar'
import { AiSearchCard } from '@/components/ai-search-card'
import { LiveStatCards } from '@/components/live-stat-cards'
import { InsightList } from '@/components/insight-list'
import { SpendingChart } from '@/components/spending-chart'
import { AppTile } from '@/components/app-tile'
import { HubStatus } from '@/components/hub-status'
import { Widget } from '@/components/widget'
import {
  Wallet,
  MapPin,
  Sparkles,
  Brain,
  BarChart2,
  LayoutGrid,
  Activity,
} from 'lucide-react'

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
          <a
            href="/search"
            className="px-3 py-1.5 text-xs font-mono bg-ink-800 border border-ink-700 rounded-md hover:border-ink-600 hover:text-ink-100 transition-colors text-ink-400 hidden md:flex items-center gap-1.5"
          >
            <Brain size={11} />
            ⌘K · rechercher
          </a>
        </header>

        {/* ── Recherche IA ── full width ── */}
        <Widget
          id="ai-search"
          title="Recherche IA"
          subtitle="Qwen 2.5 14B · local"
          icon={Brain}
          defaultSize="full"
        >
          <AiSearchCard />
        </Widget>

        {/* ── Row 1 : Vue d'ensemble + Insights ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <Widget
              id="finances-overview"
              title="Vue d'ensemble"
              subtitle="finances · live"
              icon={Wallet}
              defaultSize="lg"
              focusContent={
                <div className="text-sm text-ink-400 p-4">
                  <p>Mode focus finances complet — disponible dès que tu cliques sur{' '}
                    <a href="/finances" className="text-accent hover:underline">
                      /finances →
                    </a>
                  </p>
                </div>
              }
              headerActions={
                <a
                  href="/finances"
                  className="text-[10px] font-mono text-accent/70 hover:text-accent transition-colors shrink-0 hidden sm:block"
                >
                  tout voir →
                </a>
              }
            >
              <LiveStatCards />
            </Widget>
          </div>

          <Widget
            id="insights"
            title="Insights"
            icon={Sparkles}
            badge="Phase 4+"
            defaultSize="sm"
          >
            <InsightList />
          </Widget>
        </div>

        {/* ── Row 2 : Dépenses ── full width ── */}
        <Widget
          id="spending-chart"
          title="Dépenses · 30 jours"
          subtitle="par jour · CAD"
          icon={BarChart2}
          defaultSize="full"
          headerActions={
            <a
              href="/finances"
              className="text-[10px] font-mono text-accent/70 hover:text-accent transition-colors shrink-0 hidden sm:block"
            >
              détails →
            </a>
          }
        >
          <SpendingChart />
        </Widget>

        {/* ── Row 3 : Localisation + Activité physique (placeholder) ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Widget
            id="locations"
            title="Localisation"
            subtitle="Google Maps Timeline"
            icon={MapPin}
            defaultSize="md"
            headerActions={
              <a
                href="/locations"
                className="text-[10px] font-mono text-accent/70 hover:text-accent transition-colors shrink-0 hidden sm:block"
              >
                carte →
              </a>
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
              <a
                href="/locations"
                className="mt-2 text-xs text-accent hover:text-accent-light transition-colors font-mono"
              >
                voir la carte →
              </a>
            </div>
          </Widget>

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
        </div>

        {/* ── Row 4 : Mes apps ── */}
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

        {/* ── Status footer ── */}
        <HubStatus />
      </main>
    </div>
  )
}
