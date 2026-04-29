import { Sidebar } from '@/components/sidebar'
import { AiSearchCard } from '@/components/ai-search-card'
import { LiveStatCards } from '@/components/live-stat-cards'
import { InsightList } from '@/components/insight-list'
import { SpendingChart } from '@/components/spending-chart'
import { AppTile } from '@/components/app-tile'
import { HubStatus } from '@/components/hub-status'
import { Wallet, MapPin, Sparkles } from 'lucide-react'

export default function DashboardPage() {
  return (
    <div className="flex min-h-screen">
      <Sidebar />

      <main className="flex-1 px-8 py-6 max-w-[1400px]">
        {/* Top bar */}
        <header className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Bonjour Marc</h1>
            <p className="text-sm text-ink-400">
              {new Date().toLocaleDateString('fr-CA', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
              })}
              {' · '}
              <span className="font-mono text-xs">hub local · Lévis QC</span>
            </p>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="/search"
              className="px-3 py-1.5 text-xs font-mono bg-ink-800 border border-ink-700 rounded-md hover:border-ink-600 transition-colors"
            >
              ⌘K · rechercher
            </a>
          </div>
        </header>

        {/* AI search */}
        <section className="mb-6">
          <AiSearchCard />
        </section>

        {/* Stats live (depuis l'API) */}
        <LiveStatCards />

        {/* Two-col main */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
          <div className="lg:col-span-2 panel p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-semibold">Dépenses sur 30 jours</h2>
                <p className="text-xs text-ink-400">par jour · CAD</p>
              </div>
              <a href="/finances" className="text-xs text-accent hover:text-accent-light font-mono">
                voir détails →
              </a>
            </div>
            <SpendingChart />
          </div>

          <div className="panel p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Sparkles size={14} className="text-accent" />
                <h2 className="text-sm font-semibold">Insights pro-actifs</h2>
              </div>
              <span className="text-[10px] text-ink-500 font-mono">Phase 4+</span>
            </div>
            <InsightList />
          </div>
        </section>

        {/* Apps versionnées (Phase 2+) */}
        <section className="mb-6">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-400 mb-3">
            Mes apps embarquées <span className="text-ink-500">· prévues Phase 2+</span>
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
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
            <div className="panel p-4 border-dashed border-ink-700/60 flex items-center justify-center text-xs text-ink-500 hover:text-ink-300 transition-colors cursor-pointer">
              + Ajouter une app
            </div>
          </div>
        </section>

        {/* Status footer */}
        <HubStatus />
      </main>
    </div>
  )
}
