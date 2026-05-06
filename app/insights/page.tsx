'use client'

/**
 * Page Insights — anomalies, patterns, alertes proactives.
 *
 * Branche en live sur GET /v1/insights qui agrege locations + calendar +
 * tasks + finance + emails + health (cf. hub-core/src/api/v1/insights.py).
 *
 * Pas de fake data — si l'API renvoie 0 insights, on affiche un empty state.
 */

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
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { getBaseUrl } from '@/lib/api'

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

export default function InsightsPage() {
  const { data, error, isLoading, mutate } = useSWR<InsightsResponse>(
    `${getBaseUrl()}/v1/insights`,
    fetcher,
    { refreshInterval: 5 * 60_000 },  // refresh chaque 5 min
  )

  const insights = data?.insights ?? []
  const bySeverity = data?.by_severity ?? {}

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
          <div className="ga-card p-4 mb-4 border-data-negative/40">
            <p className="text-sm text-data-negative font-mono">
              Erreur de chargement /v1/insights : {String(error)}
            </p>
          </div>
        )}

        {/* Loading skeleton */}
        {isLoading && !data && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="ga-card p-4 h-32 skeleton"
                style={{ minHeight: '120px' }}
              />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && !error && insights.length === 0 && (
          <div className="ga-card p-8 mb-6 text-center">
            <CheckCircle2 size={32} className="text-data-positive mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-ink-100 mb-1">
              Tout est sous contrôle
            </h3>
            <p className="text-xs text-ink-400">
              Aucune anomalie ni pattern à signaler dans tes données. L&apos;analyse
              tourne automatiquement chaque jour à 8h Québec.
            </p>
          </div>
        )}

        {/* Grid des insights live */}
        {insights.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
            {insights.map((insight, i) => (
              <InsightCardView key={i} insight={insight} />
            ))}
          </div>
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
