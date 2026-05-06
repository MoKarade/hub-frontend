'use client'

/**
 * /browser — Historique de navigation (Chrome principalement).
 *
 * Branche en live sur GET /v1/browser/* :
 *  - /stats : top domaines, par heure, par jour de semaine
 *  - /history : liste filtrable par domaine + recherche q + since_days
 *
 * L'ingestion vient de hub-ingest connector chrome_history (toutes les 6h)
 * qui copie le SQLite Chrome et POST /v1/browser/sync.
 */

import { useState } from 'react'
import useSWR from 'swr'
import {
  Globe,
  Search,
  Loader2,
  ExternalLink,
  Clock,
  Calendar,
} from 'lucide-react'
import { Sidebar } from '@/components/sidebar'
import { Widget } from '@/components/widget'
import { HubStatus } from '@/components/hub-status'
import { getBaseUrl } from '@/lib/api'
import { cn } from '@/lib/utils'

interface HistoryItem {
  id: string
  source: string
  url: string
  domain: string
  title: string | null
  visited_at: string
  visit_duration_s: number | null
  transition: string | null
}

interface BrowserStats {
  total_visits: number
  unique_domains: number
  top_domains: { domain: string; count: number }[]
  by_hour: { hour: number; count: number }[]
  by_day_of_week: { day: number; count: number }[]
}

