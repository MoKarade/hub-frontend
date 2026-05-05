'use client'

/**
 * Page Insights — anomalies, patterns, alertes proactives.
 *
 * Connectee a /v1/insights (backend agrege locations + calendar + tasks +
 * finance + emails). Plus de PREVIEW, vraies data.
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
  AlertCircle,
  CheckCircle2,
  Bell,
  Zap,
  Calendar,
  CalendarClock,
  Home,
  ListTodo,
  DollarSign,
  Repeat,
  Mail,
  RefreshCw,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'

type Severity = 'critical' | 'warning' | 'info' | 'positive'

interface ApiInsight {
  severity: Severity
  icon: string
  title: string
  description: string
  delta?: string | null
  action?: string | null
  action_url?: string | null
  source: string
  metric_value?: number | null
  generated_at: string
}

interface InsightsResponse {
  insights: ApiInsight[]
  generated_at: string
  total: number
  by_severity: Record<string, number>
}

const ICON_MAP: Record<string, LucideIcon> = {
  AlertTriangle,
  AlertCircle,
  Bell,
  Calendar,
  CalendarClock,
  CheckCircle2,
  DollarSign,
  Home,
  ListTodo,
  Mail,
  Repeat,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Zap,
}

const SEVERITY_STYLES: Record<Severity, { dot: string; border: string; bg: string; iconColor: string }> = {
  critical: { dot: 'bg-data-negative', border: 'border-data-negative/30', bg: 'bg-data-negative/5', iconColor: 'text-data-negative' },
  warning:  { dot: 'bg-warn',          border: 'border-warn/30',          bg: 'bg-warn/5',          iconColor: 'text-warn' },
  info:     { dot: 'bg-info',          border: 'border-info/30',          bg: 'bg-info/5',          iconColor: 'text-info' },
  positive: { dot: 'bg-data-positive', border: 'border-data-positive/30', bg: 'bg-data-positive/5', iconColor: 'text-data-positive' },
}

const fetcher = (url: string) => fetch(url).then((r) => {
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  return r.json()
})

export default function InsightsPage() {
  // URL relative -> proxy Next.js next.config -> hub-core :8000
  const { data, error, isLoading, mutate } = useSWR<InsightsResponse>('/v1/insights', fetcher, {
    revalidateOnFocus: false,
    refreshInterval: 60000, // 1 min
  })

  const insights = data?.insights || []
  const bySev = data?.by_severity || {}
  const total = data?.total ?? 0

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 px-4 sm:px-6 lg:px-8 pt-16 lg:pt-6 pb-6 max-w-[1400px] flex flex-col">
        <header className="mb-4 flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Insights</h1>
            <p className="text-sm text-ink-400">
              Anomalies, patterns et alertes proactives — 5 sources combinees
            </p>
          </div>
          <button
            type="button"
            onClick={() => mutate()}
            className="text-[10px] font-mono uppercase tracking-wider text-ink-400 hover:text-accent transition-colors px-2 py-1 rounded border border-ink-700 hover:border-accent flex items-center gap-1.5"
          >
            <RefreshCw size={10} />
            refresh
          </button>
        </header>

        {/* KPI strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <KpiTile label="Total" value={String(total)} icon={Sparkles} />
          <KpiTile label="Critiques" value={String(bySev.critical || 0)} color="text-data-negative" />
          <KpiTile label="A surveiller" value={String(bySev.warning || 0)} color="text-warn" />
          <KpiTile label="Positifs" value={String(bySev.positive || 0)} color="text-data-positive" />
        </div>

        {/* Loading / error states */}
        {isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="ga-card p-4 h-28 skeleton" />
            ))}
          </div>
        )}

        {error && (
          <div className="ga-card p-4 mb-4 border-data-negative/30 bg-data-negative/5">
            <div className="flex items-start gap-3">
              <AlertCircle size={16} className="text-data-negative shrink-0 mt-0.5" />
              <div>
                <div className="text-sm font-semibold text-ink-100 mb-1">
                  Impossible de charger les insights
                </div>
                <p className="text-xs text-ink-300">{String((error as Error).message)}</p>
              </div>
            </div>
          </div>
        )}

        {/* Empty state */}
        {!isLoading && !error && insights.length === 0 && (
          <div className="ga-card p-8 mb-4 text-center">
            <CheckCircle2 size={32} className="text-data-positive mx-auto mb-3" />
            <div className="text-sm font-semibold text-ink-100 mb-1">Tout va bien</div>
            <p className="text-xs text-ink-300">Aucun insight a signaler pour l&apos;instant.</p>
          </div>
        )}

        {/* Grid des insights */}
        {!isLoading && insights.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
            {insights.map((insight, i) => (
              <InsightCardView key={`${insight.source}-${i}`} insight={insight} />
            ))}
          </div>
        )}

        {/* Footer roadmap */}
        <div className="ga-card p-4 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <Calendar size={14} className="text-accent" />
            <span className="metric-label">Sources combinees</span>
          </div>
          <ul className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs text-ink-300">
            {[
              { name: 'Locations', desc: 'Loin de chez toi, anniversaires' },
              { name: 'Calendar', desc: 'Evenements 48h' },
              { name: 'Tasks', desc: 'Overdue + en cours' },
              { name: 'Finance', desc: 'Grosses depenses + abos' },
              { name: 'Emails', desc: 'Non-lus' },
              { name: 'AI cron (a venir)', desc: 'Push ntfy quotidien' },
            ].map((s) => (
              <li key={s.name} className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-accent mt-1.5 shrink-0" />
                <div>
                  <strong className="text-ink-100">{s.name}</strong>
                  <span className="text-ink-500"> — {s.desc}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-auto">
          <HubStatus />
        </div>
      </main>
    </div>
  )
}

function InsightCardView({ insight }: { insight: ApiInsight }) {
  const Icon = ICON_MAP[insight.icon] || Sparkles
  const styles = SEVERITY_STYLES[insight.severity]
  const card = (
    <div className={cn('ga-card ga-card-hover p-4 h-full', styles.border, styles.bg, 'relative')}>
      <div className="flex items-start gap-3">
        <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center shrink-0', styles.bg, styles.border, 'border')}>
          <Icon size={16} className={styles.iconColor} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 mb-1 flex-wrap">
            <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', styles.dot)} />
            <h3 className="text-sm font-semibold text-ink-100 leading-tight">{insight.title}</h3>
            {insight.delta && (
              <span className={cn('text-[11px] font-mono font-semibold ml-auto shrink-0', styles.iconColor)}>
                {insight.delta}
              </span>
            )}
          </div>
          <p className="text-xs text-ink-300 leading-relaxed mb-2 break-words">{insight.description}</p>
          <div className="flex items-center justify-between gap-2 mt-2">
            <span className="text-[10px] font-mono uppercase tracking-wider text-ink-500">{insight.source}</span>
            {insight.action && (
              <span className="text-[11px] text-ink-400 hover:text-ink-100 transition-colors font-mono">
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
        {card}
      </Link>
    )
  }
  return card
}

function KpiTile({ label, value, color, icon: Icon }: { label: string; value: string; color?: string; icon?: LucideIcon }) {
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
