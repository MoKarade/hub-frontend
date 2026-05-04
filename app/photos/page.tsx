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
  Filter,
  X,
  MapPin,
  Grid3X3,
  Map as MapIcon,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import useSWR, { mutate as swrMutate } from 'swr'
import { api, type PhotoItem, type PhotosStatsResponse } from '@/lib/api'

// Dynamic import : Leaflet a besoin de window (SSR off)
const PhotosMap = dynamic(
  () => import('@/components/photos-map').then((m) => m.PhotosMap),
  { ssr: false }
)
import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'

type FilterType = 'all' | 'photos' | 'videos'
type SortField = 'date_desc' | 'date_asc' | 'size_desc'

function thumbUrl(mediaId: string, size = 200): string {
  // Detect runtime base URL (same logic as api.ts)
  if (typeof window === 'undefined') return ''
  const { protocol, hostname, host } = window.location
  const base =
    hostname === 'localhost' || hostname === '127.0.0.1'
      ? 'http://localhost:8000'
      : `${protocol}//${host}/api`
  return `${base}/v1/photos/thumb/${encodeURIComponent(mediaId)}?size=${size}`
}

export default function PhotosPage() {
  const [syncing, setSyncing] = useState(false)
  const [enriching, setEnriching] = useState(false)
  const [view, setView] = useState<'grid' | 'map'>('grid')
  const [filterType, setFilterType] = useState<FilterType>('all')
  const [activeYear, setActiveYear] = useState<string | null>(null)
  const [activeCamera, setActiveCamera] = useState<string | null>(null)
  const [activeLocation, setActiveLocation] = useState<string | null>(null)
  const [onlyGeo, setOnlyGeo] = useState(false)
  const [since, setSince] = useState('')
  const [until, setUntil] = useState('')
  const [sort, setSort] = useState<SortField>('date_desc')
  const [showFilters, setShowFilters] = useState(false)
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null)

  // Annule le polling pickerStatus si l'user quitte la page pendant la sync (10 min max sinon).
  const cancelledRef = useRef(false)
  useEffect(() => {
    cancelledRef.current = false
    return () => {
      cancelledRef.current = true
    }
  }, [])

  const { data: photos } = useSWR<PhotoItem[]>(
    ['photos', filterType, since, until],
    () =>
      api.photos.list({
        is_video:
          filterType === 'videos' ? true : filterType === 'photos' ? false : undefined,
        since: since ? new Date(since).toISOString() : undefined,
        until: until ? new Date(until + 'T23:59:59').toISOString() : undefined,
        limit: 500,
      })
  )
  const { data: stats } = useSWR<PhotosStatsResponse>('photos-stats', () =>
    api.photos.stats()
  )

  // Filter cote front : annee + camera + geo + location + sort
  const visible = useMemo(() => {
    if (!photos) return []
    let list = photos
    if (activeYear) {
      list = list.filter(
        (p) => new Date(p.creation_time).getFullYear().toString() === activeYear
      )
    }
    if (onlyGeo) {
      list = list.filter((p) => p.latitude != null && p.longitude != null)
    }
    if (activeCamera) {
      list = list.filter((p) => p.camera_model === activeCamera)
    }
    if (activeLocation) {
      list = list.filter((p) => p.location_name?.includes(activeLocation))
    }
    // Sort
    const sorted = [...list]
    switch (sort) {
      case 'date_asc':
        sorted.sort((a, b) => +new Date(a.creation_time) - +new Date(b.creation_time))
        break
      case 'size_desc':
        sorted.sort((a, b) => (b.width ?? 0) * (b.height ?? 0) - (a.width ?? 0) * (a.height ?? 0))
        break
      default:
        sorted.sort((a, b) => +new Date(b.creation_time) - +new Date(a.creation_time))
    }
    return sorted
  }, [photos, activeYear, activeCamera, activeLocation, onlyGeo, sort])

  async function handleSync() {
    // Picker API : ouvre la fenetre Google Picker
    setSyncing(true)
    try {
      const session = await api.photos.pickerStart()
      const a = document.createElement('a')
      a.href = session.picker_uri
      a.target = '_blank'
      a.rel = 'noopener noreferrer'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      toast.success('Picker ouvert', {
        description: 'Sélectionne tes photos puis click "Done". On polle ici.',
      })

      let done = false
      const startTime = Date.now()
      while (!done && Date.now() - startTime < 600_000) {
        await new Promise((res) => setTimeout(res, 3000))
        if (cancelledRef.current) return
        try {
          const status = await api.photos.pickerStatus(session.session_id)
          if (cancelledRef.current) return
          if (status.media_items_set) {
            done = true
            break
          }
        } catch {
          break
        }
      }

      if (!done) {
        toast.error('Pas de sélection après 10 min')
        setSyncing(false)
        return
      }

      if (cancelledRef.current) return
      const res = await api.photos.pickerImport(session.session_id)
      toast.success(`Import OK · ${res.ingested} nouvelles, ${res.updated} màj`, {
        description: `${res.duration_seconds}s`,
      })
      void swrMutate(['photos', filterType, since, until])
      void swrMutate('photos-stats')
    } catch (err) {
      toast.apiError(err, 'Sync Photos échoué')
    } finally {
      setSyncing(false)
    }
  }

  async function handleEnrichGps() {
    setEnriching(true)
    try {
      const res = await api.photos.enrichGps({ max_photos: 100, do_geocode: true })
      if (res.processed > 0 && res.with_gps === 0) {
        toast.error(
          `0 GPS trouvé sur ${res.processed} photos`,
          {
            description:
              "Limitation Google : Picker API retire les GPS de l'EXIF (privacy). Pas de workaround coté hub.",
            duration: 10000,
          }
        )
      } else {
        toast.success(
          `Enrichissement OK · ${res.with_gps}/${res.processed} avec GPS · ${res.geocoded} géocodés`,
          { description: `${res.duration_seconds}s` }
        )
      }
      void swrMutate(['photos', filterType, since, until])
    } catch (err) {
      toast.apiError(err, 'Enrichissement GPS échoué')
    } finally {
      setEnriching(false)
    }
  }

  function clearFilters() {
    setFilterType('all')
    setActiveYear(null)
    setActiveCamera(null)
    setActiveLocation(null)
    setOnlyGeo(false)
    setSince('')
    setUntil('')
  }

  const activeFilterCount = [
    filterType !== 'all',
    activeYear,
    activeCamera,
    activeLocation,
    onlyGeo,
    since,
    until,
  ].filter(Boolean).length

  // Locations agregees depuis les photos chargees (top niveau : pays / region / ville)
  const locationOptions = useMemo(() => {
    if (!photos) return [] as { name: string; count: number }[]
    const counts = new Map<string, number>()
    for (const p of photos) {
      if (!p.location_name) continue
      // Decompose "Lévis, QC, Canada" en composants
      for (const part of p.location_name.split(',').map((s) => s.trim())) {
        if (part) counts.set(part, (counts.get(part) ?? 0) + 1)
      }
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([name, count]) => ({ name, count }))
  }, [photos])

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 px-4 sm:px-6 lg:px-8 pt-16 lg:pt-6 pb-6 max-w-[1400px] flex flex-col">
        <header className="mb-3 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Photos</h1>
            <p className="text-xs text-ink-400">
              {stats
                ? `${stats.total} médias · ${stats.photos} photos · ${stats.videos} vidéos`
                : '…'}
            </p>
          </div>
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={handleSync}
              disabled={syncing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-accent text-ink-950 text-xs font-semibold hover:bg-accent-light transition-colors disabled:opacity-50"
            >
              {syncing ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
              {syncing ? 'Picker…' : 'Picker Photos'}
            </button>
            <button
              type="button"
              onClick={handleEnrichGps}
              disabled={enriching}
              title="Télécharge les bytes des photos sans GPS + extrait l'EXIF + reverse geocode (lent : ~1s/photo)"
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-ink-800 border border-ink-700 hover:border-info/40 hover:text-info text-xs disabled:opacity-50"
            >
              {enriching ? (
                <Loader2 size={11} className="animate-spin" />
              ) : (
                <MapPin size={11} />
              )}
              {enriching ? 'Enrich…' : 'Enrichir GPS'}
            </button>
          </div>
        </header>

        {/* View toggle Grid / Carte + Type filter */}
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <div className="flex">
            <button
              type="button"
              onClick={() => setView('grid')}
              className={cn(
                'px-2.5 py-1 text-xs border-y border-l border-ink-700 rounded-l inline-flex items-center gap-1',
                view === 'grid'
                  ? 'bg-accent/15 border-accent/30 text-accent'
                  : 'bg-ink-800 text-ink-300'
              )}
            >
              <Grid3X3 size={11} />
              Grille
            </button>
            <button
              type="button"
              onClick={() => setView('map')}
              className={cn(
                'px-2.5 py-1 text-xs border border-ink-700 rounded-r inline-flex items-center gap-1',
                view === 'map'
                  ? 'bg-accent/15 border-accent/30 text-accent'
                  : 'bg-ink-800 text-ink-300'
              )}
            >
              <MapIcon size={11} />
              Carte
            </button>
          </div>

          <button
            type="button"
            onClick={() => setOnlyGeo((v) => !v)}
            className={cn(
              'inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] border',
              onlyGeo
                ? 'bg-info/15 border-info/30 text-info'
                : 'bg-ink-800 border-ink-700 text-ink-400'
            )}
          >
            <MapPin size={10} /> Avec GPS
          </button>

          <div className="flex">
            {(['all', 'photos', 'videos'] as FilterType[]).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilterType(f)}
                className={cn(
                  'px-2.5 py-1 text-xs border-y border-ink-700 first:border-l first:rounded-l last:border-r last:rounded-r',
                  filterType === f
                    ? 'bg-accent/15 border-accent/30 text-accent'
                    : 'bg-ink-800 text-ink-300'
                )}
              >
                {f === 'all' ? 'Tous' : f === 'photos' ? 'Photos' : 'Vidéos'}
              </button>
            ))}
          </div>

          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortField)}
            className="bg-ink-800 border border-ink-700 rounded-md px-2 py-1 text-xs"
          >
            <option value="date_desc">Date ↓</option>
            <option value="date_asc">Date ↑</option>
            <option value="size_desc">Plus grandes</option>
          </select>

          <button
            type="button"
            onClick={() => setShowFilters((v) => !v)}
            className={cn(
              'inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs border',
              showFilters || activeFilterCount > 0
                ? 'bg-accent/15 border-accent/30 text-accent'
                : 'bg-ink-800 border-ink-700 text-ink-300'
            )}
          >
            <Filter size={11} />
            Filtres {activeFilterCount > 0 && `(${activeFilterCount})`}
          </button>

          <div className="flex-1" />
          <span className="text-[10px] font-mono text-ink-500">
            {visible.length} affichées
          </span>
        </div>

        {/* Filter panel */}
        {showFilters && (
          <div className="ga-card p-3 mb-3 space-y-2">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div>
                <label className="text-[10px] uppercase tracking-wider text-ink-500 mb-1 block">
                  Depuis
                </label>
                <input
                  type="date"
                  value={since}
                  onChange={(e) => setSince(e.target.value)}
                  className="w-full bg-ink-800 border border-ink-700 rounded px-1.5 py-1 text-xs"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-ink-500 mb-1 block">
                  Jusqu&apos;à
                </label>
                <input
                  type="date"
                  value={until}
                  onChange={(e) => setUntil(e.target.value)}
                  className="w-full bg-ink-800 border border-ink-700 rounded px-1.5 py-1 text-xs"
                />
              </div>
              {activeFilterCount > 0 && (
                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="px-2 py-1 text-[11px] text-ink-400 hover:text-data-negative"
                  >
                    Effacer tout
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* KPIs */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
            <Kpi label="Total" value={stats.total} icon={ImageIcon} color="text-ink-100" />
            <Kpi label="Photos" value={stats.photos} icon={ImageIcon} color="text-info" />
            <Kpi label="Vidéos" value={stats.videos} icon={Video} color="text-warn" />
            <Kpi
              label="MPx totaux"
              value={Math.round(stats.total_pixels / 1_000_000)}
              icon={Camera}
              color="text-accent"
            />
          </div>
        )}

        {/* Filter par année */}
        {stats && stats.by_year.length > 0 && (
          <div className="ga-card p-2 mb-3">
            <div className="flex flex-wrap gap-1">
              <button
                type="button"
                onClick={() => setActiveYear(null)}
                className={cn(
                  'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] border',
                  !activeYear
                    ? 'bg-accent/15 border-accent/30 text-accent'
                    : 'bg-ink-800 border-ink-700 text-ink-400'
                )}
              >
                Toutes années
              </button>
              {stats.by_year.map((y) => (
                <button
                  key={y.year}
                  type="button"
                  onClick={() => setActiveYear(y.year === activeYear ? null : y.year)}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] border',
                    activeYear === y.year
                      ? 'bg-accent/15 border-accent/30 text-accent'
                      : 'bg-ink-800 border-ink-700 text-ink-300 hover:text-ink-100'
                  )}
                >
                  <span>{y.year}</span>
                  <span className="font-mono text-[10px] text-ink-500">{y.count}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Filter par localisation (depuis location_name geocode) */}
        {locationOptions.length > 0 && (
          <div className="ga-card p-2 mb-3">
            <div className="flex flex-wrap gap-1 items-center">
              <span className="text-[10px] uppercase tracking-wider text-ink-500 mr-1">
                <MapPin size={9} className="inline" /> Lieux :
              </span>
              {locationOptions.map((loc) => (
                <button
                  key={loc.name}
                  type="button"
                  onClick={() =>
                    setActiveLocation(loc.name === activeLocation ? null : loc.name)
                  }
                  className={cn(
                    'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] border',
                    activeLocation === loc.name
                      ? 'bg-info/15 border-info/30 text-info'
                      : 'bg-ink-800 border-ink-700 text-ink-300 hover:text-ink-100'
                  )}
                >
                  {loc.name}
                  <span className="font-mono text-[10px] text-ink-500">{loc.count}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Top caméras */}
        {stats && stats.by_camera.length > 0 && (
          <div className="ga-card p-2 mb-3">
            <div className="flex flex-wrap gap-1 items-center">
              <span className="text-[10px] uppercase tracking-wider text-ink-500 mr-1">
                Caméras :
              </span>
              {stats.by_camera.slice(0, 6).map((c) => (
                <span
                  key={c.camera}
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-ink-800 border border-ink-700"
                >
                  <Camera size={9} className="text-ink-500" />
                  <span className="text-ink-300">{c.camera}</span>
                  <span className="font-mono text-ink-500">{c.count}</span>
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="flex-1 min-h-0">
          {visible.length === 0 ? (
            <div className="ga-card p-8 text-center">
              <ImageIcon size={28} className="text-ink-600 mx-auto mb-2" />
              <div className="text-sm text-ink-400">Aucune photo</div>
              <p className="text-xs text-ink-500 mt-1">
                {photos && photos.length === 0
                  ? 'Click "Picker Photos" pour importer ta sélection'
                  : 'Aucun match avec ces filtres'}
              </p>
            </div>
          ) : view === 'map' ? (
            <PhotosMap photos={visible} thumbUrl={thumbUrl} />
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-1">
              {visible.map((p, idx) => (
                <PhotoCard key={p.id} photo={p} onClick={() => setLightboxIdx(idx)} />
              ))}
            </div>
          )}
        </div>

        {/* Lightbox modal */}
        {lightboxIdx !== null && visible[lightboxIdx] && (
          <Lightbox
            photos={visible}
            index={lightboxIdx}
            onClose={() => setLightboxIdx(null)}
            onNavigate={setLightboxIdx}
          />
        )}

        <div className="mt-3">
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
}: {
  label: string
  value: number
  icon: typeof ImageIcon
  color: string
}) {
  return (
    <div className="ga-card p-3">
      <div className="flex items-center gap-1.5 mb-1">
        <Icon size={11} className={color} />
        <div className="metric-label">{label}</div>
      </div>
      <div className={cn('metric truncate', color)}>{value.toLocaleString('fr-CA')}</div>
    </div>
  )
}

function PhotoCard({ photo, onClick }: { photo: PhotoItem; onClick: () => void }) {
  // Use proxy backend pour le thumbnail (Picker baseUrl requiert auth)
  const thumb = thumbUrl(photo.media_id, 200)
  const [errored, setErrored] = useState(false)
  const subtitle = photo.location_name ?? new Date(photo.creation_time).toLocaleDateString('fr-CA')
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative group aspect-square bg-ink-800 rounded overflow-hidden hover:ring-1 hover:ring-accent transition cursor-zoom-in"
      title={`${photo.filename ?? '(sans nom)'} · ${subtitle}`}
    >
      {!errored ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={thumb}
          alt={photo.filename ?? ''}
          loading="lazy"
          className="w-full h-full object-cover"
          onError={() => setErrored(true)}
        />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center text-ink-500 p-1">
          <ImageIcon size={20} className="mb-1" />
          <div className="text-[8px] font-mono text-center truncate w-full">
            {photo.filename ?? 'load fail'}
          </div>
        </div>
      )}
      {photo.is_video && (
        <div className="absolute top-1 right-1 bg-ink-950/70 rounded p-0.5">
          <Video size={11} className="text-warn" />
        </div>
      )}
      {photo.latitude != null && (
        <div className="absolute top-1 left-1 bg-ink-950/70 rounded p-0.5" title={photo.location_name ?? ''}>
          <MapPin size={10} className="text-info" />
        </div>
      )}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-ink-950/90 to-transparent p-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="text-[9px] font-mono text-ink-200 truncate">{subtitle}</div>
      </div>
    </button>
  )
}

// ============================================================================
// Lightbox modal (preview taille reelle + navigation prev/next)
// ============================================================================

function Lightbox({
  photos,
  index,
  onClose,
  onNavigate,
}: {
  photos: PhotoItem[]
  index: number
  onClose: () => void
  onNavigate: (i: number) => void
}) {
  const photo = photos[index]

  // Keyboard navigation : Escape ferme, fleches naviguent
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowLeft' && index > 0) onNavigate(index - 1)
      else if (e.key === 'ArrowRight' && index < photos.length - 1) onNavigate(index + 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [index, photos.length, onClose, onNavigate])

  // Guard : si SWR shrink le tableau pendant que la lightbox est ouverte
  // (ex: filtre changé en arrière-plan), photos[index] devient undefined → crash.
  if (!photo) return null

  // Image full-size via proxy thumbnail size 1200 (vs 200 pour grid)
  const fullUrl = thumbUrl(photo.media_id, 1200)

  return (
    <div
      className="fixed inset-0 z-50 bg-ink-950/95 backdrop-blur flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Close */}
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center rounded-full bg-ink-900/80 hover:bg-ink-800 text-ink-200 z-10"
        aria-label="Fermer"
      >
        <X size={18} />
      </button>

      {/* Prev */}
      {index > 0 && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onNavigate(index - 1)
          }}
          className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center rounded-full bg-ink-900/80 hover:bg-ink-800 text-ink-200"
          aria-label="Précédente"
        >
          ‹
        </button>
      )}

      {/* Next */}
      {index < photos.length - 1 && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onNavigate(index + 1)
          }}
          className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center rounded-full bg-ink-900/80 hover:bg-ink-800 text-ink-200"
          aria-label="Suivante"
        >
          ›
        </button>
      )}

      {/* Image */}
      <div
        className="relative max-w-[90vw] max-h-[85vh] flex flex-col items-center"
        onClick={(e) => e.stopPropagation()}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={fullUrl}
          alt={photo.filename ?? ''}
          className="max-w-full max-h-[80vh] object-contain rounded"
        />
        {/* Footer avec metadata */}
        <div className="mt-3 text-center text-[12px] text-ink-300 max-w-full">
          <div className="font-medium">{photo.filename ?? '(sans nom)'}</div>
          <div className="text-ink-500 font-mono text-[11px] flex items-center justify-center gap-3 flex-wrap mt-1">
            <span>{new Date(photo.creation_time).toLocaleString('fr-CA')}</span>
            {photo.location_name && (
              <span className="inline-flex items-center gap-1">
                <MapPin size={10} className="text-info" />
                {photo.location_name}
              </span>
            )}
            {photo.camera_model && (
              <span className="inline-flex items-center gap-1">
                <Camera size={10} />
                {photo.camera_model}
              </span>
            )}
            {photo.width && photo.height && (
              <span>
                {photo.width} × {photo.height}
              </span>
            )}
            <span className="text-[10px] font-mono text-ink-600">
              {index + 1} / {photos.length}
            </span>
          </div>
          {photo.product_url && (
            <a
              href={photo.product_url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 mt-2 text-[11px] text-accent hover:text-accent-light"
            >
              Ouvrir dans Google Photos <ExternalLink size={10} />
            </a>
          )}
        </div>
      </div>
    </div>
  )
}
