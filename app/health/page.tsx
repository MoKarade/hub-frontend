'use client'

import { Sidebar } from '@/components/sidebar'
import { HubStatus } from '@/components/hub-status'
import {
  Heart,
  Footprints,
  Flame,
  Timer,
  Activity,
  RefreshCw,
  Loader2,
  TrendingUp,
  TrendingDown,
  Minus,
  Moon,
  Zap,
  Wind,
  Trophy,
  Bike,
  BrainCircuit,
  ChevronUp,
  ArrowUp,
  Dumbbell,
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
  RadialBarChart,
  RadialBar,
  Cell,
} from 'recharts'
import { api, type HealthSummaryResponse } from '@/lib/api'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'

// ── Formatters ─────────────────────────────────────────────────────────────────

function fmtTime(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}h${String(m).padStart(2, '0')}`
  return `${m}:${String(Math.round(s)).padStart(2, '0')}`
}

function fmtMin(min: number): string {
  const h = Math.floor(min / 60)
  const m = Math.round(min % 60)
  return h > 0 ? `${h}h${m > 0 ? String(m).padStart(2, '0') : ''}` : `${m}min`
}

// ── Metadata pour chaque métrique ─────────────────────────────────────────────

interface MetricMeta {
  label: string
  icon: LucideIcon
  unit: string
  hex: string
  format: (v: number) => string
  higherIsBetter: boolean
  section: string
}

const M: Record<string, MetricMeta> = {
  // ── Activité
  steps:                  { label: 'Pas',          icon: Footprints, unit: '',     hex: '#5cdb95', format: v => Math.round(v).toLocaleString('fr-CA'), higherIsBetter: true,  section: 'activity' },
  distance_m:             { label: 'Distance',     icon: Activity,   unit: 'km',   hex: '#5fb3f4', format: v => (v / 1000).toFixed(1),                  higherIsBetter: true,  section: 'activity' },
  calories:               { label: 'Cal. actives', icon: Flame,      unit: 'kcal', hex: '#ffb84d', format: v => Math.round(v).toLocaleString('fr-CA'),  higherIsBetter: true,  section: 'activity' },
  calories_total:         { label: 'Cal. totales', icon: Flame,      unit: 'kcal', hex: '#f09040', format: v => Math.round(v).toLocaleString('fr-CA'),  higherIsBetter: true,  section: 'activity' },
  bmr_calories:           { label: 'BMR',          icon: Flame,      unit: 'kcal', hex: '#a08060', format: v => Math.round(v).toLocaleString('fr-CA'),  higherIsBetter: false, section: 'activity' },
  active_minutes:         { label: 'Min. actives', icon: Timer,      unit: 'min',  hex: '#7ee8b3', format: v => Math.round(v).toString(),               higherIsBetter: true,  section: 'activity' },
  sedentary_minutes:      { label: 'Sédentaire',   icon: Timer,      unit: 'min',  hex: '#5a6572', format: fmtMin,                                       higherIsBetter: false, section: 'activity' },
  floors:                 { label: 'Étages',        icon: ArrowUp,    unit: 'ét.',  hex: '#a3c4f3', format: v => v.toFixed(0),                            higherIsBetter: true,  section: 'activity' },
  floors_ascended_m:      { label: 'Montée',        icon: ChevronUp,  unit: 'm',    hex: '#7eb8f7', format: v => v.toFixed(0),                            higherIsBetter: true,  section: 'activity' },
  floors_descended_m:     { label: 'Descente',      icon: ChevronUp,  unit: 'm',    hex: '#5a8adb', format: v => v.toFixed(0),                            higherIsBetter: false, section: 'activity' },
  intensity_moderate_min: { label: 'Modéré',        icon: Dumbbell,   unit: 'min',  hex: '#f0c030', format: v => Math.round(v).toString(),               higherIsBetter: true,  section: 'activity' },
  intensity_vigorous_min: { label: 'Intense',       icon: Dumbbell,   unit: 'min',  hex: '#ff7c40', format: v => Math.round(v).toString(),               higherIsBetter: true,  section: 'activity' },

  // ── Cardio
  heart_rate_resting:     { label: 'FC repos',     icon: Heart, unit: 'bpm', hex: '#f06363', format: v => Math.round(v).toString(), higherIsBetter: false, section: 'cardio' },
  heart_rate_min:         { label: 'FC min',        icon: Heart, unit: 'bpm', hex: '#c04040', format: v => Math.round(v).toString(), higherIsBetter: false, section: 'cardio' },
  heart_rate_max:         { label: 'FC max',        icon: Heart, unit: 'bpm', hex: '#ff4040', format: v => Math.round(v).toString(), higherIsBetter: false, section: 'cardio' },
  rhr_7day_avg:           { label: 'FC repos 7j',   icon: Heart, unit: 'bpm', hex: '#e08080', format: v => Math.round(v).toString(), higherIsBetter: false, section: 'cardio' },
  hrv_avg_ms:             { label: 'HRV',           icon: Activity, unit: 'ms', hex: '#b060f0', format: v => Math.round(v).toString(), higherIsBetter: true, section: 'cardio' },

  // ── Sommeil
  sleep_total_min:        { label: 'Durée',         icon: Moon, unit: '', hex: '#7c5cbf', format: fmtMin, higherIsBetter: true,  section: 'sleep' },
  sleep_deep_min:         { label: 'Profond',       icon: Moon, unit: '', hex: '#4a3b8c', format: fmtMin, higherIsBetter: true,  section: 'sleep' },
  sleep_rem_min:          { label: 'REM',           icon: Moon, unit: '', hex: '#9b59b6', format: fmtMin, higherIsBetter: true,  section: 'sleep' },
  sleep_light_min:        { label: 'Léger',         icon: Moon, unit: '', hex: '#a080d0', format: fmtMin, higherIsBetter: true,  section: 'sleep' },
  sleep_awake_min:        { label: 'Éveillé',       icon: Moon, unit: '', hex: '#6a6090', format: fmtMin, higherIsBetter: false, section: 'sleep' },
  sleep_spo2_avg:         { label: 'SpO2 nuit',     icon: Wind, unit: '%', hex: '#60a0e0', format: v => v.toFixed(0), higherIsBetter: true, section: 'sleep' },
  sleep_respiration_avg:  { label: 'Resp. nuit',    icon: Wind, unit: 'brpm', hex: '#80b0c8', format: v => v.toFixed(1), higherIsBetter: false, section: 'sleep' },
  sleep_respiration_max:  { label: 'Resp. max nuit',icon: Wind, unit: 'brpm', hex: '#60a0b8', format: v => v.toFixed(1), higherIsBetter: false, section: 'sleep' },
  sleep_respiration_min:  { label: 'Resp. min nuit',icon: Wind, unit: 'brpm', hex: '#5090a8', format: v => v.toFixed(1), higherIsBetter: true,  section: 'sleep' },

  // ── Récupération & Stress
  body_battery_max:       { label: 'Battery max',  icon: Zap, unit: '/100', hex: '#5cdb95', format: v => Math.round(v).toString(), higherIsBetter: true,  section: 'recovery' },
  body_battery_min:       { label: 'Battery min',  icon: Zap, unit: '/100', hex: '#3aa370', format: v => Math.round(v).toString(), higherIsBetter: true,  section: 'recovery' },
  body_battery_end:       { label: 'Battery fin',  icon: Zap, unit: '/100', hex: '#2a8060', format: v => Math.round(v).toString(), higherIsBetter: true,  section: 'recovery' },
  body_battery_charged:   { label: 'Rechargé',     icon: Zap, unit: '',     hex: '#70e8a0', format: v => `+${Math.round(v)}`,      higherIsBetter: true,  section: 'recovery' },
  body_battery_drained:   { label: 'Drainé',       icon: Zap, unit: '',     hex: '#f06363', format: v => `-${Math.round(v)}`,      higherIsBetter: false, section: 'recovery' },
  stress_avg:             { label: 'Stress moy.',   icon: BrainCircuit, unit: '/100', hex: '#ffb84d', format: v => Math.round(v).toString(), higherIsBetter: false, section: 'recovery' },
  stress_max:             { label: 'Stress max',    icon: BrainCircuit, unit: '/100', hex: '#ff8040', format: v => Math.round(v).toString(), higherIsBetter: false, section: 'recovery' },
  training_readiness:     { label: 'Readiness',     icon: Zap, unit: '/100', hex: '#5cdb95', format: v => Math.round(v).toString(), higherIsBetter: true, section: 'recovery' },
  recovery_time_h:        { label: 'Récup.',        icon: Timer, unit: 'h', hex: '#80c0a0', format: v => v.toFixed(0), higherIsBetter: false, section: 'recovery' },

  // ── Respiration
  respiration_waking_avg: { label: 'Resp. éveil',  icon: Wind, unit: 'brpm', hex: '#5fb3f4', format: v => v.toFixed(1), higherIsBetter: false, section: 'respiration' },
  respiration_min:        { label: 'Resp. min',    icon: Wind, unit: 'brpm', hex: '#4090d8', format: v => v.toFixed(1), higherIsBetter: false, section: 'respiration' },
  respiration_max:        { label: 'Resp. max',    icon: Wind, unit: 'brpm', hex: '#6090c8', format: v => v.toFixed(1), higherIsBetter: false, section: 'respiration' },
  oxygen_saturation:      { label: 'SpO2',          icon: Wind, unit: '%',   hex: '#70b0e0', format: v => v.toFixed(0), higherIsBetter: true,  section: 'respiration' },
  oxygen_saturation_min:  { label: 'SpO2 min',      icon: Wind, unit: '%',   hex: '#5090c8', format: v => v.toFixed(0), higherIsBetter: true,  section: 'respiration' },

  // ── Performance
  race_time_5k_s:       { label: '5K',             icon: Trophy, unit: '', hex: '#ffd700', format: v => fmtTime(v), higherIsBetter: false, section: 'performance' },
  race_time_10k_s:      { label: '10K',            icon: Trophy, unit: '', hex: '#f0b040', format: v => fmtTime(v), higherIsBetter: false, section: 'performance' },
  race_time_half_s:     { label: 'Semi',           icon: Trophy, unit: '', hex: '#e09030', format: v => fmtTime(v), higherIsBetter: false, section: 'performance' },
  race_time_marathon_s: { label: 'Marathon',       icon: Trophy, unit: '', hex: '#c07820', format: v => fmtTime(v), higherIsBetter: false, section: 'performance' },
  cycling_ftp_w:        { label: 'FTP vélo',       icon: Bike,   unit: 'W', hex: '#5fb3f4', format: v => Math.round(v).toString(), higherIsBetter: true, section: 'performance' },
  fitness_age:          { label: 'Âge fitness',    icon: BrainCircuit, unit: 'ans', hex: '#5cdb95', format: v => v.toFixed(1), higherIsBetter: false, section: 'performance' },
  fitness_age_best:     { label: 'Âge potentiel', icon: BrainCircuit, unit: 'ans', hex: '#3aa370', format: v => v.toFixed(1), higherIsBetter: false, section: 'performance' },
  endurance_score:      { label: 'Endurance',      icon: Dumbbell, unit: '', hex: '#7040e0', format: v => Math.round(v).toLocaleString('fr-CA'), higherIsBetter: true, section: 'performance' },

  // ── Google Fit (legacy)
  heart_rate_avg:  { label: 'FC moyenne', icon: Heart, unit: 'bpm', hex: '#f06363', format: v => Math.round(v).toString(), higherIsBetter: false, section: 'cardio' },
  weight_kg:       { label: 'Poids',       icon: Activity, unit: 'kg', hex: '#c5cdd6', format: v => v.toFixed(1), higherIsBetter: false, section: 'recovery' },
}

function metaOf(metric: string): MetricMeta {
  return M[metric] ?? {
    label: metric,
    icon: Activity,
    unit: '',
    hex: '#5a6572',
    format: (v) => v.toLocaleString('fr-CA', { maximumFractionDigits: 2 }),
    higherIsBetter: true,
    section: 'activity',
  }
}

// ── Groupes de sections ───────────────────────────────────────────────────────

const SECTIONS = [
  { id: 'activity',    label: 'Activité',              icon: Footprints, accent: '#5cdb95' },
  { id: 'cardio',      label: 'Cardio & HRV',          icon: Heart,      accent: '#f06363' },
  { id: 'sleep',       label: 'Sommeil',                icon: Moon,       accent: '#9b59b6' },
  { id: 'recovery',    label: 'Récupération & Stress',  icon: Zap,        accent: '#ffb84d' },
  { id: 'respiration', label: 'Respiration & SpO2',     icon: Wind,       accent: '#5fb3f4' },
  { id: 'performance', label: 'Performance',            icon: Trophy,     accent: '#ffd700' },
]

// ── Types ─────────────────────────────────────────────────────────────────────

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

// ── Page principale ───────────────────────────────────────────────────────────

export default function HealthPage() {
  const [syncingFit, setSyncingFit] = useState(false)
  const [syncingGarmin, setSyncingGarmin] = useState(false)

  const { data: summary } = useSWR<HealthSummaryResponse>('health-summary', () =>
    api.healthData.summary()
  )

  async function handleSyncFit() {
    setSyncingFit(true)
    try {
      const res = await api.healthData.sync({ days_back: 90 })
      toast.success(`Fit · ${res.metrics_ingested} nouveaux`, { description: `${res.duration_seconds}s` })
      void swrMutate('health-summary')
    } catch (err) {
      toast.apiError(err, 'Sync Google Fit échoué')
    } finally {
      setSyncingFit(false)
    }
  }

  async function handleSyncGarmin() {
    setSyncingGarmin(true)
    try {
      const res = await api.garmin.sync({ days_back: 90 })
      toast.success(`Garmin · ${res.metrics_ingested} nouveaux, ${res.metrics_updated} màj`, {
        description: `${res.days_processed} jours · ${res.duration_seconds}s`,
      })
      void swrMutate('health-summary')
    } catch (err) {
      toast.apiError(err, 'Sync Garmin échoué')
    } finally {
      setSyncingGarmin(false)
    }
  }

  const stats = summary?.by_metric ?? []
  const byMetric = Object.fromEntries(stats.map((s) => [s.metric, s]))

  // Métriques en vedette "today"
  const hero: { metric: string; label: string; emoji: string }[] = [
    { metric: 'training_readiness', label: 'Readiness', emoji: '⚡' },
    { metric: 'body_battery_max',   label: 'Battery',   emoji: '🔋' },
    { metric: 'steps',              label: 'Pas',        emoji: '👟' },
    { metric: 'heart_rate_resting', label: 'FC repos',   emoji: '❤️' },
    { metric: 'sleep_total_min',    label: 'Sommeil',    emoji: '🌙' },
    { metric: 'hrv_avg_ms',         label: 'HRV',        emoji: '📈' },
  ]

  return (
    <div className="flex min-h-screen bg-ink-950">
      <Sidebar />
      <main className="flex-1 px-4 sm:px-6 lg:px-8 pt-16 lg:pt-6 pb-8 max-w-[1500px]">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <header className="mb-5 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-ink-100">Santé</h1>
            <p className="text-xs text-ink-500 font-mono mt-0.5">
              Garmin Forerunner 955 · Google Fit · 90 jours
            </p>
          </div>
          <div className="flex items-center gap-2">
            <SyncButton label="Sync Fit" loading={syncingFit} onClick={handleSyncFit} color="text-info" />
            <SyncButton label="Sync Garmin" loading={syncingGarmin} onClick={handleSyncGarmin} color="text-accent" />
          </div>
        </header>

        {/* ── Today Hero Strip ────────────────────────────────────────────── */}
        {stats.length > 0 && (
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-6">
            {hero.map(({ metric, label, emoji }) => {
              const s = byMetric[metric]
              const meta = metaOf(metric)
              if (!s?.last_value) return null
              return (
                <HeroTile key={metric} emoji={emoji} label={label} value={meta.format(s.last_value)} unit={meta.unit} hex={meta.hex} date={s.last_date} />
              )
            })}
          </div>
        )}

        {/* ── Sections par catégorie ──────────────────────────────────────── */}
        <div className="space-y-8">
          {SECTIONS.map((sec) => {
            const secStats = stats.filter(
              (s) => s.count > 0 && (M[s.metric]?.section ?? 'activity') === sec.id
            )
            if (secStats.length === 0) return null
            return (
              <Section key={sec.id} id={sec.id} label={sec.label} Icon={sec.icon} accent={sec.accent} stats={secStats} />
            )
          })}
        </div>

        <div className="mt-8">
          <HubStatus />
        </div>
      </main>
    </div>
  )
}

// ── Hero tile ─────────────────────────────────────────────────────────────────

function HeroTile({
  emoji, label, value, unit, hex, date,
}: {
  emoji: string; label: string; value: string; unit: string; hex: string; date: string | null
}) {
  return (
    <div
      className="rounded-xl border border-ink-700/60 bg-ink-900/80 p-3 flex flex-col items-center text-center hover:border-ink-600 transition-colors"
      style={{ boxShadow: `0 0 0 1px ${hex}15` }}
    >
      <span className="text-xl mb-1">{emoji}</span>
      <div className="text-[10px] text-ink-500 uppercase tracking-wider font-mono mb-1">{label}</div>
      <div className="font-bold text-lg leading-none" style={{ color: hex }}>{value}</div>
      {unit && <div className="text-[9px] text-ink-600 font-mono mt-0.5">{unit}</div>}
      {date && (
        <div className="text-[8px] text-ink-700 font-mono mt-1 truncate w-full">
          {date.slice(5)}
        </div>
      )}
    </div>
  )
}

// ── Sync button ───────────────────────────────────────────────────────────────

function SyncButton({ label, loading, onClick, color }: { label: string; loading: boolean; onClick: () => void; color: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className={cn(
        'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold border transition-colors disabled:opacity-50',
        'bg-ink-800 border-ink-700 hover:bg-ink-700 hover:border-ink-600',
        color
      )}
    >
      {loading ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
      {loading ? '…' : label}
    </button>
  )
}

// ── Section ───────────────────────────────────────────────────────────────────

function Section({
  label, Icon, accent, stats,
}: {
  id: string; label: string; Icon: LucideIcon; accent: string; stats: MetricStat[]
}) {
  return (
    <div>
      {/* Section header */}
      <div className="flex items-center gap-2 mb-3">
        <div className="w-0.5 h-4 rounded-full" style={{ background: accent }} />
        <Icon size={13} style={{ color: accent }} />
        <h2 className="text-sm font-semibold text-ink-200">{label}</h2>
        <div className="flex-1 h-px bg-ink-800/80" />
        <span className="text-[10px] font-mono text-ink-600">{stats.length} métriques</span>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {stats.map((s) => (
          <MetricCard key={s.metric} stat={s} meta={metaOf(s.metric)} />
        ))}
      </div>
    </div>
  )
}

// ── Metric card ───────────────────────────────────────────────────────────────

function MetricCard({ stat, meta }: { stat: MetricStat; meta: MetricMeta }) {
  const Icon = meta.icon

  const { data: series } = useSWR(
    ['ts', stat.metric],
    () => api.healthData.timeseries(stat.metric, 90),
    { revalidateOnFocus: false }
  )

  const trend =
    stat.avg_7d !== null && stat.avg_prev_7d !== null && stat.avg_prev_7d > 0
      ? ((stat.avg_7d - stat.avg_prev_7d) / stat.avg_prev_7d) * 100
      : null

  const trendGood =
    trend !== null
      ? meta.higherIsBetter ? trend > 1 : trend < -1
      : null

  const chartData = (series ?? []).map((p) => ({
    date: p.date.slice(5),
    value: stat.metric === 'distance_m' ? p.value / 1000 : p.value,
  }))

  // Gauge pour métriques 0-100
  const isGauge = ['body_battery_max', 'body_battery_min', 'body_battery_end', 'training_readiness', 'stress_avg'].includes(stat.metric)
  const gaugeVal = stat.last_value ?? 0

  return (
    <div
      className="rounded-xl bg-ink-900/70 border border-ink-800/80 p-4 flex flex-col gap-2 hover:border-ink-700 hover:-translate-y-px transition-all duration-150"
      style={{ boxShadow: `inset 0 1px 0 ${meta.hex}10` }}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: `${meta.hex}18`, border: `1px solid ${meta.hex}30` }}
          >
            <Icon size={12} style={{ color: meta.hex }} />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-semibold text-ink-200 truncate">{meta.label}</div>
            <div className="text-[9px] font-mono text-ink-600">{stat.count} pts</div>
          </div>
        </div>

        {trend !== null && (
          <div
            className={cn(
              'shrink-0 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-mono',
              trendGood === true ? 'text-data-positive bg-data-positive/10 border border-data-positive/20' :
              trendGood === false ? 'text-data-negative bg-data-negative/10 border border-data-negative/20' :
              'text-ink-500 bg-ink-800 border border-ink-700'
            )}
          >
            {trend > 1 ? <TrendingUp size={8} /> : trend < -1 ? <TrendingDown size={8} /> : <Minus size={8} />}
            {Math.abs(trend).toFixed(0)}%
          </div>
        )}
      </div>

      {/* Big value */}
      <div className="flex items-baseline gap-1.5">
        <div className="text-2xl font-bold" style={{ color: meta.hex }}>
          {stat.last_value !== null ? meta.format(stat.last_value) : '—'}
        </div>
        {meta.unit && <div className="text-[10px] font-mono text-ink-500">{meta.unit}</div>}
      </div>

      {/* Gauge ou chart */}
      {isGauge && stat.last_value !== null ? (
        <GaugeMini value={gaugeVal} hex={meta.hex} />
      ) : chartData.length > 1 ? (
        <MiniChart data={chartData} hex={meta.hex} metric={stat.metric} meta={meta} />
      ) : null}

      {/* Mini stats */}
      <div className="grid grid-cols-4 gap-1 pt-2 border-t border-ink-800/60">
        <MiniStat label="7j" value={stat.avg_7d !== null ? meta.format(stat.avg_7d) : '—'} />
        <MiniStat label="30j" value={stat.avg_30d !== null ? meta.format(stat.avg_30d) : '—'} />
        <MiniStat label="Min" value={stat.min_90d !== null ? meta.format(stat.min_90d) : '—'} />
        <MiniStat label="Max" value={stat.max_90d !== null ? meta.format(stat.max_90d) : '—'} />
      </div>
    </div>
  )
}

// ── Gauge mini ────────────────────────────────────────────────────────────────

function GaugeMini({ value, hex }: { value: number; hex: string }) {
  const pct = Math.min(100, Math.max(0, value))
  const data = [{ value: pct }, { value: 100 - pct }]
  return (
    <div className="h-16 flex items-center justify-center -my-1">
      <div className="relative w-24 h-16">
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart
            cx="50%"
            cy="80%"
            innerRadius="65%"
            outerRadius="100%"
            startAngle={180}
            endAngle={0}
            data={data}
          >
            <RadialBar dataKey="value" cornerRadius={4} background={{ fill: '#1f2630' }}>
              <Cell fill={hex} />
              <Cell fill="transparent" />
            </RadialBar>
          </RadialBarChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex items-end justify-center pb-0.5">
          <span className="text-[9px] font-mono" style={{ color: hex }}>{Math.round(pct)}</span>
        </div>
      </div>
    </div>
  )
}

// ── Mini chart ────────────────────────────────────────────────────────────────

function MiniChart({
  data, hex, metric, meta,
}: {
  data: { date: string; value: number }[]
  hex: string
  metric: string
  meta: MetricMeta
}) {
  return (
    <div className="h-[60px] -mx-1">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 3, right: 3, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={`g-${metric}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={hex} stopOpacity={0.35} />
              <stop offset="100%" stopColor={hex} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="2 4" stroke="#1f2630" vertical={false} />
          <XAxis dataKey="date" hide />
          <YAxis hide domain={['auto', 'auto']} />
          <Tooltip
            contentStyle={{ background: '#0f1419', border: '1px solid #1f2630', borderRadius: 6, fontSize: 10, padding: '3px 8px' }}
            labelStyle={{ color: '#5a6572', fontSize: 9 }}
            formatter={(v: number) => [meta.format(v), meta.label]}
          />
          <Area type="monotone" dataKey="value" stroke={hex} strokeWidth={1.5} fill={`url(#g-${metric})`} dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── Mini stat ─────────────────────────────────────────────────────────────────

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center">
      <div className="text-[8px] uppercase tracking-wider text-ink-600">{label}</div>
      <div className="text-[10px] font-mono font-semibold text-ink-300 truncate">{value}</div>
    </div>
  )
}
