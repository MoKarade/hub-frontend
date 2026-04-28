import { Sidebar } from '@/components/sidebar'
import { AiSearchCard } from '@/components/ai-search-card'
import { StatCard } from '@/components/stat-card'
import { InsightList } from '@/components/insight-list'
import { SpendingChart } from '@/components/spending-chart'
import { AppTile } from '@/components/app-tile'
import { HubStatus } from '@/components/hub-status'
import {
  Wallet,
  MapPin,
  ImageIcon,
  Mail,
  Sparkles,
  Activity,
  Calendar as CalendarIcon,
} from 'lucide-react'

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
              {new Date().toLocaleDateString('fr-FR', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
              })}
              {' · '}
              <span className="font-mono text-xs">last sync 2 min ago</span>
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button className="px-3 py-1.5 text-xs font-mono bg-ink-800 border border-ink-700 rounded-md hover:border-ink-600 transition-colors">
              ⌘K · rechercher
            </button>
          </div>
        </header>

        {/* AI search */}
        <section className="mb-6">
          <AiSearchCard />
        </section>

        {/* Stats */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <StatCard
            label="Solde total"
            value="$12 480"
            delta={{ value: '-3.2 %', direction: 'down', isGood: false }}
            icon={Wallet}
            sparkline={[12800, 12750, 12900, 12600, 12550, 12500, 12480]}
          />
          <StatCard
            label="Dépenses (avril)"
            value="$2 145"
            delta={{ value: '+12 %', direction: 'up', isGood: false }}
            icon={Activity}
            sparkline={[1900, 1950, 2000, 2050, 2080, 2120, 2145]}
          />
          <StatCard
            label="Km parcourus"
            value="487 km"
            delta={{ value: '+20 %', direction: 'up', isGood: true }}
            icon={MapPin}
          />
          <StatCard
            label="Photos indexées"
            value="14 230"
            delta={{ value: '+142', direction: 'up' }}
            icon={ImageIcon}
          />
        </section>

        {/* Two-col main */}
        <section className="grid grid-cols-3 gap-4 mb-6">
          <div className="col-span-2 panel p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-semibold">Dépenses sur 30 jours</h2>
                <p className="text-xs text-ink-400">par jour · USD</p>
              </div>
              <button className="text-xs text-accent hover:text-accent-light font-mono">
                voir détails →
              </button>
            </div>
            <SpendingChart />
          </div>

          <div className="panel p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Sparkles size={14} className="text-accent" />
                <h2 className="text-sm font-semibold">Insights pro-actifs</h2>
              </div>
              <span className="text-[10px] text-ink-500 font-mono">2h ago</span>
            </div>
            <InsightList />
          </div>
        </section>

        {/* Apps versionnées */}
        <section className="mb-6">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-400 mb-3">
            Mes apps embarquées
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <AppTile
              name="Trajets"
              description="Carte 3D des déplacements"
              href="/apps/trajets"
              icon={MapPin}
              versions={[
                { id: 'v1' },
                { id: 'v2' },
                { id: 'v3', isLive: true },
              ]}
              accentColor="bg-info/15 text-info"
            />
            <AppTile
              name="Finance"
              description="Comptes, abos, placements"
              href="/apps/finance"
              icon={Wallet}
              versions={[
                { id: 'v1' },
                { id: 'v2', isLive: true },
              ]}
              accentColor="bg-accent/15 text-accent"
            />
            <div className="panel p-4 border-dashed border-ink-700/60 flex items-center justify-center text-xs text-ink-500 hover:text-ink-300 transition-colors cursor-pointer">
              + Ajouter une app
            </div>
          </div>
        </section>

        {/* Sources rapides */}
        <section className="mb-6">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-400 mb-3">
            Sources de data
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <SourceQuickTile icon={Wallet} label="Finances" stat="847 transactions" updated="2m" />
            <SourceQuickTile icon={MapPin} label="Trajets" stat="487 km · avril" updated="3m" />
            <SourceQuickTile icon={Mail} label="Emails" stat="23 412 indexés" updated="2h" />
            <SourceQuickTile icon={ImageIcon} label="Photos" stat="14 230 · CLIP" updated="batch nuit" />
          </div>
        </section>

        {/* Status footer */}
        <HubStatus />
      </main>
    </div>
  )
}

function SourceQuickTile({
  icon: Icon,
  label,
  stat,
  updated,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>
  label: string
  stat: string
  updated: string
}) {
  return (
    <div className="panel panel-hover p-3 flex items-center gap-3">
      <div className="w-9 h-9 rounded-lg bg-ink-800 flex items-center justify-center">
        <Icon size={16} className="text-ink-300" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{label}</div>
        <div className="text-xs text-ink-400 truncate">{stat}</div>
      </div>
      <div className="text-[10px] text-ink-500 font-mono shrink-0">{updated}</div>
    </div>
  )
}
