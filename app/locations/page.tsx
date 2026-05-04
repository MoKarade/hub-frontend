'use client'

import { Sidebar } from '@/components/sidebar'
import { HubStatus } from '@/components/hub-status'
import { Tabs, useActiveTab, type TabItem } from '@/components/tabs'
import {
  MapPin, Home, Briefcase, Navigation, Car, Train, Footprints, Plane, Bike,
  Map as MapIcon, Globe, Calendar, TrendingUp, RefreshCw, Upload, Layers,
  Sparkles, Settings, CheckCircle, Clock, Ruler, BarChart3, Compass, Flame,
  Zap, Activity,
} from 'lucide-react'
import dynamic from 'next/dynamic'
import { useRouter, useSearchParams } from 'next/navigation'
import { useMemo, useState, useCallback, type ComponentType } from 'react'
import useSWR, { mutate } from 'swr'
import { api, type LocationVisit, type LocationStats } from '@/lib/api'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'
import { ClickPopup } from '@/components/locations/click-popup'
import { JourneeTab } from '@/components/locations/journee-tab'
import { VoyagesTab } from '@/components/locations/voyages-tab'
import type { MapMode } from '@/components/location-map'

const LocationMap = dynamic(
  () => import('@/components/location-map').then(m => ({ default: m.LocationMap })),
  { ssr: false, loading: () => <div className="h-full w-full flex items-center justify-center text-ink-400 text-sm font-mono">Chargement de la carte…</div> }
)

// ─── Constantes ───────────────────────────────────────────────────────────────

const TABS: TabItem[] = [
  { id: 'carte',   label: 'Carte GPS', icon: MapIcon    },
  { id: 'journee', label: 'Journée',   icon: Calendar   },
  { id: 'visites', label: 'Visites',   icon: MapPin     },
  { id: 'voyages', label: 'Voyages',   icon: Compass    },
  { id: 'stats',   label: 'Stats',     icon: TrendingUp },
  { id: 'lieux',   label: 'Mes Lieux', icon: Home       },
]

const SEMANTIC_META: Record<string, { label: string; icon: ComponentType<{ size?: number; className?: string }>; hex: string }> = {
  HOME:              { label: 'Domicile',       icon: Home,       hex: '#5cdb95' },
  INFERRED_HOME:     { label: 'Domicile (inf)', icon: Home,       hex: '#3db37a' },
  WORK:              { label: 'Travail',        icon: Briefcase,  hex: '#5fb3f4' },
  INFERRED_WORK:     { label: 'Travail (inf)',  icon: Briefcase,  hex: '#3a8fd6' },
  SEARCHED_ADDRESS:  { label: 'Adresse',        icon: Navigation, hex: '#ffb84d' },
  ALIASED_LOCATION:  { label: 'Favori',         icon: Sparkles,   hex: '#c084fc' },
  UNKNOWN:           { label: 'Lieu inconnu',   icon: MapPin,     hex: '#8b95a3' },
}

const ACTIVITY_ICONS: Record<string, { icon: ComponentType<{ size?: number; className?: string }>; label: string; hex: string }> = {
  IN_PASSENGER_VEHICLE: { icon: Car,        label: 'Voiture',  hex: '#ffb84d' },
  WALKING:              { icon: Footprints, label: 'Marche',   hex: '#5cdb95' },
  FLYING:               { icon: Plane,      label: 'Avion',    hex: '#5fb3f4' },
  IN_TRAIN:             { icon: Train,      label: 'Train',    hex: '#c084fc' },
  IN_SUBWAY:            { icon: Train,      label: 'Métro',    hex: '#a78bfa' },
  IN_BUS:               { icon: Car,        label: 'Bus',      hex: '#fb923c' },
  CYCLING:              { icon: Bike,       label: 'Vélo',     hex: '#34d399' },
  IN_VEHICLE:           { icon: Car,        label: 'Véhicule', hex: '#fbbf24' },
  RUNNING:              { icon: Footprints, label: 'Course',   hex: '#86efac' },
  SKIING:               { icon: Footprints, label: 'Ski',      hex: '#e0f2fe' },
  UNKNOWN_ACTIVITY_TYPE:{ icon: Navigation, label: 'Inconnu',  hex: '#6b7280' },
}

function getSemanticMeta(type: string | null) {
  return SEMANTIC_META[type ?? 'UNKNOWN'] ?? SEMANTIC_META.UNKNOWN
}

// ─── Page principale ──────────────────────────────────────────────────────────

