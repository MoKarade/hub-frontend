'use client'

import { Sidebar } from '@/components/sidebar'
import { HubStatus } from '@/components/hub-status'
import {
  Heart,
  Footprints,
  Flame,
  Timer,
  Scale,
  Activity,
  RefreshCw,
  Loader2,
  TrendingUp,
  TrendingDown,
  Minus,
  type LucideIcon,
} from 'lucide-react'
import { useState } from 'react'
import useSWR, { mutate as swrMutate } from 'swr'
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts'
import { api, type HealthSummaryResponse } from '@/lib/api'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'

interface MetricMeta {
  label: string
  icon: LucideIcon
  unit: string
  color: string
  hexColor: string
  format: (v: number) => string
  /** Direction "amelioration" : true = plus c'est haut mieux c'est, false = plus bas mieux. */
  higherIsBetter: boolean
}

const METRIC_META: Record<string, MetricMeta> = {
  steps: {
    label: 'Pas/jour',
    icon: Footprints,
    unit: '',
    color: 'text-accent',
    hexColor: '#5cdb95',
    format: (v) => Math.round(v).toLocaleString('fr-CA'),
    higherIsBetter: true,
  },
  distance_m: {
    label: 'Distance',
    icon: Activity,
    unit: 'km',
    color: 'text-info',
    hexColor: '#5b8def',
    format: (v) => (v / 1000).toFixed(1),
    higherIsBetter: true,
  },
  calories: {
    label: 'Calories',
    icon: Flame,
    unit: 'kcal',
    color: 'text-warn',
    hexColor: '#f0a050',
    format: (v) => Math.round(v).toLocaleString('fr-CA'),
    higherIsBetter: true,
  },
  active_minutes: {
    label: 'Min actives',
    icon: Timer,
    unit: 'min',
    color: 'text-data-positive',
    hexColor: '#7ed957',
    format: (v) => Math.round(v).toString(),
    higherIsBetter: true,
  },
  weight_kg: {
    label: 'Poids',
    icon: Scale,
    unit: 'kg',
    color: 'text-ink-100',
    hexColor: '#e2e8f0',
    format: (v) => v.toFixed(1),
    higherIsBetter: false,
  },
  heart_rate_avg: {
    label: 'FC moyenne',
    icon: Heart,
    unit: 'bpm',
    color: 'text-data-negative',
    hexColor: '#f06363',
    format: (v) => Math.round(v).toString(),
    higherIsBetter: false,
  },
}

export default function HealthPage() {
  const [syncing, setSyncing] = useState(false)
  const { data: summary } = useSWR<HealthSummaryResponse>(
    'health-summary',
    () => api.healthData.summary()
  )

  async function handleSync() {
    setSyncing(true)
    try {
      const res = await api.healthData.sync({ days_back: 90 })
      toast.success(
        `Sync OK · ${res.metrics_ingested} nouveaux, ${res.metrics_updated} màj`,
        { description: `${res.duration_seconds}s` }
      )
      void swrMutate('health-summary')
    } catch (err) {
      toast.apiError(err, 'Sync Google Fit échoué')
    } finally {
      setSyncing(false)
    }
  }

  // Filtre les metrics qui ont vraiment des data
  const visibleMetrics = (summary?.by_metric ?? []).filter((m) => m.count > 0)

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 px-4 sm:px-6 lg:px-8 pt-16 lg:pt-6 pb-6 max-w-[1400px] flex flex-col">
        <header className="mb-4 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Santé</h1>
            <p className="text-sm text-ink-400">
              Google Fit · 90 jours · charts + tendances + record
            </p>
          </div>
          <button
            type="button"
            onClick={handleSync}
            disabled={syncing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-accent text-ink-950 text-xs font-semibold hover:bg-accent-light transition-colors disabled:opacity-50"
          >
            {syncing ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
            {syncing ? 'Sync…' : 'Sync Fit'}
          </button>
        </header>

        {summary && summary.total_datapoints === 0 && (
          <div className="ga-card p-6 text-center">
            <Heart size={24} className="text-ink-500 mx-auto mb-2" />
            <div className="text-sm text-ink-300">Aucune donnée santé</div>
            <p className="text-xs text-ink-500 mt-1">
              Click &laquo;&nbsp;Sync Fit&nbsp;&raquo; pour importer 90 jours d&apos;activité
            </p>
          </div>
        )}

        {visibleMetrics.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {visibleMetrics.map((m) => {
              const meta = METRIC_META[m.metric] ?? defaultMeta(m.metric)
              return <MetricDetailCard key={m.metric} stat={m} meta={meta} />
            })}
          </div>
        )}

        <div className="mt-auto pt-4">
          <HubStatus />
        </div>
      </main>
    </div>
  )
}

