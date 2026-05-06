'use client'

/**
 * Charts pour la page /me — recharts trends pour finance/sante/temps ecran.
 *
 * Utilise les endpoints existants :
 * - /v1/finance/spending-by-day (via /v1/finance route, fallback compute local)
 * - /v1/health-data/timeseries?metric=X
 * - /v1/browser/stats (deja agrege par hour)
 */

import useSWR from 'swr'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Loader2 } from 'lucide-react'
import { Widget } from '@/components/widget'
import { getBaseUrl } from '@/lib/api'

const fetcher = (url: string) => fetch(url).then((r) => r.json())

interface TimeseriesPoint {
  date: string
  value: number
}

const TICK_STYLE = { fontSize: 9, fill: '#64748b', fontFamily: 'monospace' }
const ACCENT = '#5cdb95'
const NEG = '#f87171'
const INFO = '#60a5fa'

// ── Sleep trend (line chart 30j) ────────────────────────────────────────

export function SleepTrendChart({ days = 30 }: { days?: number }) {
  const { data } = useSWR<TimeseriesPoint[]>(
    `${getBaseUrl()}/v1/health-data/timeseries?metric=sleep_seconds&days_back=${days}`,
    fetcher,
  )

  if (!data) {
    return <ChartSkeleton />
  }
  if (data.length === 0) {
    return <EmptyChart label="Aucune donnée sommeil" />
  }

  const chartData = data
    .filter((p) => p.value !== null)
    .map((p) => ({
      date: p.date.slice(5),
      hours: Math.round((p.value / 3600) * 10) / 10,
    }))

  return (
    <ResponsiveContainer width="100%" height={150}>
      <LineChart data={chartData} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
        <CartesianGrid strokeDasharray="2 2" stroke="#1e293b" vertical={false} />
        <XAxis dataKey="date" tick={TICK_STYLE} interval="preserveEnd" />
        <YAxis
          tick={TICK_STYLE}
          domain={[4, 10]}
          ticks={[4, 6, 7, 8, 10]}
          label={{ value: 'h', position: 'insideTopLeft', style: TICK_STYLE }}
        />
        <Tooltip
          contentStyle={{
            background: '#0f172a',
            border: '1px solid #1e293b',
            fontSize: 11,
          }}
          formatter={(v: number) => [`${v} h`, 'Sommeil']}
        />
        <Line
          type="monotone"
          dataKey="hours"
          stroke={ACCENT}
          strokeWidth={2}
          dot={{ r: 2 }}
          activeDot={{ r: 4 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

// ── Steps trend (bar chart) ─────────────────────────────────────────────

export function StepsChart({ days = 30 }: { days?: number }) {
  const { data } = useSWR<TimeseriesPoint[]>(
    `${getBaseUrl()}/v1/health-data/timeseries?metric=steps&days_back=${days}`,
    fetcher,
  )

  if (!data) return <ChartSkeleton />
  if (data.length === 0) return <EmptyChart label="Aucune donnée pas" />

  const chartData = data
    .filter((p) => p.value !== null)
    .map((p) => ({
      date: p.date.slice(5),
      steps: Math.round(p.value),
    }))

  return (
    <ResponsiveContainer width="100%" height={150}>
      <BarChart data={chartData} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="2 2" stroke="#1e293b" vertical={false} />
        <XAxis dataKey="date" tick={TICK_STYLE} interval="preserveEnd" />
        <YAxis tick={TICK_STYLE} />
        <Tooltip
          contentStyle={{
            background: '#0f172a',
            border: '1px solid #1e293b',
            fontSize: 11,
          }}
          formatter={(v: number) => [v.toLocaleString('fr-CA'), 'Pas']}
        />
        <Bar dataKey="steps" fill={INFO} radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

// ── Heart rate (RHR) trend ──────────────────────────────────────────────

export function RhrChart({ days = 30 }: { days?: number }) {
  const { data } = useSWR<TimeseriesPoint[]>(
    `${getBaseUrl()}/v1/health-data/timeseries?metric=resting_heart_rate&days_back=${days}`,
    fetcher,
  )

  if (!data) return <ChartSkeleton />
  if (data.length === 0) return <EmptyChart label="Aucune donnée RHR" />

  const chartData = data
    .filter((p) => p.value !== null)
    .map((p) => ({
      date: p.date.slice(5),
      rhr: Math.round(p.value),
    }))

  return (
    <ResponsiveContainer width="100%" height={150}>
      <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
        <CartesianGrid strokeDasharray="2 2" stroke="#1e293b" vertical={false} />
        <XAxis dataKey="date" tick={TICK_STYLE} interval="preserveEnd" />
        <YAxis tick={TICK_STYLE} domain={['dataMin - 3', 'dataMax + 3']} />
        <Tooltip
          contentStyle={{
            background: '#0f172a',
            border: '1px solid #1e293b',
            fontSize: 11,
          }}
          formatter={(v: number) => [`${v} bpm`, 'RHR']}
        />
        <Area
          type="monotone"
          dataKey="rhr"
          stroke={NEG}
          fill={NEG}
          fillOpacity={0.15}
          strokeWidth={2}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

// ── Browser activity by hour (heatmap-bar) ──────────────────────────────

interface HourCount {
  hour: number
  count: number
}

export function BrowserHourChart({ days = 30 }: { days?: number }) {
  const { data } = useSWR<{ by_hour: HourCount[] }>(
    `${getBaseUrl()}/v1/browser/stats?since_days=${days}`,
    fetcher,
  )

  if (!data) return <ChartSkeleton />
  if (!data.by_hour || data.by_hour.length === 0) {
    return <EmptyChart label="Aucune donnée navigateur" />
  }

  // Fill 0..23
  const filled = Array.from({ length: 24 }, (_, h) => ({
    hour: `${h}h`,
    count: data.by_hour.find((x) => x.hour === h)?.count ?? 0,
  }))

  return (
    <ResponsiveContainer width="100%" height={150}>
      <BarChart data={filled} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
        <CartesianGrid strokeDasharray="2 2" stroke="#1e293b" vertical={false} />
        <XAxis dataKey="hour" tick={TICK_STYLE} interval={2} />
        <YAxis tick={TICK_STYLE} />
        <Tooltip
          contentStyle={{
            background: '#0f172a',
            border: '1px solid #1e293b',
            fontSize: 11,
          }}
          formatter={(v: number) => [v, 'Visites']}
        />
        <Bar dataKey="count" fill={ACCENT} radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

// ── Helper widgets ───────────────────────────────────────────────────────

function ChartSkeleton() {
  return (
    <div className="h-[150px] flex items-center justify-center text-ink-500">
      <Loader2 size={14} className="animate-spin" />
    </div>
  )
}

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="h-[150px] flex items-center justify-center text-xs text-ink-500">
      {label}
    </div>
  )
}

// ── Combined section pour /me ───────────────────────────────────────────

export function MeChartsSection({ days = 30 }: { days?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <Widget id="chart-sleep" title="Tendance sommeil" subtitle={`${days} derniers jours`}>
        <SleepTrendChart days={days} />
      </Widget>
      <Widget id="chart-steps" title="Pas par jour" subtitle={`${days} derniers jours`}>
        <StepsChart days={days} />
      </Widget>
      <Widget id="chart-rhr" title="Fréquence cardiaque au repos" subtitle={`${days} derniers jours`}>
        <RhrChart days={days} />
      </Widget>
      <Widget id="chart-browser" title="Navigation par heure" subtitle={`${days} derniers jours`}>
        <BrowserHourChart days={days} />
      </Widget>
    </div>
  )
}
