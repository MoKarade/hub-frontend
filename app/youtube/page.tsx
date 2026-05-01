'use client'

import { Sidebar } from '@/components/sidebar'
import { HubStatus } from '@/components/hub-status'
import {
  Youtube,
  RefreshCw,
  Loader2,
  ExternalLink,
  type LucideIcon,
} from 'lucide-react'
import { useState } from 'react'
import useSWR, { mutate as swrMutate } from 'swr'
import { api, type YTActivityItem, type YTStatsResponse } from '@/lib/api'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'

export default function YoutubePage() {
  const [syncing, setSyncing] = useState(false)
  const { data: activities } = useSWR<YTActivityItem[]>('yt-activities', () =>
    api.youtube.activities({ limit: 100 })
  )
  const { data: stats } = useSWR<YTStatsResponse>('yt-stats', () => api.youtube.stats())

  async function handleSync() {
    setSyncing(true)
    try {
      const res = await api.youtube.sync({ days_back: 90 })
      toast.success(`Sync OK · ${res.activities_ingested} nouveaux, ${res.activities_updated} màj`, {
        description: `${res.duration_seconds}s`,
      })
      void swrMutate('yt-activities')
      void swrMutate('yt-stats')
    } catch (err) {
      toast.apiError(err, 'Sync YouTube échoué')
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 px-4 sm:px-6 lg:px-8 pt-16 lg:pt-6 pb-6 max-w-[1400px] flex flex-col">
        <header className="mb-4 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">YouTube</h1>
            <p className="text-sm text-ink-400">Activité YouTube · 90 derniers jours</p>
          </div>
          <button
            type="button"
            onClick={handleSync}
            disabled={syncing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-accent text-ink-950 text-xs font-semibold hover:bg-accent-light transition-colors disabled:opacity-50"
          >
            {syncing ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
            {syncing ? 'Sync…' : 'Sync YouTube'}
          </button>
        </header>

        {stats && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3">
            <div className="ga-card p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Youtube size={11} className="text-data-negative" />
                <div className="metric-label">Total activités</div>
              </div>
              <div className="metric text-data-negative">{stats.total.toLocaleString('fr-CA')}</div>
            </div>
            <div className="ga-card p-3 sm:col-span-2">
              <div className="metric-label mb-1">Top chaînes</div>
              <div className="flex flex-wrap gap-1">
                {stats.top_channels.slice(0, 6).map((c) => (
                  <span
                    key={c.channel}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] bg-ink-800 border border-ink-700"
                  >
                    <span className="text-ink-200 truncate max-w-[140px]">{c.channel}</span>
                    <span className="font-mono text-[10px] text-ink-500">{c.count}</span>
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="flex-1 min-h-0">
          {activities && activities.length === 0 && (
            <div className="ga-card p-6 text-center">
              <Youtube size={24} className="text-ink-500 mx-auto mb-2" />
              <div className="text-sm text-ink-300">Aucune activité</div>
              <p className="text-xs text-ink-500 mt-1">
                Click &laquo;&nbsp;Sync YouTube&nbsp;&raquo; pour importer
              </p>
            </div>
          )}
          {activities && activities.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {activities.map((a) => (
                <ActivityCard key={a.id} activity={a} />
              ))}
            </div>
          )}
        </div>

        <div className="mt-auto pt-4">
          <HubStatus />
        </div>
      </main>
    </div>
  )
}

function ActivityCard({ activity }: { activity: YTActivityItem }) {
  return (
    <div className="ga-card overflow-hidden">
      {activity.thumbnail_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={activity.thumbnail_url}
          alt=""
          className="w-full aspect-video object-cover"
          onError={(e) => {
            ;(e.target as HTMLImageElement).style.display = 'none'
          }}
        />
      )}
      <div className="p-2.5">
        <div className="flex items-start gap-2">
          <span className="text-[9px] uppercase font-mono bg-data-negative/15 text-data-negative px-1.5 py-0.5 rounded shrink-0">
            {activity.activity_type}
          </span>
          <span className="text-[10px] font-mono text-ink-500 shrink-0">
            {new Date(activity.published_at).toLocaleDateString('fr-CA')}
          </span>
        </div>
        <div className="text-sm text-ink-100 line-clamp-2 mt-1">
          {activity.video_title || '(sans titre)'}
        </div>
        <div className="flex items-center justify-between gap-2 mt-1">
          <span className="text-[11px] text-ink-400 truncate">
            {activity.channel_title || '—'}
          </span>
          {activity.video_id && (
            <a
              href={`https://youtube.com/watch?v=${activity.video_id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-ink-500 hover:text-accent shrink-0"
            >
              <ExternalLink size={10} />
            </a>
          )}
        </div>
      </div>
    </div>
  )
}