function defaultMeta(metric: string): MetricMeta {
  return {
    label: metric,
    icon: Activity,
    unit: '',
    color: 'text-ink-200',
    hexColor: '#94a3b8',
    format: (v) => v.toLocaleString('fr-CA', { maximumFractionDigits: 2 }),
    higherIsBetter: true,
  }
}

interface MetricStat {
  metric: string
  count: number
  last_date: string | null
  last_value: number | null
  avg_90d: number | null
  max_90d: number | null
  min_90d: number | null
  avg_7d: number | null
  avg_prev_7d: number | null
  avg_30d: number | null
}

function MetricDetailCard({ stat, meta }: { stat: MetricStat; meta: MetricMeta }) {
  const Icon = meta.icon
  const { data: series } = useSWR(
    ['ts', stat.metric],
    () => api.healthData.timeseries(stat.metric, 90)
  )

  // Trend indicator
  const trend =
    stat.avg_7d !== null && stat.avg_prev_7d !== null && stat.avg_prev_7d > 0
      ? ((stat.avg_7d - stat.avg_prev_7d) / stat.avg_prev_7d) * 100
      : null

  const trendIsGood =
    trend !== null
      ? meta.higherIsBetter
        ? trend > 1
        : trend < -1
      : null

  // Convert series for recharts (transform distance_m -> km if applicable)
  const chartData = (series ?? []).map((p) => ({
    date: p.date,
    value: stat.metric === 'distance_m' ? p.value / 1000 : p.value,
  }))

  return (
    <div className="ga-card p-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className={cn(
              'w-9 h-9 rounded-lg border flex items-center justify-center shrink-0',
              `${meta.color}/30 bg-ink-800/40`
            )}
            style={{ borderColor: `${meta.hexColor}40` }}
          >
            <Icon size={15} className={meta.color} />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-ink-100">{meta.label}</div>
            <div className="text-[10px] font-mono text-ink-500">
              {stat.count} datapoints · {stat.last_date ?? '—'}
            </div>
          </div>
        </div>
        {trend !== null && (
          <div
            className={cn(
              'inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-mono shrink-0',
              trendIsGood === true
                ? 'text-data-positive bg-data-positive/10 border border-data-positive/30'
                : trendIsGood === false
                  ? 'text-data-negative bg-data-negative/10 border border-data-negative/30'
                  : 'text-ink-400 bg-ink-800 border border-ink-700'
            )}
          >
            {trend > 1 ? (
              <TrendingUp size={9} />
            ) : trend < -1 ? (
              <TrendingDown size={9} />
            ) : (
              <Minus size={9} />
            )}
            {Math.abs(trend).toFixed(0)}%
          </div>
        )}
      </div>

      {/* Big current value */}
      <div className="flex items-baseline gap-2 mb-1">
        <div className={cn('text-3xl font-bold', meta.color)}>
          {stat.last_value !== null ? meta.format(stat.last_value) : '—'}
        </div>
        <div className="text-xs font-mono text-ink-500">{meta.unit}</div>
      </div>
      <div className="text-[11px] text-ink-500 mb-3">Dernière mesure</div>

      {/* Mini chart */}
      {chartData.length > 0 && (
        <div className="h-24 -mx-1 mb-3">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={`grad-${stat.metric}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={meta.hexColor} stopOpacity={0.4} />
                  <stop offset="100%" stopColor={meta.hexColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="2 4" stroke="#1e293b" vertical={false} />
              <XAxis
                dataKey="date"
                hide
              />
              <YAxis hide domain={['auto', 'auto']} />
              <Tooltip
                contentStyle={{
                  background: '#0f172a',
                  border: '1px solid #1e293b',
                  borderRadius: 4,
                  fontSize: 11,
                  padding: '4px 8px',
                }}
                labelStyle={{ color: '#94a3b8', fontSize: 10 }}
                formatter={(v: number) => [meta.format(v), meta.label]}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke={meta.hexColor}
                strokeWidth={1.5}
                fill={`url(#grad-${stat.metric})`}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Mini stats */}
      <div className="grid grid-cols-4 gap-2 pt-2 border-t border-ink-700/50">
        <MiniStat label="7j" value={stat.avg_7d !== null ? meta.format(stat.avg_7d) : '—'} />
        <MiniStat label="30j" value={stat.avg_30d !== null ? meta.format(stat.avg_30d) : '—'} />
        <MiniStat label="Min" value={stat.min_90d !== null ? meta.format(stat.min_90d) : '—'} />
        <MiniStat label="Max" value={stat.max_90d !== null ? meta.format(stat.max_90d) : '—'} />
      </div>
    </div>
  )
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center">
      <div className="text-[9px] uppercase tracking-wider text-ink-500">{label}</div>
      <div className="text-xs font-mono font-semibold text-ink-200">{value}</div>
    </div>
  )
}
