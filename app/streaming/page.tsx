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

import { useCallback, useState } from 'react'
import useSWR from 'swr'
import { Sidebar } from '@/components/sidebar'
import { Widget } from '@/components/widget'
import { HubStatus } from '@/components/hub-status'
import {
  Tv,
  RefreshCw,
  Film,
  Clock,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  Link2,
} from 'lucide-react'
import { getBaseUrl } from '@/lib/api'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'

interface StreamingStatus {
  connected: boolean
  reason?: string
  expires_at?: string
  is_expired?: boolean
  last_sync_at?: string | null
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
  const [syncing, setSyncing] = useState(false)
  const [typeFilter, setTypeFilter] = useState<'all' | 'movie' | 'episode'>('all')

  const { data: status, mutate: mutateStatus } = useSWR<StreamingStatus>(
    `${base}/v1/streaming/status`,
    fetcher,
  )
  const { data: stats, mutate: mutateStats } = useSWR<StreamingStats>(
    `${base}/v1/streaming/stats`,
    fetcher,
  )
  const historyUrl =
    typeFilter === 'all'
      ? `${base}/v1/streaming/history?limit=50`
      : `${base}/v1/streaming/history?limit=50&item_type=${typeFilter}`
  const { data: history, mutate: mutateHistory } = useSWR<ActivityItem[]>(
    historyUrl,
    fetcher,
  )

