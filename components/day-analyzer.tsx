'use client'

/**
 * DayAnalyzer — Analyse d'une journee santé (Phase 6).
 *
 * Marc 2026-05-05 : "je veux pouvoir choisir la date exacte et que ca analyse
 * ce que je fais genre si jai fait du sport si jai bcp bouge ou non. je veux
 * voir en mode si jai ete actif ou non et des messages dencouragement"
 *
 * Workflow :
 *   - Date picker (default = today)
 *   - Fetch /v1/health-data/metrics?since=&until= pour cette date
 *   - Calcul d'un activity score 0-100 base sur :
 *       * steps      / target 10000
 *       * active_min / target 30
 *       * vigorous_min / target 20 (bonus)
 *       * floors     / target 10 (bonus)
 *   - Verdict : Actif (>=70) / Moyen (40-69) / Peu actif (<40)
 *   - Message d'encouragement contextuel + analyse comparee a la moyenne
 *   - Breakdown des metrics du jour
 */

import useSWR from 'swr'
import { useMemo, useState } from 'react'
import {
  Calendar as CalIcon,
  Footprints,
  Timer,
  Flame,
  Heart,
  Moon,
  Zap,
  TrendingUp,
  TrendingDown,
  Sparkles,
  Trophy,
  Target,
  ChevronUp,
  Activity,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface MetricItem {
  id: string
  date: string
  metric: string
  value: number
  source: string
}

interface MetricSummary {
  metric: string
  last_date: string
  last_value: number
  avg_7d: number | null
  avg_prev_7d: number | null
  avg_30d: number | null
  avg_90d: number | null
  max_90d: number | null
  min_90d: number | null
}

interface SummaryResponse {
  total_datapoints: number
  by_metric: MetricSummary[]
}

const fetcher = (url: string) => fetch(url).then((r) => r.json())

// ─── Score formula ──────────────────────────────────────────────────────────

interface DayMetrics {
  steps: number
  distance_m: number
  active_minutes: number
  calories: number
  vigorous_min: number
  moderate_min: number
  floors: number
  heart_rate_resting: number | null
  sleep_total_min: number | null
  training_readiness: number | null
  body_battery_max: number | null
}

function aggregateMetrics(items: MetricItem[]): DayMetrics {
  const pick = (m: string): number => {
    // Prend la valeur la plus elevee (Garmin > Google Fit en general)
    const vals = items.filter((it) => it.metric === m).map((it) => it.value)
    return vals.length > 0 ? Math.max(...vals) : 0
  }
  const pickOpt = (m: string): number | null => {
    const vals = items.filter((it) => it.metric === m).map((it) => it.value)
    return vals.length > 0 ? Math.max(...vals) : null
  }
  return {
    steps: pick('steps'),
    distance_m: pick('distance_m'),
    active_minutes: pick('active_minutes'),
    calories: pick('calories'),
    vigorous_min: pick('intensity_vigorous_min'),
    moderate_min: pick('intensity_moderate_min'),
    floors: pick('floors'),
    heart_rate_resting: pickOpt('heart_rate_resting'),
    sleep_total_min: pickOpt('sleep_total_min'),
    training_readiness: pickOpt('training_readiness'),
    body_battery_max: pickOpt('body_battery_max'),
  }
}

function computeActivityScore(d: DayMetrics): number {
  // Pondere : steps 40%, active_min 30%, vigorous 20%, floors 10%
  const stepsScore = Math.min(d.steps / 10000, 1) * 40
  const activeScore = Math.min(d.active_minutes / 30, 1) * 30
  const vigorousScore = Math.min(d.vigorous_min / 20, 1) * 20
  const floorsScore = Math.min(d.floors / 10, 1) * 10
  return Math.round(stepsScore + activeScore + vigorousScore + floorsScore)
}

interface Verdict {
  level: 'great' | 'good' | 'medium' | 'low' | 'rest'
  emoji: string
  title: string
  color: string
  bg: string
}

function getVerdict(score: number, d: DayMetrics): Verdict {
  // Cas particulier : journee de repos volontaire (sommeil ok mais peu d'activite)
  if (score < 25 && d.sleep_total_min && d.sleep_total_min > 420) {
    return {
      level: 'rest',
      emoji: '😴',
      title: 'Journee repos',
      color: 'text-info',
      bg: 'bg-info/10 border-info/30',
    }
  }
  if (score >= 80) {
    return {
      level: 'great',
      emoji: '🔥',
      title: 'Journee de feu',
      color: 'text-data-positive',
      bg: 'bg-data-positive/10 border-data-positive/40',
    }
  }
  if (score >= 60) {
    return {
      level: 'good',
      emoji: '💪',
      title: 'Tres actif',
      color: 'text-data-positive',
      bg: 'bg-data-positive/10 border-data-positive/30',
    }
  }
  if (score >= 35) {
    return {
      level: 'medium',
      emoji: '👍',
      title: 'Activite moyenne',
      color: 'text-warn',
      bg: 'bg-warn/10 border-warn/30',
    }
  }
  return {
    level: 'low',
    emoji: '🛋️',
    title: 'Journee tranquille',
    color: 'text-data-negative',
    bg: 'bg-data-negative/10 border-data-negative/30',
  }
}

function buildMessages(d: DayMetrics, verdict: Verdict, isToday: boolean, avg7d?: number): string[] {
  const msgs: string[] = []
  // Steps
  if (d.steps >= 12000) {
    msgs.push(`🏆 ${d.steps.toLocaleString('fr-CA')} pas — t'as marche pas mal !`)
  } else if (d.steps >= 8000) {
    msgs.push(`👟 ${d.steps.toLocaleString('fr-CA')} pas, bon volume.`)
  } else if (d.steps >= 4000) {
    msgs.push(`🚶 ${d.steps.toLocaleString('fr-CA')} pas — pas mal mais tu peux pousser plus.`)
  } else if (d.steps > 0) {
    msgs.push(`📉 ${d.steps.toLocaleString('fr-CA')} pas seulement.${isToday ? ' La journee n\'est pas finie !' : ''}`)
  }
  // Active minutes
  if (d.active_minutes >= 60) {
    msgs.push(`⚡ ${d.active_minutes} min actives — excellent !`)
  } else if (d.active_minutes >= 30) {
    msgs.push(`✅ ${d.active_minutes} min actives — tu hits l'OMS recommandation.`)
  } else if (d.active_minutes > 0) {
    msgs.push(`⏱️ ${d.active_minutes} min actives — vise 30 min idealement.`)
  }
  // Vigorous
  if (d.vigorous_min >= 20) {
    msgs.push(`🔥 ${d.vigorous_min} min d'intensite vigoureuse — top cardio !`)
  }
  // Floors
  if (d.floors >= 15) {
    msgs.push(`🧗 ${d.floors.toFixed(0)} etages grimpes — beau cardio.`)
  }
  // Sleep
  if (d.sleep_total_min) {
    const h = (d.sleep_total_min / 60).toFixed(1)
    if (d.sleep_total_min >= 480) {
      msgs.push(`🌙 ${h} h de sommeil — recuperation au top.`)
    } else if (d.sleep_total_min >= 360) {
      msgs.push(`💤 ${h} h de sommeil — corret.`)
    } else {
      msgs.push(`😪 Seulement ${h} h de sommeil — vise 7-9h pour mieux recuperer.`)
    }
  }
  // Heart rate resting
  if (d.heart_rate_resting && d.heart_rate_resting < 55) {
    msgs.push(`❤️ FC repos ${Math.round(d.heart_rate_resting)} bpm — excellente forme cardio.`)
  }
  // Comparaison avec moyenne 7j
  if (avg7d && d.steps > 0) {
    const delta = ((d.steps - avg7d) / avg7d) * 100
    if (Math.abs(delta) > 15) {
      const dir = delta > 0 ? 'au-dessus' : 'sous'
      msgs.push(`📊 ${Math.abs(Math.round(delta))}% ${dir} ta moyenne 7j (${Math.round(avg7d).toLocaleString('fr-CA')} pas).`)
    }
  }
  // Message final selon verdict
  if (verdict.level === 'great') {
    msgs.push(`🎯 Continue comme ca — ces journees-la font la difference !`)
  } else if (verdict.level === 'good') {
    msgs.push(`💯 Solide journee. Garde le rythme.`)
  } else if (verdict.level === 'medium') {
    msgs.push(`🔄 Demain, vise 1000 pas de plus ou 10 min actives en plus.`)
  } else if (verdict.level === 'low') {
    if (isToday) {
      msgs.push(`💡 ${d.steps < 3000 ? 'Une marche de 20 min te ferait du bien.' : 'Encore le temps de bouger un peu.'}`)
    } else {
      msgs.push(`📝 Note ta journee : tout le monde a besoin de repos parfois.`)
    }
  } else if (verdict.level === 'rest') {
    msgs.push(`😌 Une bonne nuit + repos = recup. Demain attaque fort.`)
  }
  return msgs
}

// ─── Composant principal ─────────────────────────────────────────────────────

export function DayAnalyzer() {
  const today = new Date().toISOString().slice(0, 10)
  const [date, setDate] = useState<string>(today)

  const metrics = useSWR<MetricItem[]>(
    `/api/v1/health-data/metrics?since=${date}&until=${date}&limit=200`,
    fetcher,
  )
  const summary = useSWR<SummaryResponse>('/api/v1/health-data/summary', fetcher)

  const dayData = useMemo(() => {
    if (!metrics.data) return null
    const items = Array.isArray(metrics.data) ? metrics.data : []
    return aggregateMetrics(items)
  }, [metrics.data])

  const score = dayData ? computeActivityScore(dayData) : 0
  const verdict = dayData ? getVerdict(score, dayData) : null
  const isToday = date === today

  const stepsAvg7d = summary.data?.by_metric.find((m) => m.metric === 'steps')?.avg_7d ?? undefined
  const messages = dayData && verdict ? buildMessages(dayData, verdict, isToday, stepsAvg7d) : []

  const hasData = dayData && (dayData.steps > 0 || dayData.active_minutes > 0)

  return (
    <section className="ga-card p-4">
      <header className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Sparkles size={14} className="text-accent" />
          <h2 className="text-sm font-semibold text-ink-100">Analyse du jour</h2>
          <span className="text-[10px] font-mono text-ink-500">automatique</span>
        </div>
        <div className="flex items-center gap-2">
          <CalIcon size={12} className="text-ink-500" />
          <input
            type="date"
            value={date}
            max={today}
            onChange={(e) => setDate(e.target.value)}
            className="bg-ink-900 border border-ink-700 rounded px-2 py-1 text-xs font-mono text-ink-100 focus:border-accent/50 outline-none"
          />
          {!isToday && (
            <button
              type="button"
              onClick={() => setDate(today)}
              className="text-[10px] font-mono uppercase tracking-wider text-ink-400 hover:text-accent transition-colors px-2 py-1 rounded border border-ink-700 hover:border-accent"
            >
              auj.
            </button>
          )}
        </div>
      </header>

      {metrics.isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="h-32 bg-ink-800 rounded skeleton" />
          <div className="h-32 bg-ink-800 rounded skeleton" />
        </div>
      )}

      {!metrics.isLoading && !hasData && (
        <div className="text-center py-6">
          <Activity size={24} className="text-ink-500 mx-auto mb-2" />
          <div className="text-sm text-ink-300 mb-1">Aucune donnee pour cette date</div>
          <div className="text-xs text-ink-500">
            {isToday
              ? 'Sync Garmin/Fit, ou la journee commence tout juste.'
              : 'Pas de data sync pour ce jour.'}
          </div>
        </div>
      )}

      {!metrics.isLoading && hasData && verdict && dayData && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Verdict + score */}
          <div className={cn('rounded-lg p-4 border', verdict.bg)}>
            <div className="flex items-center gap-3 mb-3">
              <div className="text-3xl">{verdict.emoji}</div>
              <div className="flex-1 min-w-0">
                <div className={cn('text-base font-semibold', verdict.color)}>{verdict.title}</div>
                <div className="text-[11px] font-mono text-ink-400">
                  {isToday ? "Aujourd'hui" : new Date(date).toLocaleDateString('fr-CA', { weekday: 'long', day: 'numeric', month: 'long' })}
                </div>
              </div>
              <ScoreRing score={score} color={verdict.color} />
            </div>
            <div className="space-y-1.5">
              {messages.map((m, i) => (
                <div key={i} className="text-[12px] text-ink-200 leading-snug">
                  {m}
                </div>
              ))}
            </div>
          </div>

          {/* Breakdown metrics */}
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <MetricTile icon={Footprints} label="Pas" value={dayData.steps.toLocaleString('fr-CA')} target={10000} cur={dayData.steps} color="#5cdb95" />
              <MetricTile icon={Timer} label="Min actives" value={String(dayData.active_minutes)} target={30} cur={dayData.active_minutes} color="#7ee8b3" />
              <MetricTile icon={Flame} label="Cal actives" value={Math.round(dayData.calories).toLocaleString('fr-CA')} target={500} cur={dayData.calories} color="#ffb84d" />
              <MetricTile icon={Activity} label="Distance" value={`${(dayData.distance_m / 1000).toFixed(1)} km`} target={5000} cur={dayData.distance_m} color="#5fb3f4" />
              <MetricTile icon={ChevronUp} label="Etages" value={dayData.floors.toFixed(0)} target={10} cur={dayData.floors} color="#a3c4f3" />
              <MetricTile icon={Zap} label="Vigoureux" value={`${dayData.vigorous_min} min`} target={20} cur={dayData.vigorous_min} color="#ff7c40" />
            </div>
            {(dayData.sleep_total_min || dayData.heart_rate_resting || dayData.training_readiness) && (
              <div className="grid grid-cols-3 gap-2 pt-1">
                {dayData.sleep_total_min !== null && (
                  <MiniStat icon={Moon} label="Sommeil" value={`${(dayData.sleep_total_min / 60).toFixed(1)}h`} />
                )}
                {dayData.heart_rate_resting !== null && (
                  <MiniStat icon={Heart} label="FC repos" value={`${Math.round(dayData.heart_rate_resting)} bpm`} />
                )}
                {dayData.training_readiness !== null && (
                  <MiniStat icon={Trophy} label="Readiness" value={`${Math.round(dayData.training_readiness)}`} />
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  )
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function ScoreRing({ score, color }: { score: number; color: string }) {
  const radius = 22
  const circumference = 2 * Math.PI * radius
  const offset = circumference * (1 - score / 100)
  return (
    <div className="relative w-14 h-14 shrink-0">
      <svg className="w-14 h-14 -rotate-90" viewBox="0 0 56 56">
        <circle cx="28" cy="28" r={radius} stroke="currentColor" strokeWidth="4" fill="none" className="text-ink-800" />
        <circle
          cx="28" cy="28" r={radius}
          stroke="currentColor" strokeWidth="4" fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className={cn(color, 'transition-all duration-500')}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={cn('text-sm font-mono font-bold', color)}>{score}</span>
      </div>
    </div>
  )
}

function MetricTile({
  icon: Icon, label, value, target, cur, color,
}: {
  icon: LucideIcon
  label: string
  value: string
  target: number
  cur: number
  color: string
}) {
  const pct = Math.min(100, (cur / target) * 100)
  const reached = pct >= 100
  return (
    <div className="bg-ink-900 border border-ink-800 rounded p-2.5">
      <div className="flex items-center gap-1.5 mb-1">
        <Icon size={11} className="text-ink-500" style={{ color }} />
        <div className="text-[10px] font-mono uppercase tracking-wider text-ink-500">{label}</div>
        {reached && <Target size={10} className="text-data-positive ml-auto" />}
      </div>
      <div className="text-[14px] font-mono font-semibold text-ink-100 truncate">{value}</div>
      <div className="mt-1.5 h-1 bg-ink-800 rounded overflow-hidden">
        <div
          className="h-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  )
}

function MiniStat({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="bg-ink-900 border border-ink-800 rounded p-2 flex items-center gap-2">
      <Icon size={12} className="text-ink-400 shrink-0" />
      <div className="min-w-0">
        <div className="text-[9px] font-mono uppercase tracking-wider text-ink-500 truncate">{label}</div>
        <div className="text-[12px] font-mono font-semibold text-ink-100 truncate">{value}</div>
      </div>
    </div>
  )
}
