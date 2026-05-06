'use client'

/**
 * /me — tableau de bord life metrics cross-domain.
 *
 * 1 vue qui agrege TOUTES les sources (banque, sante, locations, browser,
 * gaming, streaming, productivite). Selecteur de periode 7d/30d/90d/365d/all.
 */

import { useState } from 'react'
import useSWR from 'swr'
import {
  User,
  Wallet,
  Heart,
  MapPin,
  Globe,
  Gamepad2,
  Tv,
  CheckSquare,
  Calendar,
  Image as ImageIcon,
  Mail,
  Loader2,
} from 'lucide-react'
import { Sidebar } from '@/components/sidebar'
import { Widget } from '@/components/widget'
import { HubStatus } from '@/components/hub-status'
import { MeChartsSection } from '@/components/me-charts'
import { getBaseUrl } from '@/lib/api'

interface MeDashboard {
  period: string
  period_days: number | null
  generated_at: string
  counts: {
    transactions: number
    location_visits: number
    location_unique_places: number
    photos: number
    emails: number
    calendar_events: number
    tasks_completed: number
    tasks_pending: number
    health_datapoints: number
    contacts_total: number
    drive_files_total: number
    youtube_activities: number
    streaming_episodes: number
    streaming_movies: number
    browser_visits: number
    browser_unique_domains: number
    steam_games_played: number
    news_articles: number
    privacy_requests: number
  }
  finance: {
    total_spend_cad: number
    total_credit_cad: number
    net_cad: number
    biggest_debit_amount: number | null
    biggest_debit_desc: string | null
    transactions_count: number
  }
  health: {
    avg_steps: number | null
    avg_sleep_hours: number | null
    avg_resting_hr: number | null
    avg_stress: number | null
    avg_hrv: number | null
    total_active_min: number | null
    days_with_data: number
  }
  locations: {
    visits: number
    unique_places: number
    home_visits: number
    work_visits: number
    last_home_iso: string | null
    days_since_home: number | null
    most_visited_place: string | null
    most_visited_count: number
  }
  screen_time: {
    browser_visits: number
    browser_top_domains: { domain: string; count: number }[]
    gaming_minutes: number
    gaming_top_games: { name: string; minutes: number }[]
    streaming_total_runtime_h: number
  }
  productivity: {
    tasks_completed: number
    tasks_pending: number
    tasks_overdue: number
    completion_rate_pct: number | null
    calendar_events: number
  }
}

const fetcher = (url: string) => fetch(url).then((r) => r.json())

const PERIODS = [
  { id: '7d', label: '7 jours' },
  { id: '30d', label: '30 jours' },
  { id: '90d', label: '90 jours' },
  { id: '365d', label: '1 an' },
  { id: 'all', label: 'Tout' },
] as const