  const sync = useCallback(async () => {
    setSyncing(true)
    try {
      const r = await fetch(`${base}/v1/streaming/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Hub-Client': 'web' },
        credentials: 'include',
        body: JSON.stringify({ days_back: 30, max_results: 1000 }),
      })
      if (!r.ok) {
        const data = await r.json().catch(() => ({}))
        throw new Error(data.detail || `HTTP ${r.status}`)
      }
      const data = await r.json().catch(() => null)
      toast.success('Sync Trakt OK', {
        description: data
          ? `${data.activities_ingested ?? 0} ajoutees · ${data.duration_seconds ?? '?'}s`
          : '30 derniers jours',
      })
      mutateStatus()
      mutateStats()
      mutateHistory()
    } catch (err) {
      toast.apiError(err, 'Sync Trakt echoue')
    } finally {
      setSyncing(false)
    }
  }, [base, mutateStatus, mutateStats, mutateHistory])

  const isConnected = status?.connected === true && !status?.is_expired
  const isExpired = status?.connected === true && status?.is_expired === true
  const isDisconnected = status !== undefined && !status?.connected

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
            {isConnected && (
              <>
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold uppercase tracking-wider bg-accent/15 border border-accent/40 text-accent">
                  <CheckCircle2 size={11} /> Connecte
                </span>
                <button
                  type="button"
                  onClick={sync}
                  disabled={syncing}
                  className="px-3 py-2 rounded-md text-xs font-semibold bg-accent/15 border border-accent/40 text-accent hover:bg-accent/25 disabled:opacity-40 inline-flex items-center gap-1.5"
                >
                  <RefreshCw size={11} className={syncing ? 'animate-spin' : ''} />
                  {syncing ? 'Sync…' : 'Sync 30j'}
                </button>
              </>
            )}
            {isExpired && (
              <a
                href={`${base}/v1/streaming/connect`}
                className="px-3 py-2 rounded-md text-xs font-semibold bg-amber-500/15 border border-amber-500/40 text-amber-300 hover:bg-amber-500/25 inline-flex items-center gap-1.5"
              >
                <AlertTriangle size={11} /> Reconnecter Trakt
              </a>
            )}
            {isDisconnected && (
              <a
                href={`${base}/v1/streaming/connect`}
                className="px-3 py-2 rounded-md text-xs font-semibold bg-info/15 border border-info/40 text-info hover:bg-info/25 inline-flex items-center gap-1.5"
              >
                <Link2 size={11} /> Connecter Trakt <ExternalLink size={11} />
              </a>
            )}
          </div>
        </header>

        {/* Etat connecte : badge vert + dernier sync */}
        {isConnected && (
          <div className="panel p-3 flex items-center justify-between flex-wrap gap-3 border-accent/30">
            <div className="flex items-center gap-2 text-xs">
              <CheckCircle2 size={14} className="text-accent" />
              <span className="text-ink-200">Compte Trakt connecte</span>
              {status?.expires_at && (
                <span className="text-ink-500 font-mono">
                  · token valide jusqu&apos;au{' '}
                  {new Date(status.expires_at).toLocaleDateString('fr-CA')}
                </span>
              )}
            </div>
            {status?.last_sync_at && (
              <div className="text-[10px] font-mono text-ink-500">
                Dernier sync : {new Date(status.last_sync_at).toLocaleString('fr-CA')}
              </div>
            )}
          </div>
        )}

        {/* Etat token expire : warning amber */}
        {isExpired && (
          <div className="panel p-3 border-amber-500/40 flex items-start gap-2">
            <AlertTriangle size={14} className="text-amber-400 shrink-0 mt-0.5" />
            <div className="text-xs">
              <p className="text-ink-200 font-semibold mb-1">Token Trakt expire</p>
              <p className="text-ink-400">
                Le refresh token a expire ({status?.reason ?? 'raison inconnue'}). Reconnecte-toi
                en cliquant sur &laquo;&nbsp;Reconnecter Trakt&nbsp;&raquo; en haut, puis relance
                un sync.
              </p>
            </div>
          </div>
        )}

        {/* Etat non connecte : grosse CTA + 3 etapes */}
        {isDisconnected && (
          <div className="panel p-5 space-y-3">
            <div className="flex items-start gap-3">
              <Tv size={28} className="text-accent shrink-0 mt-0.5" />
              <div className="flex-1">
                <h2 className="text-base font-semibold text-ink-100">
                  Connecte ton compte Trakt.tv
                </h2>
                <p className="text-xs text-ink-400 mt-1">
                  Trakt agrege ton historique Netflix, Prime, Disney+, Crunchyroll. Une fois
                  connecte, le hub synchronise tout automatiquement (cron 12h).
                </p>
              </div>
            </div>

            <ol className="text-xs text-ink-300 space-y-2 list-decimal list-inside pl-1">
              <li>
                Cree une app gratuite sur{' '}
                <a
                  href="https://trakt.tv/oauth/applications"
                  target="_blank"
                  rel="noreferrer"
                  className="text-accent hover:underline"
                >
                  trakt.tv/oauth/applications
                </a>{' '}
                (Redirect URI ={' '}
                <code className="font-mono bg-ink-800 px-1 text-[10px]">
                  https://hubperso.com/api/v1/streaming/oauth/callback
                </code>
                )
              </li>
              <li>
                Renseigne <code className="font-mono bg-ink-800 px-1 text-[10px]">TRAKT_CLIENT_ID</code> et{' '}
                <code className="font-mono bg-ink-800 px-1 text-[10px]">TRAKT_CLIENT_SECRET</code>{' '}
                dans <code className="font-mono">hub-core/.env</code>, puis restart uvicorn
              </li>
              <li>Clique le bouton ci-dessous pour autoriser l&apos;acces</li>
            </ol>

            <a
              href={`${base}/v1/streaming/connect`}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-semibold bg-accent/15 border border-accent/40 text-accent hover:bg-accent/25"
            >
              <Link2 size={13} /> Connecter Trakt.tv <ExternalLink size={11} />
            </a>

            {status?.reason && (
              <p className="text-[10px] font-mono text-ink-500">Diag : {status.reason}</p>
            )}
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

        {/* Type filter */}
        {stats && stats.total_activities > 0 && (
          <div className="tabs-scrollable sm:flex-wrap">
            {(['all', 'movie', 'episode'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={cn(
                  'px-3 py-1.5 rounded-md text-xs whitespace-nowrap shrink-0',
                  typeFilter === t
                    ? 'bg-accent/15 border border-accent/40 text-accent'
                    : 'bg-ink-800 border border-ink-700 text-ink-300 hover:border-ink-600',
                )}
              >
                {t === 'all' ? 'Tout' : t === 'movie' ? 'Films seulement' : 'Episodes seulement'}
              </button>
            ))}
          </div>
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
