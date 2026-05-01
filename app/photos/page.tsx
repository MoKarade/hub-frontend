'use client'

import { Sidebar } from '@/components/sidebar'
import { HubStatus } from '@/components/hub-status'
import {
  Image as ImageIcon,
  Video,
  RefreshCw,
  Loader2,
  Camera,
  ExternalLink,
} from 'lucide-react'
import { useState } from 'react'
import useSWR, { mutate as swrMutate } from 'swr'
import { api, type PhotoItem, type PhotosStatsResponse } from '@/lib/api'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'

export default function PhotosPage() {
  const [syncing, setSyncing] = useState(false)
  const { data: photos } = useSWR<PhotoItem[]>('photos', () =>
    api.photos.list({ limit: 60 })
  )
  const { data: stats } = useSWR<PhotosStatsResponse>('photos-stats', () =>
    api.photos.stats()
  )

  async function handleSync() {
    setSyncing(true)
    try {
      const res = await api.photos.sync({ max_results: 2000 })
      toast.success(
        `Sync OK · ${res.ingested} nouvelles, ${res.updated} màj`,
        { description: `${res.duration_seconds}s` }
      )
      void swrMutate('photos')
      void swrMutate('photos-stats')
    } catch (err) {
      toast.apiError(err, 'Sync Photos échoué')
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
            <h1 className="text-2xl font-semibold tracking-tight">Photos</h1>
            <p className="text-sm text-ink-400">
              Métadonnées Google Photos · recherche sémantique = phase 3c+ avec CLIP
            </p>
          </div>
          <button
            type="button"
            onClick={handleSync}
            disabled={syncing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-accent text-ink-950 text-xs font-semibold hover:bg-accent-light transition-colors disabled:opacity-50"
          >
            {syncing ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
            {syncing ? 'Sync…' : 'Sync Photos'}
          </button>
        </header>

        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
            <Kpi label="Total" value={stats.total} icon={ImageIcon} color="text-ink-100" />
            <Kpi label="Photos" value={stats.photos} icon={ImageIcon} color="text-info" />
            <Kpi label="Vidéos" value={stats.videos} icon={Video} color="text-warn" />
            <Kpi
              label="Pixels totaux"
              value={Math.round(stats.total_pixels / 1_000_000)}
              icon={Camera}
              color="text-accent"
              suffix="M"
            />
          </div>
        )}

        {stats && stats.by_year.length > 0 && (
          <div className="ga-card p-3 mb-3">
            <div className="text-xs font-semibold text-ink-200 mb-2">Par année</div>
            <div className="flex flex-wrap gap-1.5">
              {stats.by_year.map((y) => (
                <div
                  key={y.year}
                  className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] bg-ink-800 border border-ink-700"
                >
                  <span className="text-ink-100">{y.year}</span>
                  <span className="font-mono text-[10px] text-ink-500">
                    {y.count.toLocaleString('fr-CA')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex-1 min-h-0">
          {photos && photos.length === 0 && (
            <div className="ga-card p-6 text-center">
              <ImageIcon size={24} className="text-ink-500 mx-auto mb-2" />
              <div className="text-sm text-ink-300">Aucune photo</div>
              <p className="text-xs text-ink-500 mt-1">
                Click &laquo;&nbsp;Sync Photos&nbsp;&raquo; pour importer
              </p>
            </div>
          )}
          {photos && photos.length > 0 && (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-1">
              {photos.map((p) => (
                <PhotoCard key={p.id} photo={p} />
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

function Kpi({
  label,
  value,
  icon: Icon,
  color,
  suffix,
}: {
  label: string
  value: number
  icon: typeof ImageIcon
  color: string
  suffix?: string
}) {
  return (
    <div className="ga-card p-3">
      <div className="flex items-center gap-1.5 mb-1">
        <Icon size={11} className={color} />
        <div className="metric-label">{label}</div>
      </div>
      <div className={cn('metric truncate', color)}>
        {value.toLocaleString('fr-CA')}
        {suffix && <span className="text-xs ml-0.5">{suffix}</span>}
      </div>
    </div>
  )
}

function PhotoCard({ photo }: { photo: PhotoItem }) {
  // baseUrl Photos expire ~60min : on suffix =w200-h200-c pour thumbnail
  const thumbUrl = photo.base_url ? `${photo.base_url}=w200-h200-c` : null
  return (
    <a
      href={photo.product_url ?? '#'}
      target="_blank"
      rel="noopener noreferrer"
      className="relative group aspect-square bg-ink-800 rounded overflow-hidden hover:ring-1 hover:ring-accent transition"
    >
      {thumbUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={thumbUrl}
          alt={photo.filename ?? ''}
          loading="lazy"
          className="w-full h-full object-cover"
          onError={(e) => {
            ;(e.target as HTMLImageElement).style.display = 'none'
          }}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-ink-600">
          <ImageIcon size={20} />
        </div>
      )}
      {photo.is_video && (
        <div className="absolute top-1 right-1 bg-ink-950/70 rounded p-0.5">
          <Video size={11} className="text-warn" />
        </div>
      )}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-ink-950/90 to-transparent p-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="text-[9px] font-mono text-ink-200 truncate">
          {new Date(photo.creation_time).toLocaleDateString('fr-CA')}
        </div>
      </div>
      <div className="absolute top-1 left-1 opacity-0 group-hover:opacity-100">
        <ExternalLink size={10} className="text-ink-200" />
      </div>
    </a>
  )
}
