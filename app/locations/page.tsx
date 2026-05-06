'use client'

import { Sidebar } from '@/components/sidebar'
import { HubStatus } from '@/components/hub-status'
import { Tabs, useActiveTab, type TabItem } from '@/components/tabs'
import {
  MapPin, Home, Briefcase, Navigation, Car, Train, Footprints, Plane, Bike,
  Map as MapIcon, Globe, Calendar, TrendingUp, RefreshCw, Upload, Layers,
  Sparkles, Settings, CheckCircle, Clock, Ruler, BarChart3, Compass, Flame,
  Zap, Activity, Satellite, Trophy, Award, AlertTriangle, Crosshair,
  Maximize2, Minimize2, Loader2, X, type LucideIcon,
} from 'lucide-react'
import nextDynamic from 'next/dynamic'
import { Suspense, useMemo, useState, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import useSWR, { mutate } from 'swr'
import { api, type LocationVisit, type LocationStats } from '@/lib/api'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'
import { ClickPopup } from '@/components/locations/click-popup'
import { JourneeTab } from '@/components/locations/journee-tab'
import { VoyagesTab } from '@/components/locations/voyages-tab'
import { BatchGeocodeButton } from '@/components/locations/batch-geocode'
import { NamedPlacesPanel } from '@/components/locations/named-places'
import type { MapMode, TileStyle } from '@/components/location-map'
import { buildAddressLookup } from '@/lib/addresses'

const LocationMap = nextDynamic(
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

const SEMANTIC_META: Record<string, { label: string; icon: LucideIcon; hex: string }> = {
  HOME:              { label: 'Domicile',       icon: Home,       hex: '#5cdb95' },
  INFERRED_HOME:     { label: 'Domicile (inf)', icon: Home,       hex: '#3db37a' },
  WORK:              { label: 'Travail',        icon: Briefcase,  hex: '#5fb3f4' },
  INFERRED_WORK:     { label: 'Travail (inf)',  icon: Briefcase,  hex: '#3a8fd6' },
  SEARCHED_ADDRESS:  { label: 'Adresse',        icon: Navigation, hex: '#ffb84d' },
  ALIASED_LOCATION:  { label: 'Favori',         icon: Sparkles,   hex: '#c084fc' },
  UNKNOWN:           { label: 'Lieu inconnu',   icon: MapPin,     hex: '#8b95a3' },
}

const ACTIVITY_ICONS: Record<string, { icon: LucideIcon; label: string; hex: string }> = {
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
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center text-ink-400 text-sm font-mono">Chargement…</div>}>
      <LocationsPageInner />
    </Suspense>
  )
}

function LocationsPageInner() {
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
        <InsightsBar />
        <Tabs items={TABS} defaultId="carte" />

        {activeTab === 'carte'   && <CarteTab latestDate={stats?.latest_date ?? null} earliestDate={stats?.earliest_date ?? null} />}
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
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
      {tiles.map((t) => {
        const Icon = t.icon
        return (
          <motion.div key={t.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="panel px-3 py-2.5 flex flex-col gap-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <Icon size={12} className={cn('shrink-0', t.color)} />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-400 truncate">{t.label}</span>
            </div>
            <div className={cn('text-lg sm:text-xl font-bold font-mono leading-none truncate', t.color)}>{t.value}</div>
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

const MAP_MODES: Array<{ id: MapMode; label: string; icon: LucideIcon; hex: string }> = [
  { id: 'visits',     label: 'Visites',  icon: MapPin,     hex: '#5cdb95' },
  { id: 'points',     label: 'Points',   icon: Navigation, hex: '#ffb84d' },
  { id: 'trajectory', label: 'Trajets',  icon: Activity,   hex: '#5fb3f4' },
  { id: 'heatmap',    label: 'Heatmap',  icon: Flame,      hex: '#fb923c' },
]

function CarteTab({ latestDate, earliestDate }: { latestDate: string | null; earliestDate: string | null }) {
  const safeEnd = latestDate ?? new Date().toISOString().slice(0, 10)
  const safeStart = earliestDate ?? '2013-01-01'

  // Helper : calcule une date X mois avant la dernière donnée
  const monthsBefore = useCallback((months: number) => {
    const d = new Date(safeEnd); d.setMonth(d.getMonth() - months)
    return d.toISOString().slice(0, 10)
  }, [safeEnd])

  const [startDate, setStartDate] = useState(() => monthsBefore(2))
  const [endDate, setEndDate]     = useState(safeEnd)
  const [mode, setMode]           = useState<MapMode>('visits')
  const [clickPos, setClickPos]   = useState<{ lat: number; lng: number } | null>(null)
  const [tileStyle, setTileStyle] = useState<TileStyle>('dark')
  const [useCluster, setUseCluster] = useState(true)
  const [semanticFilter, setSemanticFilter] = useState<string | null>(null)
  const [fullscreen, setFullscreen]         = useState(false)
  const [splitMode, setSplitMode]   = useState(false)
  // Split B : meme periode l'an dernier par defaut
  const [endDateB, setEndDateB] = useState<string>(() => {
    const d = new Date(safeEnd); d.setFullYear(d.getFullYear() - 1)
    return d.toISOString().slice(0, 10)
  })
  const [startDateB, setStartDateB] = useState<string>(() => {
    const d = new Date(safeEnd); d.setFullYear(d.getFullYear() - 1); d.setMonth(d.getMonth() - 2)
    return d.toISOString().slice(0, 10)
  })

  const { data: visitsB } = useSWR(
    splitMode && mode === 'visits' ? ['loc-visits-map-B', startDateB, endDateB] : null,
    () => api.locations.visits.list({ start_date: startDateB, end_date: endDateB, limit: limits.visits })
  )
  const { data: pointsB } = useSWR(
    splitMode && mode !== 'visits' ? ['loc-points-map-B', startDateB, endDateB, mode] : null,
    () => api.locations.points.list({
      start_date: startDateB, end_date: endDateB,
      limit: limits[mode as 'heatmap' | 'trajectory' | 'points'],
      source: 'google_timeline',
    })
  )

  const setPreset = useCallback((preset: 'all' | '1M' | '3M' | '6M' | '1Y') => {
    setEndDate(safeEnd)
    if (preset === 'all') setStartDate(safeStart)
    else if (preset === '1M') setStartDate(monthsBefore(1))
    else if (preset === '3M') setStartDate(monthsBefore(3))
    else if (preset === '6M') setStartDate(monthsBefore(6))
    else if (preset === '1Y') setStartDate(monthsBefore(12))
  }, [safeStart, safeEnd, monthsBefore])

  // Limits adaptatifs selon le mode (extreme precision : tout charger)
  // - visites : 50k couvre TOUT (13.6k actuel)
  // - heatmap : 100k pts (canvas perf OK)
  // - trajectory : 30k (au-dela = freeze browser sur polylines SVG)
  // - points : 30k aussi
  const limits = {
    visits: 50000,
    heatmap: 100000,
    trajectory: 30000,
    points: 30000,
  } as const

  const { data: visits, isLoading: visitsLoading } = useSWR(
    mode === 'visits' ? ['loc-visits-map', startDate, endDate] : null,
    () => api.locations.visits.list({ start_date: startDate, end_date: endDate, limit: limits.visits })
  )
  const { data: points, isLoading: pointsLoading } = useSWR(
    mode !== 'visits' ? ['loc-points-map', startDate, endDate, mode] : null,
    () => api.locations.points.list({
      start_date: startDate, end_date: endDate,
      limit: limits[mode as 'heatmap' | 'trajectory' | 'points'],
      source: 'google_timeline',
    })
  )

  const isLoading = mode === 'visits' ? visitsLoading : pointsLoading
  const count = mode === 'visits' ? (visits?.length ?? 0) : (points?.length ?? 0)
  const isFullRange = startDate === safeStart && endDate === safeEnd

  // Index global des adresses geocodees (cache SWR partage)
  const { data: addressesData } = useSWR('addresses-index', () => api.locations.addresses(),
    { revalidateOnFocus: false })
  const addressLookup = useMemo(
    () => addressesData ? buildAddressLookup(addressesData.addresses) : undefined,
    [addressesData]
  )

  return (
    <div className="flex flex-col gap-3 flex-1">
      {/* Presets de période */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-[10px] uppercase tracking-wider font-semibold text-ink-500 mr-1">Période :</span>
        {([
          { id: '1M',  label: '1 mois'  },
          { id: '3M',  label: '3 mois'  },
          { id: '6M',  label: '6 mois'  },
          { id: '1Y',  label: '1 an'    },
          { id: 'all', label: 'TOUT' },
        ] as const).map((p) => (
          <button key={p.id} onClick={() => setPreset(p.id)}
            className={cn('px-2.5 py-1 text-xs rounded-md border transition-colors font-mono',
              p.id === 'all' && isFullRange
                ? 'bg-accent text-ink-900 border-accent font-bold'
                : 'bg-ink-800 border-ink-700 text-ink-300 hover:border-ink-500')}>
            {p.label}
          </button>
        ))}
        {isFullRange && (
          <span className="text-[10px] font-mono text-accent ml-1">
            {earliestDate?.slice(0, 4)} → {latestDate?.slice(0, 4)} · tout l&apos;historique
          </span>
        )}
      </div>

      {/* Filtres détaillés */}
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
            {isLoading ? '…' : `${count.toLocaleString('fr-CA')} ${mode === 'visits' ? 'visites' : 'pts'}`}
          </span>
          {mode === 'trajectory' && count >= limits.trajectory && (
            <span className="text-[10px] font-mono text-amber-400" title="Limite atteinte">⚠</span>
          )}
        </div>
      </div>

      {/* Carte + click popup */}
      <div className={cn(
          'panel overflow-hidden relative transition-all',
          fullscreen
            ? 'fixed inset-0 z-[2000] rounded-none border-0'
            : 'flex-1 min-h-[560px]'
      )}>
        {isLoading && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 z-[600] panel px-3 py-1.5 text-[11px] font-mono text-ink-300 border-accent/30 flex items-center gap-1.5">
            <RefreshCw size={11} className="animate-spin" />
            Chargement…
          </div>
        )}

        {/* Tile selector — top left */}
        <TileSelector value={tileStyle} onChange={setTileStyle} />

        {/* Cluster toggle + Split toggle — top right */}
        <div className="absolute top-2 right-[170px] z-[600] flex gap-1">
          {mode === 'visits' && (
            <button
              onClick={() => setUseCluster(!useCluster)}
              className={cn('panel px-2.5 py-1.5 text-[10px] font-semibold border flex items-center gap-1 transition-colors',
                useCluster ? 'border-accent/50 text-accent' : 'border-ink-700 text-ink-400 hover:border-ink-500')}>
              <Crosshair size={11} />
              {useCluster ? 'Cluster ON' : 'Cluster OFF'}
            </button>
          )}
          <button
            onClick={() => setSplitMode(!splitMode)}
            title="Comparer 2 périodes côte-à-côte"
            className={cn('panel px-2.5 py-1.5 text-[10px] font-semibold border flex items-center gap-1 transition-colors',
              splitMode ? 'border-amber-500/50 text-amber-400' : 'border-ink-700 text-ink-400 hover:border-ink-500')}>
            ⚖
            {splitMode ? 'Split ON' : 'Split'}
          </button>
        </div>

        {/* Fullscreen toggle — top right */}
        <button onClick={() => setFullscreen(!fullscreen)}
          title={fullscreen ? 'Quitter plein écran' : 'Plein écran'}
          className="absolute top-2 right-2 z-[700] panel px-2.5 py-1.5 text-[10px] font-semibold border border-ink-700/60 hover:border-accent/50 hover:text-accent transition-colors flex items-center gap-1">
          {fullscreen ? <Minimize2 size={11} /> : <Maximize2 size={11} />}
          <span className="hidden sm:inline">{fullscreen ? 'Réduire' : 'Plein écran'}</span>
        </button>

        {!splitMode ? (
          <LocationMap
            mode={mode}
            visits={mode === 'visits' ? (visits ?? []) : []}
            points={mode !== 'visits' ? (points ?? []) : []}
            onMapClick={(lat, lng) => setClickPos({ lat, lng })}
            highlightLat={clickPos?.lat}
            highlightLng={clickPos?.lng}
            highlightRadius={200}
            tileStyle={tileStyle}
            cluster={useCluster}
            semanticFilter={semanticFilter}
            addressLookup={addressLookup}
          />
        ) : (
          <div className="grid grid-cols-2 gap-px bg-accent/40 h-full">
            <div className="relative bg-ink-950">
              <div className="absolute top-2 left-1/2 -translate-x-1/2 z-[600] panel px-2.5 py-1 text-[10px] font-mono border-accent/40 text-accent">
                A · {startDate} → {endDate}
              </div>
              <LocationMap mode={mode}
                visits={mode === 'visits' ? (visits ?? []) : []}
                points={mode !== 'visits' ? (points ?? []) : []}
                tileStyle={tileStyle} cluster={useCluster}
                semanticFilter={semanticFilter} addressLookup={addressLookup} />
            </div>
            <div className="relative bg-ink-950">
              <div className="absolute top-2 left-1/2 -translate-x-1/2 z-[600] panel px-2.5 py-1 text-[10px] font-mono border-amber-500/40 text-amber-400 flex items-center gap-2">
                B · <input type="date" value={startDateB} onChange={(e) => setStartDateB(e.target.value)}
                  className="bg-ink-800 border border-ink-700 rounded px-1 py-0 text-[10px] font-mono w-24" />
                →
                <input type="date" value={endDateB} onChange={(e) => setEndDateB(e.target.value)}
                  className="bg-ink-800 border border-ink-700 rounded px-1 py-0 text-[10px] font-mono w-24" />
              </div>
              <LocationMap mode={mode}
                visits={mode === 'visits' ? (visitsB ?? []) : []}
                points={mode !== 'visits' ? (pointsB ?? []) : []}
                tileStyle={tileStyle} cluster={useCluster}
                semanticFilter={semanticFilter} addressLookup={addressLookup} />
            </div>
          </div>
        )}

        {/* Legende interactive — bottom left */}
        {mode === 'visits' && visits && visits.length > 0 && (
          <SemanticLegend
            visits={visits}
            active={semanticFilter}
            onChange={setSemanticFilter}
          />
        )}

        {clickPos && (
          <ClickPopup
            lat={clickPos.lat}
            lng={clickPos.lng}
            onClose={() => setClickPos(null)}
          />
        )}
      </div>

      {/* Mode hint + heatmap year slider */}
      {mode === 'heatmap' && (
        <>
          <HeatmapYearSlider
            startYear={parseInt(safeStart.slice(0, 4))}
            endYear={parseInt(safeEnd.slice(0, 4))}
            currentStart={startDate}
            currentEnd={endDate}
            onChangeYear={(y) => {
              setStartDate(`${y}-01-01`)
              setEndDate(`${y}-12-31`)
            }}
            onAllYears={() => { setStartDate(safeStart); setEndDate(safeEnd) }}
          />
          <p className="text-[10px] text-ink-500 font-mono">
            🔥 Heatmap : densité des points GPS. Plus c&apos;est chaud (jaune/orange), plus tu y as passé de temps.
            Slider = filtre année par année pour voir l&apos;évolution dans le temps.
          </p>
        </>
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
      <div className="panel p-3 flex flex-col sm:flex-row sm:flex-wrap gap-3 sm:items-end">
        <div className="min-w-0">
          <label className="block text-[10px] font-semibold uppercase tracking-wider text-ink-400 mb-1">Type</label>
          <div className="tabs-scrollable sm:flex-wrap">
            {SEMANTIC_FILTER_OPTIONS.map((o) => (
              <button key={o.id} onClick={() => { setSemanticFilter(o.id); setPage(0) }}
                className={cn('px-2 py-1 rounded-md text-xs border transition-colors whitespace-nowrap shrink-0',
                  semanticFilter === o.id ? 'bg-accent/15 border-accent/40 text-accent'
                                          : 'bg-ink-800 border-ink-700 text-ink-300 hover:border-ink-600')}>
                {o.label}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:gap-3">
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-ink-400 mb-1">Du</label>
            <input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setPage(0) }}
              className="bg-ink-800 border border-ink-700 rounded-md px-3 py-1.5 text-sm font-mono w-full sm:w-auto" />
          </div>
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-ink-400 mb-1">Au</label>
            <input type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setPage(0) }}
              className="bg-ink-800 border border-ink-700 rounded-md px-3 py-1.5 text-sm font-mono w-full sm:w-auto" />
          </div>
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
          className="px-4 py-2.5 text-sm border border-ink-700 rounded-md disabled:opacity-40 hover:border-ink-600 transition-colors min-h-[44px]">
          ← Précédent
        </button>
        <span className="text-xs text-ink-400 font-mono px-2">Page {page + 1}</span>
        <button disabled={(visits?.length ?? 0) < PAGE_SIZE} onClick={() => setPage((p) => p + 1)}
          className="px-4 py-2.5 text-sm border border-ink-700 rounded-md disabled:opacity-40 hover:border-ink-600 transition-colors min-h-[44px]">
          Suivant →
        </button>
      </div>
    </div>
  )
}

function VisitRow({ visit, idx, swrKey }: { visit: LocationVisit; idx: number; swrKey: unknown[] }) {
  const meta = getSemanticMeta(visit.semantic_type)
  const Icon = meta.icon
  // Lookup adresse depuis le cache global SWR (partage avec CarteTab)
  const { data: addressesData } = useSWR('addresses-index', () => api.locations.addresses(),
    { revalidateOnFocus: false })
  const addr = useMemo(() => {
    if (!addressesData) return null
    const lookup = buildAddressLookup(addressesData.addresses)
    return lookup(parseFloat(visit.lat), parseFloat(visit.lng))
  }, [addressesData, visit.lat, visit.lng])
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
          {addr?.label && (
            <span className="text-xs text-amber-300 truncate max-w-[60%]">📍 {addr.label}</span>
          )}
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
  const { data: stats }       = useSWR('locations-stats',  () => api.locations.stats())
  const { data: actStats }    = useSWR('activity-stats',   () => api.locations.activityStats())
  const { data: yearStats }   = useSWR('visits-by-year',   () => api.locations.visitsByYear())
  const { data: topPlaces }   = useSWR('top-places',       () => api.locations.topPlaces({ limit: 10 }))
  const { data: streaksData } = useSWR('streaks',          () => api.locations.streaks())
  const { data: gapsData }    = useSWR('gaps-72',          () => api.locations.gaps({ min_hours: 72, limit: 10 }))
  const { data: workDetect }  = useSWR('auto-work-12',     () => api.locations.autoDetectWork(12))
  const { data: yearComp }    = useSWR('year-comp',        () => api.locations.yearComparison())
  const { data: regions }     = useSWR('regions',          () => api.locations.regions())

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
          <div className="text-[10px] font-semibold uppercase tracking-wider text-ink-400 mb-3">
            Visites par année — {yearStats.reduce((s, y) => s + y.visits, 0).toLocaleString('fr-CA')} au total
          </div>

          <div className="flex items-stretch gap-1.5 h-40 pb-1">
            {yearStats.map((y) => {
              const pct     = (y.visits / maxYearVisits) * 100
              const homePct = y.visits > 0 ? (y.home_visits / y.visits) * 100 : 0
              const workPct = y.visits > 0 ? (y.work_visits / y.visits) * 100 : 0
              return (
                <div key={y.year} className="flex-1 flex flex-col items-center gap-1 min-w-[28px] group cursor-default relative">
                  {/* Tooltip count visible au hover */}
                  <span className="text-[10px] font-mono text-ink-300 opacity-0 group-hover:opacity-100 transition-opacity h-3.5">
                    {y.visits.toLocaleString('fr-CA')}
                  </span>
                  {/* Container bar : flex-1 prend tout l'espace vertical restant */}
                  <div className="flex-1 w-full flex flex-col justify-end">
                    <div className="relative w-full rounded-t overflow-hidden transition-all group-hover:brightness-125"
                      style={{ height: `${Math.max(pct, 2)}%`, backgroundColor: '#8b95a330', minHeight: 4 }}>
                      <div className="absolute bottom-0 left-0 right-0 transition-all"
                        style={{ height: `${homePct}%`, backgroundColor: '#5cdb95' }} />
                      <div className="absolute left-0 right-0 transition-all"
                        style={{ bottom: `${homePct}%`, height: `${workPct}%`, backgroundColor: '#5fb3f4' }} />
                    </div>
                  </div>
                  <span className="text-[9px] font-mono text-ink-500 group-hover:text-ink-200 transition-colors h-3">
                    {String(y.year).slice(2)}
                  </span>
                </div>
              )
            })}
          </div>

          <div className="flex items-center gap-4 mt-3 text-[10px] text-ink-500">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{backgroundColor:'#5cdb95'}} />Domicile ({yearStats.reduce((s, y) => s + y.home_visits, 0).toLocaleString('fr-CA')})</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{backgroundColor:'#5fb3f4'}} />Travail ({yearStats.reduce((s, y) => s + y.work_visits, 0).toLocaleString('fr-CA')})</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{backgroundColor:'#8b95a330',border:'1px solid #8b95a3'}} />Autres lieux</span>
          </div>
        </div>
      )}

      {/* ── Top 10 lieux ───────────────────────────────────────────────── */}
      {topPlaces && topPlaces.places.length > 0 && (
        <div className="panel p-4 col-span-1 md:col-span-2">
          <div className="flex items-center gap-1.5 mb-3">
            <Trophy size={12} className="text-amber-400" />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-400">
              Top 10 lieux les plus visités
            </span>
            <span className="text-[10px] font-mono text-ink-600 ml-auto">précision {topPlaces.bin_size_meters}m</span>
          </div>
          <div className="space-y-1.5">
            {topPlaces.places.map((p, i) => {
              const meta = SEMANTIC_META[p.semantic_types[0] ?? 'UNKNOWN'] ?? SEMANTIC_META.UNKNOWN
              const Icon = meta.icon
              const totalH = Math.round(p.total_minutes / 60)
              const maxCount = topPlaces.places[0].visit_count
              const pct = (p.visit_count / maxCount) * 100
              return (
                <motion.div key={`${p.lat}-${p.lng}`}
                  initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="flex items-center gap-2.5 p-2 rounded-md bg-ink-800/40 hover:bg-ink-800/80 transition-colors group cursor-default">
                  <span className="w-6 text-center text-xs font-mono font-bold"
                    style={{ color: i === 0 ? '#fbbf24' : i < 3 ? '#fb923c' : '#8b95a3' }}>#{i + 1}</span>
                  <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0"
                    style={{ backgroundColor: meta.hex + '22' }}>
                    <Icon size={12} style={{ color: meta.hex }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-semibold" style={{ color: meta.hex }}>{meta.label}</span>
                      <span className="text-[10px] font-mono text-ink-500 truncate">
                        {p.lat.toFixed(4)}°, {p.lng.toFixed(4)}°
                      </span>
                    </div>
                    <div className="text-[10px] font-mono text-ink-500 mt-0.5">
                      {p.first_visit?.slice(0, 4)} → {p.last_visit?.slice(0, 4)}
                      {' · '}{totalH > 24 ? `${Math.floor(totalH / 24)}j ${totalH % 24}h` : `${totalH}h`}
                    </div>
                    <div className="h-1 mt-1 bg-ink-800 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, backgroundColor: meta.hex }} />
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-base font-bold font-mono leading-none" style={{ color: meta.hex }}>
                      {p.visit_count.toLocaleString('fr-CA')}
                    </div>
                    <div className="text-[9px] text-ink-500">visites</div>
                  </div>
                </motion.div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Streaks ────────────────────────────────────────────────────── */}
      {streaksData && streaksData.streaks.length > 0 && (
        <div className="panel p-4">
          <div className="flex items-center gap-1.5 mb-3">
            <Award size={12} className="text-amber-400" />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-400">Records</span>
          </div>
          <div className="space-y-2">
            {streaksData.streaks.map((s, i) => (
              <motion.div key={s.label}
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="p-2.5 rounded-md bg-ink-800/40 border border-ink-700/40">
                <div className="flex items-end justify-between gap-2">
                  <div className="text-xs text-ink-300">{s.label}</div>
                  <div className="text-lg font-bold font-mono leading-none text-amber-400">
                    {s.value.toLocaleString('fr-CA')}<span className="text-[10px] text-ink-500 ml-1">{s.unit}</span>
                  </div>
                </div>
                {(s.period_start || s.description) && (
                  <div className="text-[10px] text-ink-500 font-mono mt-1.5">
                    {s.period_start && (
                      <span>{s.period_start} → {s.period_end ?? s.period_start}</span>
                    )}
                    {s.description && (
                      <span className="text-ink-600 ml-2">{s.description}</span>
                    )}
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* ── Auto-detect WORK ───────────────────────────────────────────── */}
      {workDetect && workDetect.detected && (
        <div className="panel p-4 border-blue-500/30">
          <div className="flex items-center gap-1.5 mb-3">
            <Briefcase size={12} className="text-blue-400" />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-400">
              Lieu de travail probable
            </span>
            <span className="text-[10px] font-mono text-ink-600 ml-auto">
              {Math.round(workDetect.confidence * 100)}% confiance
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg flex items-center justify-center shrink-0 bg-blue-500/15 border border-blue-500/30">
              <Briefcase size={20} className="text-blue-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-mono text-sm text-ink-100">
                {workDetect.lat?.toFixed(5)}°, {workDetect.lng?.toFixed(5)}°
              </div>
              <div className="text-[10px] text-ink-400 mt-0.5">{workDetect.label}</div>
              <p className="text-[10px] text-ink-500 mt-1.5">
                💡 Va dans <span className="text-accent">Mes Lieux</span> et utilise ces coords pour retag toutes les visites comme WORK.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Regions visited (countries / cities) ───────────────────────── */}
      {regions && regions.countries_count > 0 && <RegionsPanel regions={regions} />}

      {/* ── Year-over-year comparison ──────────────────────────────────── */}
      {yearComp && yearComp.years.length >= 2 && (
        <div className="panel p-4 col-span-full">
          <YearComparePanel years={yearComp.years} />
        </div>
      )}

      {/* ── Data gaps ──────────────────────────────────────────────────── */}
      {gapsData && gapsData.gaps.length > 0 && (
        <div className="panel p-4 col-span-full">
          <div className="flex items-center gap-1.5 mb-3">
            <AlertTriangle size={12} className="text-amber-400" />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-400">
              Trous de données &gt;72h
            </span>
            <span className="text-[10px] font-mono text-ink-500 ml-auto">
              {gapsData.total_gaps} trous · {Math.round(gapsData.total_missing_hours / 24)}j de données manquantes au total
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
            {gapsData.gaps.slice(0, 10).map((g, i) => (
              <motion.div key={i}
                initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.02 }}
                className="p-2 rounded-md bg-amber-500/5 border border-amber-500/30">
                <div className="text-[10px] font-mono text-amber-400 font-semibold">
                  {g.duration_days >= 1 ? `${g.duration_days}j ${Math.round(g.duration_hours % 24)}h` : `${Math.round(g.duration_hours)}h`}
                </div>
                <div className="text-[10px] font-mono text-ink-500 mt-0.5">
                  {g.start_time.slice(0, 10)}
                </div>
                <div className="text-[10px] font-mono text-ink-600">
                  → {g.end_time.slice(0, 10)}
                </div>
              </motion.div>
            ))}
          </div>
          <p className="text-[10px] text-ink-500 mt-2 font-mono">
            💡 Téléphone éteint, pays sans GPS, batterie morte, ou simplement pas d&apos;app Google Maps active.
          </p>
        </div>
      )}
    </div>
  )
}

function StatBlock({ icon: Icon, label, value, hex }: {
  icon: LucideIcon; label: string; value: string; hex: string
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
  icon: LucideIcon; label: string; value: string; sub: string; hex: string
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
            💡 Astuce : tu peux aussi <strong className="text-accent">cliquer sur la carte</strong> dans l&apos;onglet &quot;Carte GPS&quot; pour copier les coordonnées d&apos;un lieu.
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
        {/* Lieux nommes en haut */}
        <NamedPlacesPanel />

        {/* Batch geocoding */}
        <BatchGeocodeButton />

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

// ─── InsightsBar (AI proactive, clickable) ────────────────────────────────────

function InsightsBar() {
  const { data: insights } = useSWR('insights', () => api.locations.insights())
  const [selected, setSelected] = useState<import('@/lib/api').Insight | null>(null)
  if (!insights || insights.insights.length === 0) return null

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
        {insights.insights.slice(0, 5).map((i, idx) => (
          <motion.button key={`${i.title}-${idx}`}
            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
            onClick={() => setSelected(i)}
            whileHover={{ scale: 1.02, y: -2 }}
            className="panel p-2.5 group transition-all text-left"
            style={{ borderColor: i.color + '40' }}>
            <div className="flex items-start gap-2">
              <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0"
                style={{ backgroundColor: i.color + '22', color: i.color }}>
                <Sparkles size={13} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[10px] uppercase tracking-wider font-semibold text-ink-400 truncate">
                  {i.title}
                </div>
                {i.metric !== null && (
                  <div className="text-base font-bold font-mono leading-none mt-0.5"
                    style={{ color: i.color }}>
                    {i.metric}{i.metric_unit && <span className="text-[10px] ml-0.5">{i.metric_unit}</span>}
                  </div>
                )}
                <div className="text-[10px] text-ink-500 mt-1 line-clamp-2">
                  {i.description}
                </div>
              </div>
            </div>
          </motion.button>
        ))}
      </div>

      <AnimatePresence>
        {selected && <InsightModal insight={selected} onClose={() => setSelected(null)} />}
      </AnimatePresence>
    </>
  )
}

function InsightModal({ insight, onClose }: { insight: import('@/lib/api').Insight; onClose: () => void }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
        className="panel w-full max-w-md p-5 space-y-3"
        style={{ borderColor: insight.color + '60' }}>
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: insight.color + '22' }}>
            <Sparkles size={20} style={{ color: insight.color }} />
          </div>
          <div className="flex-1">
            <h3 className="text-base font-bold text-ink-100">{insight.title}</h3>
            {insight.metric !== null && (
              <div className="text-2xl font-bold font-mono leading-none mt-1" style={{ color: insight.color }}>
                {insight.metric}{insight.metric_unit && <span className="text-sm ml-1">{insight.metric_unit}</span>}
              </div>
            )}
          </div>
          <button onClick={onClose} className="text-ink-500 hover:text-ink-200">
            <X size={16} />
          </button>
        </div>
        <p className="text-sm text-ink-300 leading-relaxed">{insight.description}</p>
        {insight.cta_question && (
          <div className="pt-3 border-t border-ink-800/60">
            <div className="text-[10px] uppercase tracking-wider font-semibold text-ink-400 mb-1.5">
              Question suggérée
            </div>
            <a href={`/?q=${encodeURIComponent(insight.cta_question)}`}
              className="block px-3 py-2 rounded-md bg-ink-800 border border-ink-700 hover:border-accent/50 transition-colors text-sm text-ink-200 font-mono">
              💬 {insight.cta_question}
              <span className="block text-[10px] text-accent mt-1">→ Demander à l&apos;IA</span>
            </a>
          </div>
        )}
      </motion.div>
    </motion.div>
  )
}

// ─── RegionsPanel (avec drill-down par pays) ──────────────────────────────────

function RegionsPanel({ regions }: { regions: import('@/lib/api').RegionsResponse }) {
  const [selected, setSelected] = useState<import('@/lib/api').CountryStat | null>(null)

  return (
    <>
      <div className="panel p-4 col-span-full">
        <div className="flex items-center gap-1.5 mb-3 flex-wrap">
          <Globe size={12} className="text-sky-400" />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-400">
            Pays & villes visités
          </span>
          <div className="flex items-center gap-3 ml-auto text-xs">
            <span className="font-mono">
              <span className="text-sky-400 text-base font-bold">{regions.countries_count}</span>
              <span className="text-ink-500 ml-1">pays</span>
            </span>
            <span className="font-mono">
              <span className="text-amber-400 text-base font-bold">{regions.cities_count}</span>
              <span className="text-ink-500 ml-1">villes</span>
            </span>
            <span className="text-[10px] font-mono text-ink-600">
              ({regions.cells_geocoded.toLocaleString('fr-CA')} cellules)
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
          {regions.countries.slice(0, 16).map((c, i) => (
            <motion.button key={c.country}
              initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.02 }}
              onClick={() => setSelected(c)}
              whileHover={{ y: -2 }}
              className="p-2.5 rounded-md bg-ink-800/40 border border-ink-700/40 hover:border-sky-400/50 transition-colors text-left">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-mono uppercase text-ink-500 w-6">{c.country_code ?? '?'}</span>
                <span className="text-xs font-semibold text-ink-200 truncate flex-1">{c.country}</span>
                <span className="text-[10px] font-mono text-sky-400">{c.cities.length} ville{c.cities.length > 1 ? 's' : ''}</span>
              </div>
              <div className="text-[10px] text-ink-500 font-mono mt-1">
                <span className="text-accent">{c.visit_count.toLocaleString('fr-CA')}</span> visites
                <span className="ml-1.5 text-ink-600">click pour villes →</span>
              </div>
              {c.cities.length > 0 && (
                <div className="text-[10px] text-ink-400 mt-1 truncate">
                  {c.cities.slice(0, 3).join(' · ')}{c.cities.length > 3 ? ' …' : ''}
                </div>
              )}
            </motion.button>
          ))}
        </div>
      </div>

      <AnimatePresence>
        {selected && <CountryDrillDown country={selected} onClose={() => setSelected(null)} />}
      </AnimatePresence>
    </>
  )
}

function CountryDrillDown({ country, onClose }: {
  country: import('@/lib/api').CountryStat; onClose: () => void
}) {
  // Charge les addresses du pays pour ranker les villes par fréquence
  const { data } = useSWR(['country-cities', country.country_code], () =>
    api.locations.addresses(country.country_code ?? undefined))

  const cityCounts = useMemo(() => {
    if (!data) return []
    const m = new Map<string, number>()
    for (const a of data.addresses) {
      if (!a.city) continue
      m.set(a.city, (m.get(a.city) ?? 0) + 1)
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1])
  }, [data])

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
        className="panel w-full max-w-lg p-5 space-y-3 max-h-[85vh] overflow-y-auto">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="text-3xl">{flagEmoji(country.country_code)}</div>
            <div>
              <h3 className="text-base font-bold text-ink-100">{country.country}</h3>
              <div className="text-[10px] font-mono text-ink-500 mt-0.5">
                {country.visit_count.toLocaleString('fr-CA')} visites · {cityCounts.length} ville{cityCounts.length > 1 ? 's' : ''}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="text-ink-500 hover:text-ink-200">
            <X size={16} />
          </button>
        </div>

        <div>
          <div className="text-[10px] uppercase tracking-wider font-semibold text-ink-400 mb-2">
            Villes par fréquence (cellules géocodées)
          </div>
          <div className="space-y-1 max-h-[400px] overflow-y-auto">
            {cityCounts.map(([city, count], idx) => {
              const max = cityCounts[0]?.[1] ?? 1
              const pct = (count / max) * 100
              return (
                <div key={city} className="relative flex items-center gap-2 px-2 py-1.5 rounded text-xs hover:bg-ink-800/50">
                  <span className="w-5 text-right font-mono text-ink-600 text-[10px]">{idx + 1}</span>
                  <span className="flex-1 truncate">{city}</span>
                  <span className="font-mono text-sky-400">{count}</span>
                  <div className="absolute bottom-0 left-7 right-12 h-0.5 bg-sky-500/20 rounded-full overflow-hidden">
                    <div className="h-full bg-sky-400 rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
            {cityCounts.length === 0 && (
              <p className="text-xs text-ink-500 italic text-center py-4">
                Géocodage en cours… revient quand le worker aura traité ce pays.
              </p>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}

function flagEmoji(code: string | null): string {
  if (!code || code.length !== 2) return '🌍'
  const a = 0x1F1E6
  return String.fromCodePoint(a + (code.toUpperCase().charCodeAt(0) - 65))
       + String.fromCodePoint(a + (code.toUpperCase().charCodeAt(1) - 65))
}

// ─── HeatmapYearSlider ────────────────────────────────────────────────────────

function HeatmapYearSlider({ startYear, endYear, currentStart, currentEnd, onChangeYear, onAllYears }: {
  startYear: number; endYear: number
  currentStart: string; currentEnd: string
  onChangeYear: (y: number) => void
  onAllYears: () => void
}) {
  const years: number[] = []
  for (let y = startYear; y <= endYear; y++) years.push(y)

  // Detecte si on est en mode "year filter" (start = Y-01-01, end = Y-12-31)
  const startY = parseInt(currentStart.slice(0, 4))
  const endY = parseInt(currentEnd.slice(0, 4))
  const isAllYears = startY === startYear && endY === endYear
  const selectedYear = (!isAllYears && startY === endY) ? startY : null

  return (
    <div className="panel p-3 flex items-center gap-2 flex-wrap">
      <span className="text-[10px] uppercase tracking-wider font-semibold text-ink-400">
        Année
      </span>
      <button onClick={onAllYears}
        className={cn('px-2.5 py-1 text-xs font-mono rounded transition-colors',
          isAllYears ? 'bg-accent text-ink-900 font-bold'
                     : 'bg-ink-800 border border-ink-700 text-ink-400 hover:border-ink-500')}>
        TOUT
      </button>
      <div className="flex-1 flex items-center gap-1 min-w-[280px]">
        {years.map((y) => {
          const active = selectedYear === y
          return (
            <button key={y} onClick={() => onChangeYear(y)}
              className={cn('flex-1 min-w-0 py-1 text-[10px] font-mono rounded transition-all',
                active ? 'bg-amber-500 text-ink-900 font-bold scale-110'
                       : 'bg-ink-800 border border-ink-700 text-ink-400 hover:border-amber-500/50 hover:text-amber-400')}>
              {String(y).slice(2)}
            </button>
          )
        })}
      </div>
      {selectedYear && (
        <span className="text-[10px] font-mono text-amber-400">
          Filtré sur {selectedYear}
        </span>
      )}
    </div>
  )
}

// ─── YearComparePanel ─────────────────────────────────────────────────────────

const MONTH_LABELS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc']
const COMPARE_COLORS = ['#5cdb95', '#5fb3f4', '#fbbf24', '#c084fc']

function YearComparePanel({ years }: { years: { year: number; monthly_visits: number[] }[] }) {
  // Exclut l'annee courante (incomplete) du choix par defaut
  const currentYear = new Date().getFullYear()
  const sortedYears = useMemo(() => [...years].sort((a, b) => b.year - a.year), [years])
  // Pour les defaults, prend les 2 dernieres annees COMPLETES
  const completeYears = sortedYears.filter(y => y.year < currentYear)
  const defaultA = completeYears[0]?.year ?? sortedYears[0]?.year
  const defaultB = completeYears[1]?.year ?? completeYears[0]?.year ?? sortedYears[0]?.year

  const [yearA, setYearA] = useState(defaultA)
  const [yearB, setYearB] = useState(defaultB)
  const [yearC, setYearC] = useState<number | null>(null)

  const dataA = years.find(y => y.year === yearA)
  const dataB = years.find(y => y.year === yearB)
  const dataC = yearC ? years.find(y => y.year === yearC) : null

  const max = useMemo(() => {
    const all: number[] = []
    if (dataA) all.push(...dataA.monthly_visits)
    if (dataB) all.push(...dataB.monthly_visits)
    if (dataC) all.push(...dataC.monthly_visits)
    return Math.max(1, ...all)
  }, [dataA, dataB, dataC])

  const totals = {
    A: dataA?.monthly_visits.reduce((s, v) => s + v, 0) ?? 0,
    B: dataB?.monthly_visits.reduce((s, v) => s + v, 0) ?? 0,
    C: dataC?.monthly_visits.reduce((s, v) => s + v, 0) ?? 0,
  }
  const diffPct = totals.B > 0 ? Math.round(((totals.A - totals.B) / totals.B) * 100) : 0

  return (
    <>
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        <BarChart3 size={12} className="text-accent" />
        <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-400">
          Comparaison année par année
        </span>
        <div className="flex items-center gap-2 ml-auto flex-wrap">
          <YearChip color={COMPARE_COLORS[0]} label="A" year={yearA} years={sortedYears} onChange={setYearA} />
          <YearChip color={COMPARE_COLORS[1]} label="B" year={yearB} years={sortedYears} onChange={setYearB} />
          {yearC === null ? (
            <button onClick={() => setYearC(sortedYears[2]?.year ?? sortedYears[0]?.year)}
              className="text-[10px] text-ink-500 hover:text-accent transition-colors px-2 py-1 border border-ink-700 rounded">
              + 3e année
            </button>
          ) : (
            <YearChip color={COMPARE_COLORS[2]} label="C" year={yearC} years={sortedYears} onChange={setYearC}
              onRemove={() => setYearC(null)} />
          )}
        </div>
      </div>

      {/* Bars : 12 mois, par mois 2-3 sub-bars groupees */}
      <div className="grid grid-cols-12 gap-2 h-32">
        {Array.from({ length: 12 }).map((_, m) => {
          const valA = dataA?.monthly_visits[m] ?? 0
          const valB = dataB?.monthly_visits[m] ?? 0
          const valC = dataC?.monthly_visits[m] ?? 0
          const maxV = Math.max(valA, valB, valC)
          const winnerColor = maxV === valA ? COMPARE_COLORS[0]
                          : maxV === valC ? COMPARE_COLORS[2]
                          : COMPARE_COLORS[1]
          return (
            <div key={m} className="flex flex-col items-center group">
              <div className="text-[9px] font-mono text-ink-600 group-hover:text-ink-200 transition-colors h-3 leading-3">
                {maxV > 0 ? maxV.toLocaleString('fr-CA') : ''}
              </div>
              <div className="flex-1 w-full flex items-end justify-center gap-px">
                <Bar value={valA} max={max} color={COMPARE_COLORS[0]} />
                <Bar value={valB} max={max} color={COMPARE_COLORS[1]} />
                {dataC && <Bar value={valC} max={max} color={COMPARE_COLORS[2]} />}
              </div>
              <div className="text-[9px] font-mono text-ink-500 mt-1" style={{ color: winnerColor }}>
                {MONTH_LABELS[m]}
              </div>
            </div>
          )
        })}
      </div>

      {/* Totaux + diff */}
      <div className="flex items-center gap-4 mt-3 text-xs flex-wrap">
        <span className="font-mono">
          <span style={{ color: COMPARE_COLORS[0] }}>● {yearA}</span>
          {' '}<span className="text-ink-400">{totals.A.toLocaleString('fr-CA')} visites</span>
        </span>
        <span className="font-mono">
          <span style={{ color: COMPARE_COLORS[1] }}>● {yearB}</span>
          {' '}<span className="text-ink-400">{totals.B.toLocaleString('fr-CA')} visites</span>
        </span>
        {yearC !== null && (
          <span className="font-mono">
            <span style={{ color: COMPARE_COLORS[2] }}>● {yearC}</span>
            {' '}<span className="text-ink-400">{totals.C.toLocaleString('fr-CA')} visites</span>
          </span>
        )}
        {totals.B > 0 && (
          <span className={cn('font-mono ml-auto px-2 py-0.5 rounded',
            diffPct >= 0 ? 'text-accent bg-accent/10' : 'text-amber-400 bg-amber-500/10')}>
            {yearA} {diffPct >= 0 ? '+' : ''}{diffPct}% vs {yearB}
          </span>
        )}
      </div>
    </>
  )
}

function Bar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = (value / max) * 100
  return (
    <div className="flex-1 min-w-[3px]" style={{ height: `${Math.max(pct, value > 0 ? 2 : 0)}%` }}>
      <div className="w-full h-full rounded-t transition-all hover:brightness-125" style={{ backgroundColor: color }} />
    </div>
  )
}

function YearChip({ color, label, year, years, onChange, onRemove }: {
  color: string; label: string; year: number
  years: { year: number }[]; onChange: (y: number) => void; onRemove?: () => void
}) {
  return (
    <div className="flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded border border-ink-700 bg-ink-800/50">
      <span style={{ color }}>● {label}</span>
      <select value={year} onChange={(e) => onChange(Number(e.target.value))}
        className="bg-transparent border-0 outline-none text-ink-200 text-[10px] font-mono cursor-pointer">
        {years.map((y) => (
          <option key={y.year} value={y.year} className="bg-ink-900">{y.year}</option>
        ))}
      </select>
      {onRemove && (
        <button onClick={onRemove} className="text-ink-500 hover:text-red-400 transition-colors">×</button>
      )}
    </div>
  )
}

// ─── TileSelector (overlay top-left) ──────────────────────────────────────────

const TILE_OPTIONS: Array<{ id: TileStyle; label: string; icon: LucideIcon }> = [
  { id: 'dark',      label: 'Dark',      icon: MapIcon   },
  { id: 'street',    label: 'Voyager',   icon: Globe     },
  { id: 'satellite', label: 'Satellite', icon: Satellite },
  { id: 'topo',      label: 'Topo',      icon: TrendingUp },
]

function TileSelector({ value, onChange }: { value: TileStyle; onChange: (v: TileStyle) => void }) {
  return (
    <div className="absolute top-2 left-2 z-[600] panel p-1 flex gap-0.5 border-ink-700/50">
      {TILE_OPTIONS.map((t) => {
        const TIcon = t.icon
        const active = value === t.id
        return (
          <button key={t.id} onClick={() => onChange(t.id)}
            title={t.label}
            className={cn('px-2 py-1 rounded text-[10px] font-semibold transition-colors flex items-center gap-1',
              active ? 'bg-accent/20 text-accent' : 'text-ink-400 hover:text-ink-200 hover:bg-ink-800/50')}>
            <TIcon size={10} />
            <span className="hidden sm:inline">{t.label}</span>
          </button>
        )
      })}
    </div>
  )
}

// ─── SemanticLegend (overlay bottom-left, interactive) ────────────────────────

const LEGEND_ORDER: Array<{ type: string; label: string; icon: LucideIcon; hex: string }> = [
  { type: 'HOME',             label: 'Domicile',  icon: Home,       hex: '#5cdb95' },
  { type: 'INFERRED_HOME',    label: 'Dom. inf.', icon: Home,       hex: '#3db37a' },
  { type: 'WORK',             label: 'Travail',   icon: Briefcase,  hex: '#5fb3f4' },
  { type: 'INFERRED_WORK',    label: 'Trav. inf.', icon: Briefcase, hex: '#3a8fd6' },
  { type: 'SEARCHED_ADDRESS', label: 'Adresse',   icon: Navigation, hex: '#ffb84d' },
  { type: 'ALIASED_LOCATION', label: 'Favori',    icon: Sparkles,   hex: '#c084fc' },
  { type: 'UNKNOWN',          label: 'Autre',     icon: MapPin,     hex: '#8b95a3' },
]

function SemanticLegend({ visits, active, onChange }: {
  visits: LocationVisit[]
  active: string | null
  onChange: (v: string | null) => void
}) {
  const counts = useMemo(() => {
    const c: Record<string, number> = {}
    for (const v of visits) {
      const k = v.semantic_type ?? 'UNKNOWN'
      c[k] = (c[k] ?? 0) + 1
    }
    return c
  }, [visits])

  const sortedItems = useMemo(
    () => LEGEND_ORDER.filter((l) => (counts[l.type] ?? 0) > 0),
    [counts]
  )

  if (sortedItems.length === 0) return null

  return (
    <div className="absolute bottom-2 left-2 z-[600] panel p-2 border-ink-700/50 flex flex-col gap-0.5 max-h-[60%] overflow-y-auto"
      style={{ backgroundColor: 'rgba(13,17,23,0.85)', backdropFilter: 'blur(6px)' }}>
      <div className="flex items-center justify-between px-1 pb-1 mb-0.5 border-b border-ink-800/60">
        <span className="text-[9px] uppercase tracking-wider font-semibold text-ink-400">Légende</span>
        {active && (
          <button onClick={() => onChange(null)}
            className="text-[9px] text-accent hover:underline">tout</button>
        )}
      </div>
      {sortedItems.map((l) => {
        const Icon = l.icon
        const isActive = active === l.type
        const isDimmed = active !== null && !isActive
        return (
          <button key={l.type}
            onClick={() => onChange(isActive ? null : l.type)}
            className={cn('flex items-center gap-2 px-1.5 py-1 rounded transition-all',
              isActive ? 'bg-ink-800/80' : 'hover:bg-ink-800/50',
              isDimmed && 'opacity-40')}>
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: l.hex }} />
            <Icon size={10} style={{ color: l.hex }} />
            <span className="text-[10px] flex-1 text-left" style={{ color: isActive ? l.hex : '#cbd5e1' }}>{l.label}</span>
            <span className="text-[10px] font-mono text-ink-500">{(counts[l.type] ?? 0).toLocaleString('fr-CA')}</span>
          </button>
        )
      })}
    </div>
  )
}

function MiniVisitRow({ visit }: { visit: LocationVisit }) {
  const { data: addressesData } = useSWR('addresses-index', () => api.locations.addresses(),
    { revalidateOnFocus: false })
  const addr = useMemo(() => {
    if (!addressesData) return null
    return buildAddressLookup(addressesData.addresses)(parseFloat(visit.lat), parseFloat(visit.lng))
  }, [addressesData, visit.lat, visit.lng])

  const start = new Date(visit.start_time)
  const end   = new Date(visit.end_time)
  const durationMin = Math.round((end.getTime() - start.getTime()) / 60000)
  return (
    <div className="flex items-center gap-2 text-xs font-mono py-0.5">
      <span className="text-ink-500 shrink-0 w-16">
        {start.toLocaleDateString('fr-CA', { day: 'numeric', month: 'short', year: '2-digit' })}
      </span>
      <span className="text-ink-600">·</span>
      <span className={cn('truncate flex-1', addr ? 'text-amber-300' : 'text-ink-400')}
        title={addr?.label ?? `${parseFloat(visit.lat).toFixed(4)}, ${parseFloat(visit.lng).toFixed(4)}`}>
        {addr?.label ?? `${parseFloat(visit.lat).toFixed(4)}°, ${parseFloat(visit.lng).toFixed(4)}°`}
      </span>
      <span className="text-ink-600 shrink-0">
        {durationMin < 60 ? `${durationMin}min` : `${Math.floor(durationMin/60)}h`}
      </span>
    </div>
  )
}