export default function LocationsPage() {
  const activeTab = useActiveTab(TABS, 'tab', 'carte')
  const { data: stats } = useSWR('locations-stats', () => api.locations.stats())
  const router = useRouter()
  const searchParams = useSearchParams()
  const dateParam = searchParams.get('date')

  const navigateToDay = useCallback((date: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', 'journee')
    params.set('date', date)
    router.push(`/locations?${params.toString()}`)
  }, [router, searchParams])

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 px-4 sm:px-6 lg:px-8 pt-16 lg:pt-6 pb-6 max-w-[1500px] flex flex-col gap-4">
        <header className="flex items-end justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
              <Globe size={22} className="text-accent" />
              Localisation
            </h1>
            <p className="text-sm text-ink-400 mt-0.5 font-mono">
              Google Maps Timeline · {stats?.earliest_date?.slice(0, 4) ?? '…'} → {stats?.latest_date?.slice(0, 4) ?? '…'}
            </p>
          </div>
          <IngestButton />
        </header>

        <GlobalStatsStrip stats={stats ?? null} />
        <Tabs items={TABS} defaultId="carte" />

        {activeTab === 'carte'   && <CarteTab latestDate={stats?.latest_date ?? null} />}
        {activeTab === 'journee' && <JourneeTab initialDate={dateParam ?? undefined} defaultDate={stats?.latest_date ?? new Date().toISOString().slice(0, 10)} />}
        {activeTab === 'visites' && <VisitesTab />}
        {activeTab === 'voyages' && <VoyagesTab onOpenDay={navigateToDay} />}
        {activeTab === 'stats'   && <StatsTab />}
        {activeTab === 'lieux'   && <LieuxTab />}

        <HubStatus />
      </main>
    </div>
  )
}

// ─── GlobalStatsStrip ─────────────────────────────────────────────────────────

function GlobalStatsStrip({ stats }: { stats: LocationStats | null }) {
  const tiles = useMemo(() => {
    if (!stats) return null
    const years = stats.earliest_date && stats.latest_date
      ? new Date(stats.latest_date).getFullYear() - new Date(stats.earliest_date).getFullYear() + 1
      : 0
    return [
      { label: 'Visites',       value: stats.total_visits.toLocaleString('fr-CA'),         icon: MapPin,    color: 'text-accent'      },
      { label: 'Lieux uniques', value: stats.unique_places.toLocaleString('fr-CA'),        icon: Globe,     color: 'text-sky-400'     },
      { label: 'Domicile',      value: stats.home_visits.toLocaleString('fr-CA'),          icon: Home,      color: 'text-green-400'   },
      { label: 'Travail',       value: stats.work_visits.toLocaleString('fr-CA'),          icon: Briefcase, color: 'text-blue-400'    },
      { label: 'Points GPS',    value: (stats.total_path_points / 1000).toFixed(1) + 'k',  icon: Navigation, color: 'text-amber-400'  },
      { label: 'Années',        value: String(years),                                       icon: Calendar,  color: 'text-ink-300'    },
    ]
  }, [stats])

  if (!tiles) {
    return (
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="panel h-16 animate-pulse bg-ink-800/50" />
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
      {tiles.map((t) => {
        const Icon = t.icon
        return (
          <motion.div key={t.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="panel px-3 py-2.5 flex flex-col gap-1">
            <div className="flex items-center gap-1.5">
              <Icon size={12} className={t.color} />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-400">{t.label}</span>
            </div>
            <div className={cn('text-xl font-bold font-mono leading-none', t.color)}>{t.value}</div>
          </motion.div>
        )
      })}
    </div>
  )
}

// ─── IngestButton ─────────────────────────────────────────────────────────────

function IngestButton() {
  const [loading, setLoading] = useState(false)
  const [result, setResult]   = useState<string | null>(null)

  const handleIngest = useCallback(async () => {
    const path = prompt('Chemin vers Timeline.json', 'C:\\Users\\dessin14\\Downloads\\Timeline.json')
    if (!path) return
    setLoading(true); setResult(null)
    try {
      const res = await api.locations.ingestFile(path)
      setResult(`✓ ${res.visits_inserted} visites · ${res.points_inserted} pts · ${res.activities_inserted} activités`)
      mutate('locations-stats'); mutate('activity-stats'); mutate('visits-by-year')
    } catch (e: unknown) {
      setResult(`✗ ${e instanceof Error ? e.message : String(e)}`)
    } finally { setLoading(false) }
  }, [])

  return (
    <div className="flex flex-col items-end gap-1">
      <button onClick={handleIngest} disabled={loading}
        className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold border transition-colors',
          loading ? 'opacity-50 cursor-not-allowed border-ink-700 text-ink-400'
                  : 'border-accent/40 text-accent hover:bg-accent/10 active:scale-95')}>
        {loading ? <RefreshCw size={12} className="animate-spin" /> : <Upload size={12} />}
        {loading ? 'Ingestion…' : 'Importer Timeline.json'}
      </button>
      {result && <p className={cn('text-[10px] font-mono', result.startsWith('✓') ? 'text-accent' : 'text-red-400')}>{result}</p>}
    </div>
  )
}

// ─── CarteTab — multi-modes + click popup ───────────────────────────────────