const DAYS_FR = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export default function BrowserPage() {
  const base = getBaseUrl()
  const [domainFilter, setDomainFilter] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [sinceDays, setSinceDays] = useState(30)

  const { data: stats, isLoading: statsLoading } = useSWR<BrowserStats>(
    `${base}/v1/browser/stats?since_days=${sinceDays}`,
    fetcher,
  )

  const historyUrl = new URL(`${base}/v1/browser/history`)
  historyUrl.searchParams.set('limit', '100')
  historyUrl.searchParams.set('since_days', String(sinceDays))
  if (domainFilter) historyUrl.searchParams.set('domain', domainFilter)
  if (searchQuery.trim()) historyUrl.searchParams.set('q', searchQuery.trim())

  const { data: history, isLoading: historyLoading } = useSWR<HistoryItem[]>(
    historyUrl.toString(),
    fetcher,
  )

  const empty =
    !statsLoading && stats && stats.total_visits === 0

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 px-4 sm:px-6 lg:px-8 pt-16 lg:pt-6 pb-6 max-w-[1400px] space-y-4">
        <header className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
              <Globe size={20} className="text-accent" />
              Navigation
            </h1>
            <p className="text-xs text-ink-400 mt-0.5">
              Historique Chrome ingéré toutes les 6h
            </p>
          </div>
          <select
            value={sinceDays}
            onChange={(e) => setSinceDays(Number(e.target.value))}
            className="bg-ink-800 border border-ink-700 rounded-md px-3 py-2 text-xs"
          >
            <option value={7}>7 jours</option>
            <option value={30}>30 jours</option>
            <option value={90}>90 jours</option>
            <option value={365}>1 an</option>
          </select>
        </header>

        {empty && (
          <div className="panel p-6 text-center text-xs text-ink-400">
            Aucune visite encore. Active le cron <code className="font-mono">chrome_history</code> dans
            hub-ingest (.env <code className="font-mono">ENABLED_CONNECTORS=...,chrome_history</code>) ou
            lance manuellement : <code className="font-mono">RUN_MODE=chrome-history python -m src.main</code>
          </div>
        )}

        {/* KPI strip */}
        {stats && stats.total_visits > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
            <KpiTile label="Visites" value={stats.total_visits.toLocaleString('fr-CA')} />
            <KpiTile label="Domaines" value={stats.unique_domains.toLocaleString('fr-CA')} />
            <KpiTile
              label="Top domaine"
              value={stats.top_domains[0]?.domain.slice(0, 16) ?? '—'}
              sub={
                stats.top_domains[0] ? `${stats.top_domains[0].count}` : ''
              }
            />
            <KpiTile
              label="Periode"
              value={`${sinceDays}j`}
            />
          </div>
        )}

        {/* Top domains + heatmaps */}
        {stats && stats.top_domains.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <Widget id="top-domains" title="Top domaines" icon={Globe}>
              <ul className="space-y-1.5 text-xs">
                {stats.top_domains.slice(0, 12).map((d, i) => (
                  <li key={d.domain}>
                    <button
                      onClick={() =>
                        setDomainFilter(domainFilter === d.domain ? null : d.domain)
                      }
                      className={cn(
                        'w-full flex items-center gap-2 px-1.5 py-1 rounded transition-colors text-left',
                        domainFilter === d.domain
                          ? 'bg-accent/15 text-accent'
                          : 'hover:bg-ink-800/40 text-ink-200',
                      )}
                    >
                      <span className="font-mono text-ink-500 w-6 text-right">{i + 1}.</span>
                      <span className="flex-1 truncate">{d.domain}</span>
                      <span className="font-mono text-ink-400 shrink-0">{d.count}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </Widget>

            <Widget id="by-hour" title="Activité par heure" icon={Clock}>
              <HourHeatmap data={stats.by_hour} />
              <Widget id="by-dow" title="" className="border-0 mt-3 panel-hover-disable">
                <DayOfWeekChart data={stats.by_day_of_week} />
              </Widget>
            </Widget>
          </div>
        )}

        {/* Search bar */}
        <div className="panel p-3 flex gap-2 flex-col sm:flex-row">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher dans l'URL ou le titre..."
              className="w-full bg-ink-800 border border-ink-700 rounded-md pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-accent/60"
            />
          </div>
          {(domainFilter || searchQuery) && (
            <button
              onClick={() => {
                setDomainFilter(null)
                setSearchQuery('')
              }}
              className="px-3 py-2 rounded-md text-xs bg-ink-800 border border-ink-700 hover:border-ink-600"
            >
              Reset
            </button>
          )}
        </div>

        {/* Active filter pill */}
        {domainFilter && (
          <div className="text-xs text-ink-300">
            Filtre :{' '}
            <span className="font-mono bg-accent/15 text-accent px-1.5 py-0.5 rounded">
              {domainFilter}
            </span>
          </div>
        )}

        {/* History list */}
        <div className="panel overflow-x-auto">
          <table className="w-full text-sm min-w-[520px]">
            <thead className="bg-ink-800/40 text-[11px] uppercase tracking-wider text-ink-400">
              <tr>
                <th className="text-left px-3 py-2 font-medium">Date</th>
                <th className="text-left px-3 py-2 font-medium hidden md:table-cell">
                  Domaine
                </th>
                <th className="text-left px-3 py-2 font-medium">Titre / URL</th>
                <th className="text-right px-3 py-2 font-medium hidden lg:table-cell">
                  Durée
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-800/60">
              {historyLoading && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-ink-400">
                    <Loader2 size={14} className="inline animate-spin" /> Chargement…
                  </td>
                </tr>
              )}
              {!historyLoading && history && history.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-ink-400">
                    Aucune visite pour ces filtres.
                  </td>
                </tr>
              )}
              {history?.map((h) => (
                <tr key={h.id} className="hover:bg-ink-800/30 transition-colors">
                  <td className="px-3 py-2 font-mono text-xs text-ink-300 whitespace-nowrap">
                    {new Date(h.visited_at).toLocaleString('fr-CA', {
                      month: 'short',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                  <td className="px-3 py-2 text-xs text-ink-400 hidden md:table-cell font-mono truncate max-w-[140px]">
                    {h.domain}
                  </td>
                  <td className="px-3 py-2 max-w-[280px] sm:max-w-none">
                    <a
                      href={h.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-ink-200 hover:text-accent inline-flex items-center gap-1 truncate"
                    >
                      <span className="truncate">{h.title ?? h.url}</span>
                      <ExternalLink size={10} className="shrink-0 opacity-60" />
                    </a>
                    {h.title && (
                      <div className="text-[10px] text-ink-500 font-mono truncate">
                        {h.url}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-xs text-ink-400 hidden lg:table-cell whitespace-nowrap">
                    {h.visit_duration_s ? `${h.visit_duration_s}s` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <HubStatus />
      </main>
    </div>
  )
}

function KpiTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="ga-card p-3 flex flex-col gap-1 min-w-0">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-ink-400">
        {label}
      </div>
      <div className="metric truncate">{value}</div>
      {sub && <div className="text-[10px] text-ink-500 font-mono">{sub}</div>}
    </div>
  )
}

function HourHeatmap({ data }: { data: { hour: number; count: number }[] }) {
  if (!data || data.length === 0) {
    return <p className="text-xs text-ink-500 text-center py-4">Pas de données par heure</p>
  }
  const max = Math.max(...data.map((d) => d.count), 1)
  // Fill hours 0-23
  const counts: number[] = Array(24).fill(0)
  data.forEach((d) => {
    counts[d.hour] = d.count
  })
  return (
    <div>
      <div className="flex items-end gap-0.5 h-16">
        {counts.map((c, i) => {
          const h = max ? Math.max(2, (c / max) * 64) : 2
          return (
            <div
              key={i}
              className="flex-1 bg-accent/60 rounded-t hover:bg-accent transition-colors"
              style={{ height: `${h}px` }}
              title={`${i.toString().padStart(2, '0')}h : ${c} visites`}
            />
          )
        })}
      </div>
      <div className="flex justify-between text-[9px] font-mono text-ink-500 mt-1">
        <span>0h</span>
        <span>6h</span>
        <span>12h</span>
        <span>18h</span>
        <span>23h</span>
      </div>
    </div>
  )
}

function DayOfWeekChart({ data }: { data: { day: number; count: number }[] }) {
  if (!data || data.length === 0) return null
  const max = Math.max(...data.map((d) => d.count), 1)
  const counts: number[] = Array(7).fill(0)
  data.forEach((d) => {
    if (d.day >= 0 && d.day < 7) counts[d.day] = d.count
  })
  return (
    <div className="grid grid-cols-7 gap-1 text-center">
      {counts.map((c, i) => {
        const intensity = max ? c / max : 0
        return (
          <div key={i} className="flex flex-col items-center gap-1">
            <div
              className="w-full rounded"
              style={{
                height: `${Math.max(8, intensity * 32)}px`,
                background: `rgba(92,219,149,${0.2 + intensity * 0.7})`,
              }}
              title={`${DAYS_FR[i]} : ${c} visites`}
            />
            <span className="text-[9px] font-mono text-ink-500">{DAYS_FR[i]}</span>
          </div>
        )
      })}
    </div>
  )
}
