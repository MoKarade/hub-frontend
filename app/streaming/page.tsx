'use client'

/**
 * /streaming — Trakt.tv hub (Phase 6).
 *
 * Affiche la history streaming agregee (Netflix / Prime / Disney+ / etc.) via
 * Trakt API. Marc doit d'abord :
 *  1. Creer une app Trakt sur https://trakt.tv/oauth/applications
 *  2. Renseigner TRAKT_CLIENT_ID + TRAKT_CLIENT_SECRET dans hub-core/.env
 *  3. Cliquer "Connecter Trakt" -> OAuth -> token stocke chiffre en DB
 *  4. POST /v1/streaming/sync (manuel ou cron 12h auto)
 */

import { useCallback, useEffect, useState } from 'react'
import useSWR from 'swr'
import { Sidebar } from '@/components/sidebar'
import { Widget } from '@/components/widget'
import { HubStatus } from '@/components/hub-status'
import { Tv, RefreshCw, Film, Clock, ExternalLink } from 'lucide-react'
import { getBaseUrl } from '@/lib/api'
import { cn } from '@/lib/utils'

interface StreamingStatus {
  connected: boolean
  reason?: string
  expires_at?: string
  is_expired?: boolean
}

interface StreamingStats {
  total_activities: number
  total_movies: number
  total_episodes: number
  total_runtime_hours: number
  top_shows: { show_title: string; count: number }[]
  by_month: { month: string; count: number }[]
}