const MAP_MODES: Array<{ id: MapMode; label: string; icon: ComponentType<{ size?: number; className?: string }>; hex: string }> = [
  { id: 'visits',     label: 'Visites',  icon: MapPin,     hex: '#5cdb95' },
  { id: 'points',     label: 'Points',   icon: Navigation, hex: '#ffb84d' },
  { id: 'trajectory', label: 'Trajets',  icon: Activity,   hex: '#5fb3f4' },
  { id: 'heatmap',    label: 'Heatmap',  icon: Flame,      hex: '#fb923c' },
]

function CarteTab({ latestDate }: { latestDate: string | null }) {
  const defaultEnd = latestDate ?? new Date().toISOString().slice(0, 10)
  const defaultStart = useMemo(() => {
    const d = new Date(defaultEnd)
    d.setMonth(d.getMonth() - 2)
    return d.toISOString().slice(0, 10)
  }, [defaultEnd])

  const [startDate, setStartDate] = useState(defaultStart)
  const [endDate, setEndDate]     = useState(defaultEnd)
  const [mode, setMode]           = useState<MapMode>('visits')
  const [clickPos, setClickPos]   = useState<{ lat: number; lng: number } | null>(null)

  // Visites pour le mode visites
  const { data: visits, isLoading: visitsLoading } = useSWR(
    mode === 'visits' ? ['loc-visits-map', startDate, endDate] : null,
    () => api.locations.visits.list({ start_date: startDate, end_date: endDate, limit: 2000 })
  )
  // Points pour les modes points / trajectory / heatmap
  const { data: points, isLoading: pointsLoading } = useSWR(
    mode !== 'visits' ? ['loc-points-map', startDate, endDate, mode] : null,
    () => api.locations.points.list({
      start_date: startDate, end_date: endDate,
      limit: mode === 'heatmap' ? 10000 : 5000,
      source: 'google_timeline',
    })
  )

  const isLoading = mode === 'visits' ? visitsLoading : pointsLoading
  const count = mode === 'visits' ? (visits?.length ?? 0) : (points?.length ?? 0)

  return (
    <div className="flex flex-col gap-3 flex-1">
      {/* Filtres */}
      <div className="panel p-3 grid grid-cols-2 md:grid-cols-[1fr_1fr_auto_auto] gap-3 items-end">
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-wider text-ink-400 mb-1">Du</label>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
            className="w-full bg-ink-800 border border-ink-700 rounded-md px-3 py-1.5 text-sm font-mono" />
        </div>
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-wider text-ink-400 mb-1">Au</label>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
            className="w-full bg-ink-800 border border-ink-700 rounded-md px-3 py-1.5 text-sm font-mono" />
        </div>
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-wider text-ink-400 mb-1">Mode</label>
          <div className="flex gap-1">
            {MAP_MODES.map((m) => {
              const MIcon = m.icon
              const active = mode === m.id
              return (
                <button key={m.id} onClick={() => setMode(m.id)}
                  title={m.label}
                  className={cn('px-2.5 py-1.5 rounded-md text-xs border transition-all flex items-center gap-1',
                    active ? 'font-semibold' : 'bg-ink-800 border-ink-700 text-ink-400 hover:border-ink-500 hover:text-ink-200')}
                  style={active ? { backgroundColor: m.hex + '20', borderColor: m.hex + '60', color: m.hex } : {}}>
                  <MIcon size={11} />
                  <span className="hidden sm:inline">{m.label}</span>
                </button>
              )
            })}
          </div>
        </div>
        <div className="flex items-center gap-2 self-end pb-1">
          <Layers size={13} className="text-ink-400" />
          <span className="text-xs text-ink-400 font-mono">
            {isLoading ? '…' : `${count.toLocaleString('fr-CA')}`}
          </span>
        </div>
      </div>

      {/* Carte + click popup */}
      <div className="panel overflow-hidden flex-1 min-h-[560px] relative">
        {isLoading && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 z-[600] panel px-3 py-1.5 text-[11px] font-mono text-ink-300 border-accent/30 flex items-center gap-1.5">
            <RefreshCw size={11} className="animate-spin" />
            Chargement…
          </div>
        )}

        {/* Hint click */}
        {!clickPos && (
          <div className="absolute top-2 right-2 z-[600] panel px-3 py-1.5 text-[10px] font-mono text-ink-400 border-ink-700/50 pointer-events-none flex items-center gap-1.5">
            <Zap size={10} className="text-accent" />
            Clique sur la carte pour voir un lieu
          </div>
        )}

        <LocationMap
          mode={mode}
          visits={mode === 'visits' ? (visits ?? []) : []}
          points={mode !== 'visits' ? (points ?? []) : []}
          onMapClick={(lat, lng) => setClickPos({ lat, lng })}
          highlightLat={clickPos?.lat}
          highlightLng={clickPos?.lng}
          highlightRadius={200}
        />

        {clickPos && (
          <ClickPopup
            lat={clickPos.lat}
            lng={clickPos.lng}
            onClose={() => setClickPos(null)}
          />
        )}
      </div>

      {/* Mode hint */}
      {mode === 'heatmap' && (
        <p className="text-[10px] text-ink-500 font-mono">
          🔥 Heatmap : densité des points GPS. Plus c'est chaud (jaune/orange), plus tu y as passé de temps.
        </p>
      )}
      {mode === 'trajectory' && (
        <p className="text-[10px] text-ink-500 font-mono">
          🛣️ Trajets : polylines dégradées par heure du jour (jaune=matin, vert=midi, bleu=soir, violet=nuit). Gaps &gt;30min cassent la ligne.
        </p>
      )}
    </div>
  )
}

