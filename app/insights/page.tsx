'use client'

/**
 * Page Insights — anomalies, patterns, alertes proactives.
 *
 * Branche en live sur GET /v1/insights qui agrege locations + calendar +
 * tasks + finance + emails + health (cf. hub-core/src/api/v1/insights.py).
 *
 * Pas de fake data — si l'API renvoie 0 insights, on affiche un empty state.
 */

import { useState } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import { Sidebar } from '@/components/sidebar'
import { HubStatus } from '@/components/hub-status'
import {
  Sparkles,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  Bell,
  Zap,
  Calendar,
  Home,
  MapPin,
  Wallet,
  Mail,
  Heart,
  CheckSquare,
  Activity,
  Loader2,
  RefreshCw,
  Search,
  Filter,
  X,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { getBaseUrl } from '@/lib/api'
import { EmptyState } from '@/components/empty-state'
import { ErrorState } from '@/components/error-state'
import { LoadingSkeleton } from '@/components/loading-skeleton'

type Severity = 'critical' | 'warning' | 'info' | 'positive'

interface InsightApi {
  severity: Severity
  icon: string  // string name (lucide), mappe via ICON_MAP
  title: string
  description: string
  delta?: string | null
  action?: string | null
  action_url?: string | null
  source: string
  metric_value?: number | null
  generated_at?: string
}

interface InsightsResponse {
  insights: InsightApi[]
  generated_at: string
  total: number
  by_severity: Record<string, number>
}

// Map des noms d'icones (string venant du backend) -> composants lucide
const ICON_MAP: Record<string, LucideIcon> = {
  Sparkles,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  Bell,
  Zap,
  Calendar,
  Home,
  MapPin,
  Wallet,
  Mail,
  Heart,
  CheckSquare,
  Activity,
}

const SEVERITY_STYLES: Record<
  Severity,
  { dot: string; border: string; bg: string; iconColor: string; rank: number }
> = {
  critical: {
    dot: 'bg-data-negative',
    border: 'border-data-negative/30',
    bg: 'bg-data-negative/5',
    iconColor: 'text-data-negative',
    rank: 0,
  },
  warning: {
    dot: 'bg-warn',
    border: 'border-warn/30',
    bg: 'bg-warn/5',
    iconColor: 'text-warn',
    rank: 1,
  },
  info: {
    dot: 'bg-info',
    border: 'border-info/30',
    bg: 'bg-info/5',
    iconColor: 'text-info',
    rank: 2,
  },
  positive: {
    dot: 'bg-data-positive',
    border: 'border-data-positive/30',
    bg: 'bg-data-positive/5',
    iconColor: 'text-data-positive',
    rank: 3,
  },
}

const fetcher = (url: string) => fetch(url).then((r) => r.json())

type ViewMode = 'flat' | 'grouped'

export default function InsightsPage() {
  const { data, error, isLoading, mutate } = useSWR<InsightsResponse>(
    `${getBaseUrl()}/v1/insights`,
    fetcher,
    { refreshInterval: 5 * 60_000 },  // refresh chaque 5 min
  )

  const allInsights = data?.insights ?? []
  const bySeverity = data?.by_severity ?? {}

  // Filtres
  const [severityFilter, setSeverityFilter] = useState<Severity | 'all'>('all')
  const [sourceFilter, setSourceFilter] = useState<string>('all')
  const [searchQ, setSearchQ] = useState('')
  const [viewMode, setViewMode] = useState<ViewMode>('flat')

  // Liste des sources disponibles (deduit live)
  const availableSources = Array.from(
    new Set(allInsights.map((i) => i.source)),
  ).sort()

  // Filtrage applique
  const insights = allInsights.filter((ins) => {
    if (severityFilter !== 'all' && ins.severity !== severityFilter) return false
    if (sourceFilter !== 'all' && ins.source !== sourceFilter) return false
    if (searchQ.trim()) {
      const q = searchQ.toLowerCase()
      if (
        !ins.title.toLowerCase().includes(q) &&
        !ins.description.toLowerCase().includes(q)
      ) {
        return false
      }
    }
    return true
  })

  // Group by source pour mode grouped
  const grouped: Record<string, InsightApi[]> = {}
  if (viewMode === 'grouped') {
    insights.forEach((ins) => {
      ;(grouped[ins.source] ||= []).push(ins)
    })
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 px-4 sm:px-6 lg:px-8 pt-16 lg:pt-6 pb-6 max-w-[1400px] flex flex-col">
        <header className="mb-4 flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Insights</h1>
            <p className="text-sm text-ink-400">
              Anomalies, patterns et alertes proactives · cross-source
            </p>
          </div>
          <button
            onClick={() => mutate()}
            disabled={isLoading}
            className="px-3 py-2 rounded-md text-xs font-semibold bg-ink-800 border border-ink-700 hover:border-ink-600 inline-flex items-center gap-1.5 disabled:opacity-40"
          >
            {isLoading ? (
              <Loader2 size={11} className="animate-spin" />
            ) : (
              <RefreshCw size={11} />
            )}
            Actualiser
          </button>
        </header>

        {/* KPI strip — vraies stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-4">
          <KpiTile
            label="Total"
            value={String(data?.total ?? '—')}
            icon={Sparkles}
          />
          <KpiTile
            label="Critiques"
            value={String(bySeverity.critical ?? 0)}
            color={bySeverity.critical ? 'text-data-negative' : ''}
          />
          <KpiTile
            label="À surveiller"
            value={String(bySeverity.warning ?? 0)}
            color={bySeverity.warning ? 'text-warn' : ''}
          />
          <KpiTile
            label="Positifs"
            value={String(bySeverity.positive ?? 0)}
            color={bySeverity.positive ? 'text-data-positive' : ''}
          />
        </div>

        {/* Erreur */}
        {error && (
          <div className="mb-4">
            <ErrorState error={error} onRetry={() => mutate()} />
          </div>
        )}

        {/* Loading skeleton */}
        {isLoading && !data && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
            <LoadingSkeleton variant="card" count={1} />
            <LoadingSkeleton variant="card" count={1} />
            <LoadingSkeleton variant="card" count={1} />
            <LoadingSkeleton variant="card" count={1} />
          </div>
        )}

        {/* Empty state */}
        {!isLoading && !error && allInsights.length === 0 && (
          <EmptyState
            icon={CheckCircle2}
            title="Tout est sous contrôle"
            description="Aucune anomalie ni pattern à signaler dans tes données. L'analyse tourne automatiquement chaque jour à 8h Québec."
            className="mb-6"
          />
        )}

        {/* Barre de filtres */}
        {allInsights.length > 0 && (
          <div className="panel p-3 mb-4 space-y-2">
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-500" />
                <input
                  type="text"
                  value={searchQ}
                  onChange={(e) => setSearchQ(e.target.value)}
                  placeholder="Rechercher dans titre / description..."
                  className="w-full bg-ink-800 border border-ink-700 rounded-md pl-9 pr-3 py-2 text-xs focus:outline-none focus:border-accent/60"
                />
              </div>
              <div className="flex gap-2">
                <select
                  value={sourceFilter}
                  onChange={(e) => setSourceFilter(e.target.value)}
                  className="bg-ink-800 border border-ink-700 rounded-md px-3 py-2 text-xs flex-1 sm:flex-none"
                >
                  <option value="all">Toutes sources</option>
                  {availableSources.map((src) => (
                    <option key={src} value={src}>
                      {src}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setViewMode(viewMode === 'flat' ? 'grouped' : 'flat')}
                  className="px-3 py-2 rounded-md text-xs bg-ink-800 border border-ink-700 hover:border-ink-600 inline-flex items-center gap-1.5"
                  title="Toggle grouper par source"
                >
                  <Filter size={11} />
                  {viewMode === 'flat' ? 'Plat' : 'Groupé'}
                </button>
              </div>
            </div>
            {/* Severity chips */}
            <div className="tabs-scrollable sm:flex sm:flex-wrap sm:gap-1">
              {(['all', 'critical', 'warning', 'info', 'positive'] as const).map((sev) => {
                const count =
                  sev === 'all'
                    ? allInsights.length
                    : (bySeverity[sev] ?? 0)
                if (sev !== 'all' && count === 0) return null
                return (
                  <button
                    key={sev}
                    type="button"
                    onClick={() => setSeverityFilter(sev)}
                    className={cn(
                      'px-2 py-1 rounded text-[11px] whitespace-nowrap shrink-0 inline-flex items-center gap-1.5',
                      severityFilter === sev
                        ? 'bg-accent/15 border border-accent/40 text-accent'
                        : 'bg-ink-800 border border-ink-700 text-ink-400 hover:border-ink-600',
                    )}
                  >
                    {sev !== 'all' && (
                      <span
                        className={cn(
                          'w-1.5 h-1.5 rounded-full',
                          SEVERITY_STYLES[sev as Severity].dot,
                        )}
                      />
                    )}
                    {sev === 'all' ? 'Tout' : sev}
                    <span className="font-mono text-ink-500">({count})</span>
                  </button>
                )
              })}
              {(severityFilter !== 'all' || sourceFilter !== 'all' || searchQ) && (
                <button
                  type="button"
                  onClick={() => {
                    setSeverityFilter('all')
                    setSourceFilter('all')
                    setSearchQ('')
                  }}
                  className="px-2 py-1 rounded text-[11px] text-ink-500 hover:text-data-negative inline-flex items-center gap-1"
                >
                  <X size={10} /> reset
                </button>
              )}
            </div>
            {insights.length !== allInsights.length && (
              <p className="text-[10px] text-ink-500 font-mono">
                {insights.length} / {allInsights.length} insights affichés
              </p>
            )}
          </div>
        )}

        {/* Grid des insights live */}
        {insights.length > 0 && viewMode === 'flat' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
            {insights.map((insight, i) => (
              <InsightCardView key={i} insight={insight} />
            ))}
          </div>
        )}

        {/* Vue groupée par source */}
        {insights.length > 0 && viewMode === 'grouped' && (
          <div className="space-y-4 mb-6">
            {Object.entries(grouped)
              .sort(([, a], [, b]) => b.length - a.length)
              .map(([source, items]) => (
                <div key={source}>
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-400 mb-2 flex items-center gap-2">
                    <span className="w-1 h-4 bg-accent/60 rounded" />
                    {source}
                    <span className="font-mono text-ink-500 normal-case">
                      ({items.length})
                    </span>
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {items.map((insight, i) => (
                      <InsightCardView key={i} insight={insight} />
                    ))}
                  </div>
                </div>
              ))}
          </div>
        )}

        {/* Empty filtré */}
        {allInsights.length > 0 && insights.length === 0 && (
          <EmptyState
            variant="filtered-empty"
            title="Aucun insight ne match les filtres"
            description="Reset les filtres pour tout voir."
            className="mb-4"
          />
        )}

        {data?.generated_at && (
          <p className="text-[10px] text-ink-500 font-mono mb-4">
            Calculé le {new Date(data.generated_at).toLocaleString('fr-CA')}
          </p>
        )}

        <div className="mt-auto">
          <HubStatus />
        </div>
      </main>
    </div>
  )
}

function InsightCardView({ insight }: { insight: InsightApi }) {
  const Icon = ICON_MAP[insight.icon] ?? Sparkles
  const styles = SEVERITY_STYLES[insight.severity]

  const content = (
    <div
      className={cn(
        'ga-card ga-card-hover p-4 relative h-full',
        styles.border,
        styles.bg,
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            'w-9 h-9 rounded-lg flex items-center justify-center shrink-0',
            styles.bg,
            styles.border,
            'border',
          )}
        >
          <Icon size={16} className={styles.iconColor} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 mb-1 flex-wrap">
            <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', styles.dot)} />
            <h3 className="text-sm font-semibold text-ink-100 leading-tight">
              {insight.title}
            </h3>
            {insight.delta && (
              <span
                className={cn(
                  'text-[11px] font-mono font-semibold ml-auto shrink-0',
                  styles.iconColor,
                )}
              >
                {insight.delta}
              </span>
            )}
          </div>
          <p className="text-xs text-ink-300 leading-relaxed mb-2">
            {insight.description}
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-mono text-ink-500 uppercase tracking-wider">
              {insight.source}
            </span>
            {insight.action && (
              <span className="text-[11px] text-ink-400 font-mono ml-auto">
                {insight.action} →
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )

  if (insight.action_url) {
    return (
      <Link href={insight.action_url} className="block">
        {content}
      </Link>
    )
  }
  return content
}

function KpiTile({
  label,
  value,
  color,
  icon: Icon,
}: {
  label: string
  value: string
  color?: string
  icon?: LucideIcon
}) {
  return (
    <div className="ga-card ga-card-hover px-4 py-3">
      <div className="flex items-center gap-1.5 mb-1.5">
        {Icon && <Icon size={11} className="text-ink-500" />}
        <div className="metric-label">{label}</div>
      </div>
      <div className={cn('metric truncate', color)}>{value}</div>
    </div>
  )
}
