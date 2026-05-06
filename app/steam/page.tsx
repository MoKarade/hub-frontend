'use client'

/**
 * /steam — Gaming hub via Steam Web API.
 *
 * Marc setup :
 *  1. https://steamcommunity.com/dev/apikey -> API key gratuite
 *  2. https://steamid.io/ -> SteamID64
 *  3. Renseigne STEAM_API_KEY + STEAM_USER_ID dans hub-core/.env
 *  4. Click "Sync" ou attends le cron 6h
 */

import { useCallback, useState } from 'react'
import useSWR from 'swr'
import {
  Gamepad2,
  RefreshCw,
  Loader2,
  AlertTriangle,
  Clock,
  Trophy,
} from 'lucide-react'
import { Sidebar } from '@/components/sidebar'
import { Widget } from '@/components/widget'
import { HubStatus } from '@/components/hub-status'
import { getBaseUrl } from '@/lib/api'

interface SteamGame {
  id: string
  appid: number
  name: string
  icon_url: string | null
  playtime_forever_min: number
  playtime_2weeks_min: number
  last_played_at: string | null
}

interface SteamStats {
  total_games: number
  total_playtime_hours: number
  games_played_2w: number
  top_games: {
    appid: number
    name: string
    playtime_min: number
    playtime_2weeks_min: number
    icon_url: string | null
  }[]
  last_played: {
    appid: number
    name: string
    last_played_at: string
    icon_url: string | null
  } | null
}

interface SessionDelta {
  appid: number
  name: string
  started_around: string
  ended_around: string
  duration_min: number
}