interface ActivityItem {
  id: string
  source: string
  item_type: 'movie' | 'episode'
  title: string
  year: number | null
  show_title: string | null
  season: number | null
  episode: number | null
  runtime_minutes: number | null
  watched_at: string
  platform: string | null
}

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export default function StreamingPage() {
  const base = getBaseUrl()
  const { data: status, mutate: mutateStatus } = useSWR<StreamingStatus>(
    `${base}/v1/streaming/status`,
    fetcher,
  )
  const { data: stats, mutate: mutateStats } = useSWR<StreamingStats>(
    `${base}/v1/streaming/stats`,
    fetcher,
  )
  const { data: history, mutate: mutateHistory } = useSWR<ActivityItem[]>(
    `${base}/v1/streaming/history?limit=50`,
    fetcher,
  )

  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const sync = useCallback(async () => {
    setSyncing(true)
    setError(null)
    try {
      const r = await fetch(`${base}/v1/streaming/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days_back: 30, max_results: 1000 }),
      })
      if (!r.ok) {
        const data = await r.json().catch(() => ({}))
        throw new Error(data.detail || `HTTP ${r.status}`)
      }
      mutateStatus(); mutateStats(); mutateHistory()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSyncing(false)
    }
  }, [base, mutateStatus, mutateStats, mutateHistory])

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 px-4 sm:px-6 lg:px-8 pt-16 lg:pt-6 pb-6 max-w-[1400px] space-y-4">
        <header className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
              <Tv size={20} className="text-accent" />
              Streaming
            </h1>
            <p className="text-xs text-ink-400 mt-0.5">
              Netflix · Prime · Disney+ · Crunchyroll via Trakt.tv
            </p>
          </div>
          <div className="flex items-center gap-2">
            {status?.connected ? (
              <button
                onClick={sync}
                disabled={syncing}
                className="px-3 py-2 rounded-md text-xs font-semibold bg-accent/15 border border-accent/40 text-accent hover:bg-accent/25 disabled:opacity-40 inline-flex items-center gap-1.5"
              >
                <RefreshCw size={11} className={syncing ? 'animate-spin' : ''} />
                {syncing ? 'Sync…' : 'Sync 30j'}
              </button>
            ) : (
              <a
                href={`${base}/v1/streaming/connect`}
                className="px-3 py-2 rounded-md text-xs font-semibold bg-info/15 border border-info/40 text-info hover:bg-info/25 inline-flex items-center gap-1.5"
              >
                Connecter Trakt <ExternalLink size={11} />
              </a>
            )}
          </div>
        </header>

        {error && (
          <div className="panel p-3 border-red-500/40 text-xs text-red-400 font-mono">
            Erreur : {error}
          </div>
        )}

        {/* Status */}
        {status && !status.connected && (
          <div className="panel p-4 text-sm">
            <p className="text-ink-300">
              Pas connecte a Trakt. Pour activer :
            </p>
            <ol className="text-xs text-ink-400 mt-2 space-y-1 list-decimal list-inside">
              <li>
                Cree une app Trakt sur{' '}
                <a
                  href="https://trakt.tv/oauth/applications"
                  target="_blank"
                  rel="noreferrer"
                  className="text-accent hover:underline"
                >
                  trakt.tv/oauth/applications
                </a>{' '}
                (gratuit)
              </li>
              <li>
                Redirect URI = <code className="font-mono bg-ink-800 px-1">https://hubperso.com/v1/streaming/oauth/callback</code>
              </li>
              <li>
                Renseigne <code className="font-mono">TRAKT_CLIENT_ID</code> et{' '}
                <code className="font-mono">TRAKT_CLIENT_SECRET</code> dans hub-core/.env, restart
              </li>
              <li>Clique &laquo;&nbsp;Connecter Trakt&nbsp;&raquo; en haut</li>
            </ol>
          </div>
        )}

        {/* KPI strip */}
        {stats && stats.total_activities > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
            <KpiTile
              icon={<Film size={14} />}
              label="Films"
              value={String(stats.total_movies)}
            />
            <KpiTile
              icon={<Tv size={14} />}
              label="Episodes"
              value={String(stats.total_episodes)}
            />
            <KpiTile
              icon={<Clock size={14} />}
              label="Heures"
              value={`${stats.total_runtime_hours}h`}
            />
            <KpiTile
              icon={<Tv size={14} />}
              label="Total"
              value={String(stats.total_activities)}
            />
          </div>
        )}

        {/* Top shows */}
        {stats && stats.top_shows.length > 0 && (
          <Widget id="top-shows" title="Top series" icon={Tv}>
            <ul className="space-y-1.5 text-xs">
              {stats.top_shows.map((s, i) => (
                <li key={s.show_title} className="flex items-center gap-2">
                  <span className="font-mono text-ink-500 w-6 text-right">{i + 1}.</span>
                  <span className="flex-1 truncate text-ink-200">{s.show_title}</span>
                  <span className="font-mono text-ink-400 shrink-0">{s.count} ep.</span>
                </li>
              ))}
            </ul>
          </Widget>
        )}

        {/* History */}
        <Widget id="history" title="Visionnages recents" icon={Clock} noPadding>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[480px]">
              <thead className="bg-ink-800/40 text-[11px] uppercase tracking-wider text-ink-400">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">Date</th>
                  <th className="text-left px-3 py-2 font-medium">Type</th>
                  <th className="text-left px-3 py-2 font-medium">Titre</th>
                  <th className="text-right px-3 py-2 font-medium hidden md:table-cell">Duree</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-800/60">
                {!history && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-ink-400">Chargement…</td>
                  </tr>
                )}
                {history && history.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-ink-400">
                      Aucun visionnage. Lance un sync.
                    </td>
                  </tr>
                )}
                {history && history.map((h) => (
                  <tr key={h.id} className="hover:bg-ink-800/30 transition-colors">
                    <td className="px-3 py-2 font-mono text-xs text-ink-300 whitespace-nowrap">
                      {new Date(h.watched_at).toLocaleDateString('fr-CA')}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      <span className={cn(
                        'inline-block px-1.5 py-0.5 rounded text-[10px] uppercase font-mono',
                        h.item_type === 'movie' ? 'bg-info/15 text-info' : 'bg-accent/15 text-accent',
                      )}>
                        {h.item_type === 'movie' ? 'Film' : 'Ep.'}
                      </span>
                    </td>
                    <td className="px-3 py-2 max-w-[260px] sm:max-w-none truncate">
                      {h.item_type === 'episode' && h.show_title ? (
                        <>
                          <span className="font-semibold">{h.show_title}</span>
                          <span className="text-ink-500 font-mono ml-2">
                            S{h.season}E{h.episode}
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="font-semibold">{h.title}</span>
                          {h.year && <span className="text-ink-500 ml-2">({h.year})</span>}
                        </>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-xs text-ink-400 hidden md:table-cell">
                      {h.runtime_minutes ? `${h.runtime_minutes} min` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Widget>

        <HubStatus />
      </main>
    </div>
  )
}

function KpiTile({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div className="ga-card p-3 flex flex-col gap-1 min-w-0">
      <div className="flex items-center gap-1.5 text-ink-400">
        {icon}
        <span className="text-[10px] font-semibold uppercase tracking-wider truncate">
          {label}
        </span>
      </div>
      <div className="metric truncate">{value}</div>
    </div>
  )
}