// ─── VisitesTab ───────────────────────────────────────────────────────────────

const SEMANTIC_FILTER_OPTIONS = [
  { id: '',                 label: 'Tous' },
  { id: 'HOME',             label: '🏠 Domicile' },
  { id: 'INFERRED_HOME',    label: '🏠 Dom. inf.' },
  { id: 'WORK',             label: '💼 Travail' },
  { id: 'SEARCHED_ADDRESS', label: '📍 Adresse' },
  { id: 'ALIASED_LOCATION', label: '⭐ Favori' },
  { id: 'UNKNOWN',          label: '❓ Inconnu' },
]

function VisitesTab() {
  const [semanticFilter, setSemanticFilter] = useState('')
  const [startDate, setStartDate]           = useState('')
  const [endDate, setEndDate]               = useState('')
  const [page, setPage]                     = useState(0)
  const PAGE_SIZE = 50

  const key = ['loc-visits', semanticFilter, startDate, endDate, page]
  const { data: visits, isLoading } = useSWR(key, () =>
    api.locations.visits.list({
      semantic_type: semanticFilter || undefined,
      start_date: startDate || undefined,
      end_date: endDate || undefined,
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
    })
  )

  return (
    <div className="flex flex-col gap-3">
      <div className="panel p-3 flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-wider text-ink-400 mb-1">Type</label>
          <div className="flex flex-wrap gap-1">
            {SEMANTIC_FILTER_OPTIONS.map((o) => (
              <button key={o.id} onClick={() => { setSemanticFilter(o.id); setPage(0) }}
                className={cn('px-2 py-1 rounded-md text-xs border transition-colors',
                  semanticFilter === o.id ? 'bg-accent/15 border-accent/40 text-accent'
                                          : 'bg-ink-800 border-ink-700 text-ink-300 hover:border-ink-600')}>
                {o.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-wider text-ink-400 mb-1">Du</label>
          <input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setPage(0) }}
            className="bg-ink-800 border border-ink-700 rounded-md px-3 py-1.5 text-sm font-mono" />
        </div>
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-wider text-ink-400 mb-1">Au</label>
          <input type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setPage(0) }}
            className="bg-ink-800 border border-ink-700 rounded-md px-3 py-1.5 text-sm font-mono" />
        </div>
      </div>

      {isLoading ? (
        <div className="panel p-6 flex justify-center"><RefreshCw size={18} className="animate-spin text-ink-400" /></div>
      ) : (
        <div className="panel divide-y divide-ink-800/60">
          <AnimatePresence mode="popLayout">
            {(visits ?? []).map((v, i) => <VisitRow key={v.id} visit={v} idx={i} swrKey={key} />)}
            {(visits ?? []).length === 0 && (
              <div className="p-8 text-center text-ink-400 text-sm">Aucune visite pour ce filtre.</div>
            )}
          </AnimatePresence>
        </div>
      )}

      <div className="flex gap-2 justify-center items-center">
        <button disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}
          className="px-3 py-1.5 text-xs border border-ink-700 rounded-md disabled:opacity-40 hover:border-ink-600 transition-colors">
          ← Précédent
        </button>
        <span className="text-xs text-ink-400 font-mono">Page {page + 1}</span>
        <button disabled={(visits?.length ?? 0) < PAGE_SIZE} onClick={() => setPage((p) => p + 1)}
          className="px-3 py-1.5 text-xs border border-ink-700 rounded-md disabled:opacity-40 hover:border-ink-600 transition-colors">
          Suivant →
        </button>
      </div>
    </div>
  )
}