interface SteamStatus {
  configured: boolean
  games_in_db: number
  snapshots_in_db: number
}

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export default function SteamPage() {
  const base = getBaseUrl()
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { data: status, mutate: mutateStatus } = useSWR<SteamStatus>(
    `${base}/v1/steam/status`,
    fetcher,
  )
  const { data: stats, mutate: mutateStats } = useSWR<SteamStats>(
    `${base}/v1/steam/stats`,
    fetcher,
  )
  const { data: games, mutate: mutateGames } = useSWR<SteamGame[]>(
    `${base}/v1/steam/games?only_played=true&limit=50`,
    fetcher,
  )
  const { data: sessions } = useSWR<SessionDelta[]>(
    `${base}/v1/steam/sessions?since_days=30&limit=20`,
    fetcher,
  )

  const sync = useCallback(async () => {
    setSyncing(true)
    setError(null)
    try {
      const r = await fetch(`${base}/v1/steam/sync`, { method: 'POST' })
      if (!r.ok) {
        const data = await r.json().catch(() => ({}))
        throw new Error(data.detail || `HTTP ${r.status}`)
      }
      mutateStatus()
      mutateStats()
      mutateGames()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSyncing(false)
    }
  }, [base, mutateStatus, mutateStats, mutateGames])

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 px-4 sm:px-6 lg:px-8 pt-16 lg:pt-6 pb-6 max-w-[1400px] space-y-4">
        <header className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
              <Gamepad2 size={20} className="text-accent" />
              Steam
            </h1>
            <p className="text-xs text-ink-400 mt-0.5">
              Bibliothèque + temps de jeu via Steam Web API
            </p>
          </div>
          <button
            onClick={sync}
            disabled={syncing || !status?.configured}
            className="px-3 py-2 rounded-md text-xs font-semibold bg-accent/15 border border-accent/40 text-accent hover:bg-accent/25 disabled:opacity-40 inline-flex items-center gap-1.5"
          >
            {syncing ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
            {syncing ? 'Sync…' : 'Sync now'}
          </button>
        </header>

        {/* Setup instructions if not configured */}
        {status && !status.configured && (
          <div className="panel p-4 border-amber-500/40 flex items-start gap-3">
            <AlertTriangle size={16} className="text-amber-400 shrink-0 mt-0.5" />
            <div className="text-xs">
              <p className="text-ink-200 font-semibold mb-2">Steam non configuré</p>
              <ol className="text-ink-400 space-y-1 list-decimal list-inside">
                <li>
                  Crée une API key gratuite sur{' '}
                  <a
                    href="https://steamcommunity.com/dev/apikey"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent hover:underline"
                  >
                    steamcommunity.com/dev/apikey
                  </a>
                </li>
                <li>
                  Trouve ton SteamID64 sur{' '}
                  <a
                    href="https://steamid.io/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent hover:underline"
                  >
                    steamid.io
                  </a>
                </li>
                <li>
                  Renseigne <code className="font-mono bg-ink-800 px-1">STEAM_API_KEY</code> et{' '}
                  <code className="font-mono bg-ink-800 px-1">STEAM_USER_ID</code> dans hub-core/.env
                </li>
                <li>Restart uvicorn + click Sync</li>
              </ol>
              <p className="text-ink-500 mt-2 text-[10px]">
                Note : ton profil Steam doit être public (Edit Profile → Game Details = Public).
              </p>
            </div>
          </div>
        )}

        {error && (
          <div className="panel p-3 text-xs text-red-400 font-mono">{error}</div>
        )}

        {/* KPI strip */}
        {stats && stats.total_games > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
            <KpiTile label="Jeux possédés" value={String(stats.total_games)} />
            <KpiTile label="Total" value={`${stats.total_playtime_hours.toLocaleString('fr-CA')}h`} />
            <KpiTile label="Joués 2 sem." value={String(stats.games_played_2w)} />
            <KpiTile
              label="Dernier"
              value={stats.last_played?.name?.slice(0, 14) ?? '—'}
            />
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {/* Top games */}
          {stats && stats.top_games.length > 0 && (
            <Widget id="top-games" title="Top par temps de jeu" icon={Trophy}>
              <ul className="space-y-2 text-xs">
                {stats.top_games.map((g, i) => (
                  <li key={g.appid} className="flex items-center gap-2">
                    <span className="font-mono text-ink-500 w-5 text-right shrink-0">
                      {i + 1}.
                    </span>
                    {g.icon_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={g.icon_url}
                        alt=""
                        className="w-8 h-8 rounded shrink-0"
                        loading="lazy"
                      />
                    )}
                    <span className="flex-1 truncate text-ink-200">{g.name}</span>
                    <span className="font-mono text-ink-400 text-[10px] shrink-0">
                      {Math.round(g.playtime_min / 60)}h
                    </span>
                  </li>
                ))}
              </ul>
            </Widget>
          )}

          {/* Sessions deduites */}
          {sessions && sessions.length > 0 && (
            <Widget id="sessions" title="Sessions récentes (30j)" icon={Clock}>
              <ul className="space-y-1.5 text-xs">
                {sessions.slice(0, 12).map((s, i) => (
                  <li key={i} className="flex items-center gap-2 px-1 py-1">
                    <span className="flex-1 truncate text-ink-200">{s.name}</span>
                    <span className="text-[10px] font-mono text-ink-500 shrink-0">
                      {new Date(s.ended_around).toLocaleDateString('fr-CA')}
                    </span>
                    <span className="font-mono text-accent text-[10px] shrink-0 w-12 text-right">
                      {s.duration_min} min
                    </span>
                  </li>
                ))}
              </ul>
            </Widget>
          )}
        </div>

        {/* Library */}
        <Widget id="library" title="Bibliothèque" icon={Gamepad2} noPadding>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[480px]">
              <thead className="bg-ink-800/40 text-[11px] uppercase tracking-wider text-ink-400">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">Jeu</th>
                  <th className="text-right px-3 py-2 font-medium hidden md:table-cell">Total</th>
                  <th className="text-right px-3 py-2 font-medium">2 sem.</th>
                  <th className="text-right px-3 py-2 font-medium hidden lg:table-cell">
                    Dernière session
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-800/60">
                {!games && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-ink-400">
                      Chargement…
                    </td>
                  </tr>
                )}
                {games && games.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-ink-400">
                      Aucun jeu joué encore. Lance un sync.
                    </td>
                  </tr>
                )}
                {games?.map((g) => (
                  <tr key={g.id} className="hover:bg-ink-800/30 transition-colors">
                    <td className="px-3 py-2 max-w-[260px] sm:max-w-none">
                      <div className="flex items-center gap-2">
                        {g.icon_url && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={g.icon_url}
                            alt=""
                            className="w-6 h-6 rounded shrink-0"
                            loading="lazy"
                          />
                        )}
                        <span className="truncate font-semibold">{g.name}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-xs hidden md:table-cell whitespace-nowrap">
                      {Math.round(g.playtime_forever_min / 60)}h
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-xs whitespace-nowrap">
                      {g.playtime_2weeks_min > 0 ? (
                        <span className="text-accent">{g.playtime_2weeks_min} min</span>
                      ) : (
                        <span className="text-ink-500">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-xs text-ink-400 hidden lg:table-cell whitespace-nowrap">
                      {g.last_played_at
                        ? new Date(g.last_played_at).toLocaleDateString('fr-CA')
                        : '—'}
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

function KpiTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="ga-card p-3 flex flex-col gap-1 min-w-0">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-ink-400 truncate">
        {label}
      </div>
      <div className="metric truncate">{value}</div>
    </div>
  )
}