export default function MePage() {
  const base = getBaseUrl()
  const [period, setPeriod] = useState<'7d' | '30d' | '90d' | '365d' | 'all'>('30d')

  const { data, isLoading } = useSWR<MeDashboard>(
    `${base}/v1/me/dashboard?period=${period}`,
    fetcher,
  )

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 px-4 sm:px-6 lg:px-8 pt-16 lg:pt-6 pb-6 max-w-[1400px] space-y-4">
        <header className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
              <User size={20} className="text-accent" />
              Mon tableau de bord
            </h1>
            <p className="text-xs text-ink-400 mt-0.5">
              Vue agrégée cross-domain — toutes tes sources en 1 page
            </p>
          </div>
          <div className="tabs-scrollable sm:flex sm:gap-1">
            {PERIODS.map((p) => (
              <button
                key={p.id}
                onClick={() => setPeriod(p.id)}
                className={`px-3 py-2 rounded-md text-xs whitespace-nowrap shrink-0 ${
                  period === p.id
                    ? 'bg-accent/15 border border-accent/40 text-accent'
                    : 'bg-ink-800 border border-ink-700 text-ink-300 hover:border-ink-600'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </header>

        {isLoading && !data && (
          <div className="panel p-12 text-center text-ink-400">
            <Loader2 size={20} className="inline animate-spin" /> Calcul en cours…
          </div>
        )}

        {data && (
          <>
            {/* Headline KPIs */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
              <KpiTile
                icon={<Wallet size={14} />}
                label="Dépenses"
                value={`${data.finance.total_spend_cad.toLocaleString('fr-CA', { maximumFractionDigits: 0 })} $`}
                color="text-data-negative"
              />
              <KpiTile
                icon={<Wallet size={14} />}
                label="Net"
                value={`${data.finance.net_cad >= 0 ? '+' : ''}${data.finance.net_cad.toLocaleString('fr-CA', { maximumFractionDigits: 0 })} $`}
                color={data.finance.net_cad >= 0 ? 'text-data-positive' : 'text-data-negative'}
              />
              <KpiTile
                icon={<Heart size={14} />}
                label="Pas / jour"
                value={
                  data.health.avg_steps
                    ? data.health.avg_steps.toLocaleString('fr-CA', {
                        maximumFractionDigits: 0,
                      })
                    : '—'
                }
              />
              <KpiTile
                icon={<Heart size={14} />}
                label="Sommeil"
                value={data.health.avg_sleep_hours ? `${data.health.avg_sleep_hours} h` : '—'}
              />
              <KpiTile
                icon={<MapPin size={14} />}
                label="Lieux uniques"
                value={String(data.counts.location_unique_places)}
              />
              <KpiTile
                icon={<CheckSquare size={14} />}
                label="Tâches faites"
                value={String(data.productivity.tasks_completed)}
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {/* Finance */}
              <Widget id="me-finance" title="Finance" icon={Wallet}>
                <div className="space-y-2 text-sm">
                  <Row label="Crédits" value={`${data.finance.total_credit_cad.toLocaleString('fr-CA')} $`} positive />
                  <Row label="Débits" value={`${data.finance.total_spend_cad.toLocaleString('fr-CA')} $`} negative />
                  <Row label="Net" value={`${data.finance.net_cad >= 0 ? '+' : ''}${data.finance.net_cad.toLocaleString('fr-CA')} $`} positive={data.finance.net_cad >= 0} negative={data.finance.net_cad < 0} bold />
                  <Row label="Transactions" value={String(data.finance.transactions_count)} />
                  {data.finance.biggest_debit_amount !== null && (
                    <div className="pt-2 border-t border-ink-800/60">
                      <div className="text-[10px] text-ink-500 uppercase tracking-wider">Plus grosse dépense</div>
                      <div className="text-xs text-ink-200 mt-0.5">{data.finance.biggest_debit_desc}</div>
                      <div className="text-data-negative font-mono text-xs mt-0.5">
                        -{data.finance.biggest_debit_amount.toLocaleString('fr-CA')} $
                      </div>
                    </div>
                  )}
                </div>
              </Widget>

              {/* Health */}
              <Widget id="me-health" title="Santé" icon={Heart}>
                <div className="space-y-2 text-sm">
                  <Row label="Pas / jour" value={data.health.avg_steps?.toLocaleString('fr-CA', { maximumFractionDigits: 0 }) ?? '—'} />
                  <Row label="Sommeil moyen" value={data.health.avg_sleep_hours ? `${data.health.avg_sleep_hours} h` : '—'} />
                  <Row label="RHR moyenne" value={data.health.avg_resting_hr ? `${data.health.avg_resting_hr.toFixed(0)} bpm` : '—'} />
                  <Row label="Stress moyen" value={data.health.avg_stress?.toFixed(0) ?? '—'} />
                  <Row label="HRV moyenne" value={data.health.avg_hrv?.toFixed(0) ?? '—'} />
                  <Row label="Minutes actives" value={data.health.total_active_min ? `${data.health.total_active_min} min` : '—'} />
                  <Row label="Jours avec data" value={String(data.health.days_with_data)} />
                </div>
              </Widget>

              {/* Locations */}
              <Widget id="me-locations" title="Localisation" icon={MapPin}>
                <div className="space-y-2 text-sm">
                  <Row label="Visites" value={data.locations.visits.toLocaleString('fr-CA')} />
                  <Row label="Lieux uniques" value={String(data.locations.unique_places)} />
                  <Row label="Visites maison" value={String(data.locations.home_visits)} />
                  <Row label="Visites travail" value={String(data.locations.work_visits)} />
                  {data.locations.days_since_home !== null && (
                    <Row
                      label="Dernier passage maison"
                      value={`il y a ${data.locations.days_since_home} j`}
                      negative={data.locations.days_since_home > 30}
                    />
                  )}
                  {data.locations.most_visited_place && (
                    <Row
                      label="Lieu le plus visité"
                      value={`${data.locations.most_visited_place.slice(0, 30)} (${data.locations.most_visited_count}×)`}
                    />
                  )}
                </div>
              </Widget>

              {/* Screen time */}
              <Widget id="me-screen" title="Temps écran" icon={Globe}>
                <div className="space-y-3 text-sm">
                  <Row
                    label="Visites navigateur"
                    value={data.screen_time.browser_visits.toLocaleString('fr-CA')}
                  />
                  <Row
                    label="Heures gaming"
                    value={
                      data.screen_time.gaming_minutes > 0
                        ? `${(data.screen_time.gaming_minutes / 60).toFixed(1)} h`
                        : '—'
                    }
                  />
                  <Row
                    label="Heures streaming"
                    value={
                      data.screen_time.streaming_total_runtime_h > 0
                        ? `${data.screen_time.streaming_total_runtime_h.toFixed(1)} h`
                        : '—'
                    }
                  />
                  {data.screen_time.browser_top_domains.length > 0 && (
                    <div className="pt-2 border-t border-ink-800/60">
                      <div className="text-[10px] text-ink-500 uppercase tracking-wider mb-1">Top sites</div>
                      <ul className="space-y-1 text-xs">
                        {data.screen_time.browser_top_domains.slice(0, 5).map((d) => (
                          <li key={d.domain} className="flex justify-between gap-2">
                            <span className="truncate text-ink-300">{d.domain}</span>
                            <span className="font-mono text-ink-500 shrink-0">{d.count}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {data.screen_time.gaming_top_games.length > 0 && (
                    <div className="pt-2 border-t border-ink-800/60">
                      <div className="text-[10px] text-ink-500 uppercase tracking-wider mb-1">Top jeux</div>
                      <ul className="space-y-1 text-xs">
                        {data.screen_time.gaming_top_games.slice(0, 5).map((g) => (
                          <li key={g.name} className="flex justify-between gap-2">
                            <span className="truncate text-ink-300">{g.name}</span>
                            <span className="font-mono text-ink-500 shrink-0">{g.minutes} min</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </Widget>

              {/* Productivity */}
              <Widget id="me-productivity" title="Productivité" icon={CheckSquare}>
                <div className="space-y-2 text-sm">
                  <Row label="Tâches terminées" value={String(data.productivity.tasks_completed)} positive />
                  <Row label="Tâches en cours" value={String(data.productivity.tasks_pending)} />
                  <Row
                    label="Tâches en retard"
                    value={String(data.productivity.tasks_overdue)}
                    negative={data.productivity.tasks_overdue > 0}
                  />
                  {data.productivity.completion_rate_pct !== null && (
                    <Row
                      label="Taux complétion"
                      value={`${data.productivity.completion_rate_pct}%`}
                      positive={data.productivity.completion_rate_pct >= 70}
                    />
                  )}
                  <Row label="Événements calendrier" value={String(data.productivity.calendar_events)} />
                </div>
              </Widget>

              {/* Engagement counts */}
              <Widget id="me-counts" title="Activité par source" icon={User}>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <CountTile icon={<ImageIcon size={11} />} label="Photos" value={data.counts.photos} />
                  <CountTile icon={<Mail size={11} />} label="Emails" value={data.counts.emails} />
                  <CountTile icon={<Calendar size={11} />} label="Events" value={data.counts.calendar_events} />
                  <CountTile icon={<Tv size={11} />} label="Streaming" value={data.counts.streaming_episodes + data.counts.streaming_movies} />
                  <CountTile icon={<Gamepad2 size={11} />} label="Jeux joués" value={data.counts.steam_games_played} />
                  <CountTile icon={<Globe size={11} />} label="Domaines uniques" value={data.counts.browser_unique_domains} />
                </div>
              </Widget>
            </div>

            {/* ── Tendances graphiques ── */}
            <h2 className="text-sm font-semibold text-ink-200 mt-4 flex items-center gap-2">
              <span className="w-1 h-4 bg-accent/60 rounded" />
              Tendances {data.period_days ? `${data.period_days} derniers jours` : ''}
            </h2>
            <MeChartsSection days={data.period_days ?? 30} />

            <p className="text-[10px] text-ink-500 font-mono text-center pt-2">
              Calculé le {new Date(data.generated_at).toLocaleString('fr-CA')}
            </p>
          </>
        )}

        <HubStatus />
      </main>
    </div>
  )
}

function KpiTile({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode
  label: string
  value: string
  color?: string
}) {
  return (
    <div className="ga-card p-3 flex flex-col gap-1 min-w-0">
      <div className="flex items-center gap-1.5 text-ink-400">
        {icon}
        <span className="text-[10px] font-semibold uppercase tracking-wider truncate">
          {label}
        </span>
      </div>
      <div className={`metric truncate ${color ?? ''}`}>{value}</div>
    </div>
  )
}

function Row({
  label,
  value,
  positive,
  negative,
  bold,
}: {
  label: string
  value: string
  positive?: boolean
  negative?: boolean
  bold?: boolean
}) {
  const color = positive ? 'text-data-positive' : negative ? 'text-data-negative' : 'text-ink-200'
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs text-ink-400">{label}</span>
      <span className={`font-mono tabular-nums ${color} ${bold ? 'font-bold' : ''} truncate`}>
        {value}
      </span>
    </div>
  )
}

function CountTile({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: number
}) {
  return (
    <div className="bg-ink-900/60 border border-ink-800/60 rounded p-2 flex flex-col gap-0.5 min-w-0">
      <div className="flex items-center gap-1 text-ink-500">
        {icon}
        <span className="text-[10px] uppercase tracking-wider truncate">{label}</span>
      </div>
      <div className="font-mono font-semibold tabular-nums truncate">
        {value.toLocaleString('fr-CA')}
      </div>
    </div>
  )
}