function VisitRow({ visit, idx, swrKey }: { visit: LocationVisit; idx: number; swrKey: unknown[] }) {
  const meta = getSemanticMeta(visit.semantic_type)
  const Icon = meta.icon
  const start = new Date(visit.start_time)
  const end   = new Date(visit.end_time)
  const durationMin = Math.round((end.getTime() - start.getTime()) / 60000)
  const fmtDuration = durationMin < 60
    ? `${durationMin}min`
    : `${Math.floor(durationMin / 60)}h${String(durationMin % 60).padStart(2, '0')}`
  const [patching, setPatching] = useState(false)

  const handleRetag = useCallback(async (type: string) => {
    setPatching(true)
    try {
      await api.locations.visits.patch(visit.id, type)
      mutate(swrKey); mutate('locations-stats')
    } finally { setPatching(false) }
  }, [visit.id, swrKey])

  return (
    <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.01 }}
      className="flex items-start gap-3 px-4 py-3 hover:bg-ink-800/30 transition-colors group">
      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
        style={{ backgroundColor: meta.hex + '22', border: `1px solid ${meta.hex}44` }}>
        <Icon size={14} style={{ color: meta.hex }} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold" style={{ color: meta.hex }}>{meta.label}</span>
          {visit.probability !== null && visit.probability < 0.8 && (
            <span className="text-[10px] text-ink-500 font-mono">{Math.round((visit.probability ?? 0) * 100)}%</span>
          )}
          <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 ml-auto">
            {[
              { type: 'HOME',    icon: Home,      hex: '#5cdb95' },
              { type: 'WORK',    icon: Briefcase, hex: '#5fb3f4' },
              { type: 'UNKNOWN', icon: MapPin,    hex: '#8b95a3' },
            ].filter(r => r.type !== visit.semantic_type).map((r) => {
              const RIcon = r.icon
              return (
                <button key={r.type} disabled={patching} onClick={() => handleRetag(r.type)}
                  title={`Marquer comme ${r.type}`}
                  className="w-6 h-6 rounded flex items-center justify-center bg-ink-800 border border-ink-700 hover:border-ink-500 disabled:opacity-50 transition-colors">
                  <RIcon size={10} style={{ color: r.hex }} />
                </button>
              )
            })}
          </div>
        </div>
        <div className="text-xs text-ink-400 font-mono mt-0.5 flex items-center gap-2 flex-wrap">
          <span>{start.toLocaleDateString('fr-CA', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
          <span className="text-ink-600">·</span>
          <span>{start.toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' })}</span>
          <span className="text-ink-600">→</span>
          <span>{end.toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' })}</span>
          <span className="text-ink-600">·</span>
          <span className="text-accent/70">{fmtDuration}</span>
        </div>
        <div className="text-[10px] text-ink-600 font-mono mt-0.5">
          {parseFloat(visit.lat).toFixed(4)}°, {parseFloat(visit.lng).toFixed(4)}°
          {visit.place_id && <span className="ml-2 text-ink-700">{visit.place_id.slice(0, 12)}…</span>}
        </div>
      </div>

      <div className="shrink-0">
        <span className="inline-block text-[10px] font-mono px-2 py-0.5 rounded bg-ink-800 border border-ink-700 text-ink-300">
          {fmtDuration}
        </span>
      </div>
    </motion.div>
  )
}

// ─── StatsTab ─────────────────────────────────────────────────────────────────

function StatsTab() {
  const { data: stats }     = useSWR('locations-stats', () => api.locations.stats())
  const { data: actStats }  = useSWR('activity-stats',  () => api.locations.activityStats())
  const { data: yearStats } = useSWR('visits-by-year',  () => api.locations.visitsByYear())

  if (!stats) return (
    <div className="panel p-8 flex justify-center"><RefreshCw size={18} className="animate-spin text-ink-400" /></div>
  )

  const yearsSpan = stats.earliest_date && stats.latest_date
    ? new Date(stats.latest_date).getFullYear() - new Date(stats.earliest_date).getFullYear() + 1
    : 0
  const totalDistKm    = actStats?.reduce((s, a) => s + a.total_distance_km, 0) ?? 0
  const totalDurMin    = actStats?.reduce((s, a) => s + a.total_duration_minutes, 0) ?? 0
  const flyEntry       = actStats?.find(a => a.activity_type === 'FLYING')
  const carEntry       = actStats?.find(a => a.activity_type === 'IN_PASSENGER_VEHICLE')
  const walkEntry      = actStats?.find(a => a.activity_type === 'WALKING')
  const maxYearVisits  = Math.max(...(yearStats?.map(y => y.visits) ?? [1]))

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">

      <div className="panel p-4 col-span-full">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-ink-400 mb-3">
          Vue globale — {yearsSpan} ans ({stats.earliest_date} → {stats.latest_date})
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatBlock icon={MapPin} label="Visites totales"  value={stats.total_visits.toLocaleString('fr-CA')}    hex="#5cdb95" />
          <StatBlock icon={Globe}  label="Lieux uniques"    value={stats.unique_places.toLocaleString('fr-CA')}   hex="#5fb3f4" />
          <StatBlock icon={Ruler}  label="Distance totale"  value={(totalDistKm / 1000).toFixed(0) + 'k km'}      hex="#ffb84d" />
          <StatBlock icon={Clock}  label="Heures de trajet" value={Math.round(totalDurMin / 60).toLocaleString('fr-CA') + 'h'} hex="#c084fc" />
        </div>
      </div>

      <div className="panel p-4">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-ink-400 mb-3">Répartition visites</div>
        <div className="space-y-3">
          {[
            { label: 'Domicile',     value: stats.home_visits,                                             hex: '#5cdb95' },
            { label: 'Travail',      value: stats.work_visits,                                             hex: '#5fb3f4' },
            { label: 'Autres lieux', value: stats.total_visits - stats.home_visits - stats.work_visits,   hex: '#8b95a3' },
          ].map((r) => (
            <div key={r.label}>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-ink-300">{r.label}</span>
                <span className="font-mono text-ink-400">
                  {r.value.toLocaleString('fr-CA')} ({Math.round((r.value / stats.total_visits) * 100)}%)
                </span>
              </div>
              <div className="h-1.5 bg-ink-800 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all"
                  style={{ width: `${(r.value / stats.total_visits) * 100}%`, backgroundColor: r.hex }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="panel p-4">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-ink-400 mb-3">Distances clés</div>
        <div className="space-y-2.5">
          {flyEntry && <FunFact icon={Plane} label="En avion"
            value={flyEntry.total_distance_km.toLocaleString('fr-CA') + ' km'}
            sub={`${flyEntry.count} vols · ≈${(flyEntry.total_distance_km / 40075).toFixed(1)}× tour de la Terre`} hex="#5fb3f4" />}
          {carEntry && <FunFact icon={Car} label="En voiture"
            value={carEntry.total_distance_km.toLocaleString('fr-CA') + ' km'}
            sub={`${carEntry.count} trajets · ≈${(carEntry.total_distance_km / 40075).toFixed(1)}× tour de la Terre`} hex="#ffb84d" />}
          {walkEntry && <FunFact icon={Footprints} label="À pied"
            value={walkEntry.total_distance_km.toLocaleString('fr-CA') + ' km'}
            sub={`${walkEntry.count} sessions · ${Math.round(walkEntry.total_duration_minutes / 60)}h`} hex="#5cdb95" />}
        </div>
      </div>

      <div className="panel p-4 col-span-1 md:col-span-full lg:col-span-full">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-ink-400 mb-3 flex items-center gap-1.5">
          <BarChart3 size={12} className="text-ink-400" />
          Modes de transport ({stats.total_activities.toLocaleString()} activités)
        </div>
        {actStats ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {actStats.filter(a => a.count > 0).map((a) => {
              const meta = ACTIVITY_ICONS[a.activity_type] ?? { icon: Navigation, label: a.activity_type, hex: '#6b7280' }
              const ActivityIcon = meta.icon
              return (
                <div key={a.activity_type}
                  className="flex items-start gap-2.5 p-2.5 rounded-lg bg-ink-800/50 border border-ink-700/50">
                  <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0 mt-0.5"
                    style={{ backgroundColor: meta.hex + '22' }}>
                    <ActivityIcon size={13} style={{ color: meta.hex }} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-ink-200">{meta.label}</div>
                    <div className="text-[10px] font-mono text-ink-400">{a.count.toLocaleString()} trajets</div>
                    {a.total_distance_km > 0 && (
                      <div className="text-[10px] font-mono text-ink-500">
                        {a.total_distance_km >= 1000
                          ? (a.total_distance_km / 1000).toFixed(0) + 'k km'
                          : a.total_distance_km.toFixed(0) + ' km'}
                      </div>
                    )}
                    <div className="text-[10px] font-mono text-ink-600">
                      {a.total_duration_minutes > 60
                        ? Math.round(a.total_duration_minutes / 60) + 'h'
                        : a.total_duration_minutes + 'min'}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ) : <div className="flex justify-center p-4"><RefreshCw size={16} className="animate-spin text-ink-400" /></div>}
      </div>

      {yearStats && yearStats.length > 0 && (
        <div className="panel p-4 col-span-full">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-ink-400 mb-3">Visites par année</div>
          <div className="flex items-end gap-1.5 h-32 overflow-x-auto pb-2">
            {yearStats.map((y) => {
              const pct     = (y.visits / maxYearVisits) * 100
              const homePct = y.visits > 0 ? (y.home_visits / y.visits) * 100 : 0
              const workPct = y.visits > 0 ? (y.work_visits / y.visits) * 100 : 0
              return (
                <div key={y.year} className="flex flex-col items-center gap-1 min-w-[34px] group cursor-default">
                  <span className="text-[9px] font-mono text-ink-600 group-hover:text-accent transition-colors opacity-0 group-hover:opacity-100">
                    {y.visits}
                  </span>
                  <div className="flex-1 flex flex-col justify-end w-full">
                    <div className="relative w-full rounded-t overflow-hidden"
                      style={{ height: `${Math.max(pct, 2)}%`, backgroundColor: '#8b95a322' }}>
                      <div className="absolute bottom-0 left-0 right-0"
                        style={{ height: `${homePct}%`, backgroundColor: '#5cdb95' }} />
                      <div className="absolute left-0 right-0"
                        style={{ bottom: `${homePct}%`, height: `${workPct}%`, backgroundColor: '#5fb3f4' }} />
                    </div>
                  </div>
                  <span className="text-[9px] font-mono text-ink-500"
                    style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>
                    {y.year}
                  </span>
                </div>
              )
            })}
          </div>
          <div className="flex items-center gap-4 mt-1 text-[10px] text-ink-500">
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm" style={{backgroundColor:'#5cdb95'}} />Domicile</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm" style={{backgroundColor:'#5fb3f4'}} />Travail</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm" style={{backgroundColor:'#8b95a322',border:'1px solid #8b95a3'}} />Autres</span>
          </div>
        </div>
      )}
    </div>
  )
}

function StatBlock({ icon: Icon, label, value, hex }: {
  icon: ComponentType<{ size?: number; className?: string }>; label: string; value: string; hex: string
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
        style={{ backgroundColor: hex + '22', border: `1px solid ${hex}40` }}>
        <Icon size={16} style={{ color: hex }} />
      </div>
      <div>
        <div className="text-lg font-bold font-mono leading-none" style={{ color: hex }}>{value}</div>
        <div className="text-[10px] text-ink-400 mt-0.5">{label}</div>
      </div>
    </div>
  )
}

function FunFact({ icon: Icon, label, value, sub, hex }: {
  icon: ComponentType<{ size?: number; className?: string }>; label: string; value: string; sub: string; hex: string
}) {
  return (
    <div className="flex items-center gap-3 p-2.5 rounded-lg bg-ink-800/30 border border-ink-700/40">
      <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0"
        style={{ backgroundColor: hex + '22' }}>
        <Icon size={13} style={{ color: hex }} />
      </div>
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-wider font-semibold text-ink-400">{label}</div>
        <div className="text-sm font-bold font-mono leading-tight" style={{ color: hex }}>{value}</div>
        <div className="text-[10px] text-ink-500 truncate">{sub}</div>
      </div>
    </div>
  )
}

// ─── LieuxTab ─────────────────────────────────────────────────────────────────

const SEMANTIC_TYPES_OPTIONS = [
  { value: 'HOME',             label: '🏠 Domicile',    hex: '#5cdb95' },
  { value: 'WORK',             label: '💼 Travail',      hex: '#5fb3f4' },
  { value: 'SEARCHED_ADDRESS', label: '📍 Adresse',      hex: '#ffb84d' },
  { value: 'ALIASED_LOCATION', label: '⭐ Lieu favori',  hex: '#c084fc' },
  { value: 'UNKNOWN',          label: '❓ Inconnu',      hex: '#8b95a3' },
]

function LieuxTab() {
  const [lat, setLat]         = useState('')
  const [lng, setLng]         = useState('')
  const [radius, setRadius]   = useState('300')
  const [semType, setSemType] = useState('HOME')
  const [loading, setLoading] = useState(false)
  const [result, setResult]   = useState<{ updated: number; type: string } | null>(null)
  const [error, setError]     = useState<string | null>(null)

  const handleRetag = useCallback(async () => {
    const latN = parseFloat(lat), lngN = parseFloat(lng), radN = parseFloat(radius)
    if (isNaN(latN) || isNaN(lngN) || isNaN(radN)) { setError('Coordonnées invalides'); return }
    setLoading(true); setResult(null); setError(null)
    try {
      const res = await api.locations.retag({ lat: latN, lng: lngN, radius_m: radN, semantic_type: semType })
      setResult({ updated: res.updated, type: semType })
      mutate('locations-stats'); mutate('visits-by-year')
      mutate('loc-home-sample'); mutate('loc-work-sample')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    } finally { setLoading(false) }
  }, [lat, lng, radius, semType])

  const { data: homeVisits } = useSWR('loc-home-sample',
    () => api.locations.visits.list({ semantic_type: 'HOME', limit: 5 }))
  const { data: workVisits } = useSWR('loc-work-sample',
    () => api.locations.visits.list({ semantic_type: 'WORK', limit: 5 }))

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

      <div className="panel p-4">
        <div className="flex items-center gap-2 mb-1">
          <Settings size={14} className="text-accent" />
          <span className="text-sm font-semibold">Définir un lieu</span>
        </div>
        <p className="text-xs text-ink-500 mb-4">
          Toutes les visites dans le rayon seront retaggées avec le type choisi.
        </p>

        <div className="space-y-3">
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-ink-400 mb-1.5">Type de lieu</label>
            <div className="flex flex-wrap gap-1.5">
              {SEMANTIC_TYPES_OPTIONS.map((o) => (
                <button key={o.value} onClick={() => setSemType(o.value)}
                  className="px-2.5 py-1.5 rounded-md text-xs border transition-colors font-medium"
                  style={semType === o.value
                    ? { backgroundColor: o.hex, borderColor: o.hex, color: '#0d1117' }
                    : { backgroundColor: 'transparent', borderColor: '#374151', color: '#9ca3af' }}>
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-ink-400 mb-1">Latitude</label>
              <input type="number" step="0.0001" placeholder="46.7383"
                value={lat} onChange={(e) => setLat(e.target.value)}
                className="w-full bg-ink-800 border border-ink-700 rounded-md px-3 py-1.5 text-sm font-mono focus:border-accent/50 outline-none" />
            </div>
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-ink-400 mb-1">Longitude</label>
              <input type="number" step="0.0001" placeholder="-71.2433"
                value={lng} onChange={(e) => setLng(e.target.value)}
                className="w-full bg-ink-800 border border-ink-700 rounded-md px-3 py-1.5 text-sm font-mono focus:border-accent/50 outline-none" />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-ink-400 mb-1">
              Rayon : {parseInt(radius).toLocaleString()} m
            </label>
            <input type="range" min="50" max="5000" step="50"
              value={radius} onChange={(e) => setRadius(e.target.value)}
              className="w-full accent-accent" />
            <div className="flex justify-between text-[10px] text-ink-600 font-mono mt-0.5">
              <span>50m</span><span>1km</span><span>5km</span>
            </div>
          </div>

          <div className="text-[10px] text-ink-500 font-mono bg-ink-800/50 rounded px-2.5 py-2 leading-relaxed">
            💡 Astuce : tu peux aussi <strong className="text-accent">cliquer sur la carte</strong> dans l'onglet "Carte GPS" pour copier les coordonnées d'un lieu.
          </div>

          <button onClick={handleRetag} disabled={loading || !lat || !lng}
            className={cn('w-full py-2 rounded-md text-sm font-semibold border transition-all',
              loading || !lat || !lng
                ? 'opacity-40 cursor-not-allowed border-ink-700 text-ink-400'
                : 'border-accent/40 text-accent hover:bg-accent/10 active:scale-[0.99]')}>
            {loading
              ? <><RefreshCw size={13} className="inline animate-spin mr-1.5" />Retag en cours…</>
              : `→ Appliquer le retag${lat && lng ? ` (${radius}m autour de ${parseFloat(lat).toFixed(4)}°, ${parseFloat(lng).toFixed(4)}°)` : ''}`}
          </button>

          <AnimatePresence>
            {result && (
              <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="flex items-center gap-2 p-2.5 rounded-lg bg-accent/10 border border-accent/30">
                <CheckCircle size={14} className="text-accent shrink-0" />
                <span className="text-xs font-mono text-accent">
                  {result.updated} visite{result.updated !== 1 ? 's' : ''} → {result.type}
                </span>
              </motion.div>
            )}
            {error && (
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="text-xs text-red-400 font-mono">{error}</motion.p>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div className="panel p-4">
          <div className="flex items-center gap-2 mb-3">
            <Home size={14} className="text-green-400" />
            <span className="text-sm font-semibold">Domicile — visites récentes</span>
            <span className="ml-auto text-[10px] font-mono text-ink-500">{homeVisits?.length ?? '…'} affichées</span>
          </div>
          {homeVisits?.length === 0 ? (
            <p className="text-xs text-ink-500 italic">Aucune visite HOME — utilise le formulaire pour définir ton domicile.</p>
          ) : (
            <div className="space-y-1.5">
              {(homeVisits ?? []).map((v) => <MiniVisitRow key={v.id} visit={v} />)}
            </div>
          )}
        </div>

        <div className="panel p-4">
          <div className="flex items-center gap-2 mb-3">
            <Briefcase size={14} className="text-blue-400" />
            <span className="text-sm font-semibold">Travail — visites récentes</span>
            <span className="ml-auto text-[10px] font-mono text-ink-500">{workVisits?.length ?? '…'} affichées</span>
          </div>
          {workVisits?.length === 0 ? (
            <p className="text-xs text-ink-500 italic">Aucune visite WORK.</p>
          ) : (
            <div className="space-y-1.5">
              {(workVisits ?? []).map((v) => <MiniVisitRow key={v.id} visit={v} />)}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function MiniVisitRow({ visit }: { visit: LocationVisit }) {
  const start = new Date(visit.start_time)
  const end   = new Date(visit.end_time)
  const durationMin = Math.round((end.getTime() - start.getTime()) / 60000)
  return (
    <div className="flex items-center gap-2 text-xs font-mono py-0.5">
      <span className="text-ink-500 shrink-0">
        {start.toLocaleDateString('fr-CA', { day: 'numeric', month: 'short', year: '2-digit' })}
      </span>
      <span className="text-ink-600">·</span>
      <span className="text-ink-400 truncate">
        {parseFloat(visit.lat).toFixed(4)}°, {parseFloat(visit.lng).toFixed(4)}°
      </span>
      <span className="ml-auto text-ink-600 shrink-0">
        {durationMin < 60 ? `${durationMin}min` : `${Math.floor(durationMin/60)}h`}
      </span>
    </div>
  )
}
