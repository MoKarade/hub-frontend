'use client'

import { Sidebar } from '@/components/sidebar'
import { HubStatus } from '@/components/hub-status'
import { Tabs, useActiveTab, type TabItem } from '@/components/tabs'
import {
  MapPin,
  Home,
  Briefcase,
  Navigation,
  Car,
  Train,
  Footprints,
  Plane,
  Bike,
  Map as MapIcon,
  List,
  Globe,
  Calendar,
  TrendingUp,
  RefreshCw,
  Upload,
  Layers,
  Sparkles,
} from 'lucide-react'
import dynamic from 'next/dynamic'
import { useMemo, useState, useCallback, type ComponentType } from 'react'
import useSWR, { mutate } from 'swr'
import { api, type LocationVisit, type LocationPoint } from '@/lib/api'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'

// Carte chargée uniquement côté client (Leaflet touche window)
const LocationMap = dynamic(() => import('@/components/location-map').then(m => ({ default: m.LocationMap })), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full flex items-center justify-center text-ink-400 text-sm font-mono">
      Chargement de la carte…
    </div>
  ),
})

// ─── Constantes ──────────────────────────────────────────────────────────────

const TABS: TabItem[] = [
  { id: 'carte',   label: 'Carte GPS',    icon: MapIcon },
  { id: 'visites', label: 'Visites',      icon: MapPin  },
  { id: 'stats',   label: 'Stats',        icon: TrendingUp },
]

const SEMANTIC_META: Record<string, { label: string; icon: ComponentType<{ size?: number; className?: string }>; hex: string }> = {
  HOME:              { label: 'Domicile',      icon: Home,       hex: '#5cdb95' },
  INFERRED_HOME:     { label: 'Domicile (inf)', icon: Home,      hex: '#3db37a' },
  WORK:              { label: 'Travail',       icon: Briefcase,  hex: '#5fb3f4' },
  INFERRED_WORK:     { label: 'Travail (inf)', icon: Briefcase,  hex: '#3a8fd6' },
  SEARCHED_ADDRESS:  { label: 'Adresse',       icon: Navigation, hex: '#ffb84d' },
  ALIASED_LOCATION:  { label: 'Favori',        icon: Sparkles,   hex: '#c084fc' },
  UNKNOWN:           { label: 'Lieu',          icon: MapPin,     hex: '#8b95a3' },
}

function getSemanticMeta(type: string | null) {
  return SEMANTIC_META[type ?? 'UNKNOWN'] ?? SEMANTIC_META.UNKNOWN
}

// ─── Page principale ─────────────────────────────────────────────────────────

export default function LocationsPage() {
  const activeTab = useActiveTab(TABS, 'tab', 'carte')

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 px-4 sm:px-6 lg:px-8 pt-16 lg:pt-6 pb-6 max-w-[1400px] flex flex-col gap-4">
        <header className="flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
              <Globe size={22} className="text-accent" />
              Localisation
            </h1>
            <p className="text-sm text-ink-400 mt-0.5 font-mono">
              Google Maps Timeline · 2013 → 2026
            </p>
          </div>
          <IngestButton />
        </header>

        <GlobalStatsStrip />

        <Tabs items={TABS} defaultId="carte" />

        {activeTab === 'carte'   && <CarteTab />}
        {activeTab === 'visites' && <VisitesTab />}
        {activeTab === 'stats'   && <StatsTab />}

        <HubStatus />
      </main>
    </div>
  )
}

// ─── Strip stats globales ────────────────────────────────────────────────────

function GlobalStatsStrip() {
  const { data: stats } = useSWR('locations-stats', () => api.locations.stats())

  const tiles = useMemo(() => {
    if (!stats) return null
    return [
      { label: 'Visites totales', value: stats.total_visits.toLocaleString('fr-CA'), icon: MapPin, color: 'text-accent' },
      { label: 'Lieux uniques',   value: stats.unique_places.toLocaleString('fr-CA'), icon: Globe,  color: 'text-sky-400' },
      { label: 'Au domicile',     value: stats.home_visits.toLocaleString('fr-CA'),   icon: Home,   color: 'text-green-400' },
      { label: 'Au travail',      value: stats.work_visits.toLocaleString('fr-CA'),   icon: Briefcase, color: 'text-blue-400' },
      { label: 'Points GPS',      value: (stats.total_path_points / 1000).toFixed(1) + 'k', icon: Navigation, color: 'text-amber-400' },
      { label: 'Depuis',          value: stats.earliest_date?.slice(0, 4) ?? '—',    icon: Calendar, color: 'text-ink-300' },
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
          <motion.div
            key={t.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="panel px-3 py-2.5 flex flex-col gap-1"
          >
            <div className="flex items-center gap-1.5">
              <Icon size={12} className={t.color} />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-400">
                {t.label}
              </span>
            </div>
            <div className={cn('text-xl font-bold font-mono leading-none', t.color)}>
              {t.value}
            </div>
          </motion.div>
        )
      })}
    </div>
  )
}

// ─── Bouton ingest ───────────────────────────────────────────────────────────

function IngestButton() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  const handleIngest = useCallback(async () => {
    const path = prompt(
      'Chemin vers Timeline.json\n(ex: C:\\Users\\dessin14\\Downloads\\Timeline.json)',
      'C:\\Users\\dessin14\\Downloads\\Timeline.json'
    )
    if (!path) return
    setLoading(true)
    setResult(null)
    try {
      const res = await api.locations.ingestFile(path)
      setResult(
        `✓ ${res.visits_inserted} visites · ${res.points_inserted} points GPS · ${res.activities_inserted} activités · ${res.duration_seconds}s`
      )
      mutate('locations-stats')
    } catch (e: unknown) {
      setResult(`✗ ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setLoading(false)
    }
  }, [])

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handleIngest}
        disabled={loading}
        className={cn(
          'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold border transition-colors',
          loading
            ? 'opacity-50 cursor-not-allowed border-ink-700 text-ink-400'
            : 'border-accent/40 text-accent hover:bg-accent/10 active:scale-95'
        )}
      >
        {loading ? <RefreshCw size={12} className="animate-spin" /> : <Upload size={12} />}
        {loading ? 'Ingestion…' : 'Importer Timeline.json'}
      </button>
      {result && (
        <p className={cn('text-[10px] font-mono', result.startsWith('✓') ? 'text-accent' : 'text-red-400')}>
          {result}
        </p>
      )}
    </div>
  )
}

// ─── Tab Carte ───────────────────────────────────────────────────────────────

const ACTIVITY_FILTERS = [
  { id: '',                   label: 'Tous' },
  { id: 'google_timeline',    label: 'Timeline' },
]

function CarteTab() {
  const [startDate, setStartDate] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - 30)
    return d.toISOString().slice(0, 10)
  })
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [layer, setLayer] = useState<'points' | 'visits'>('visits')

  const { data: visits, isLoading: visitsLoading } = useSWR(
    layer === 'visits' ? ['loc-visits-map', startDate, endDate] : null,
    () => api.locations.visits.list({ start_date: startDate, end_date: endDate, limit: 2000 })
  )
  const { data: points, isLoading: pointsLoading } = useSWR(
    layer === 'points' ? ['loc-points-map', startDate, endDate] : null,
    () => api.locations.points.list({ start_date: startDate, end_date: endDate, limit: 5000, source: 'google_timeline' })
  )

  const isLoading = layer === 'visits' ? visitsLoading : pointsLoading
  const count = layer === 'visits' ? (visits?.length ?? 0) : (points?.length ?? 0)

  return (
    <div className="flex flex-col gap-3 flex-1">
      {/* Filtres */}
      <div className="panel p-3 grid grid-cols-2 md:grid-cols-4 gap-3 items-end">
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-wider text-ink-400 mb-1">Du</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full bg-ink-800 border border-ink-700 rounded-md px-3 py-1.5 text-sm font-mono"
          />
        </div>
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-wider text-ink-400 mb-1">Au</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full bg-ink-800 border border-ink-700 rounded-md px-3 py-1.5 text-sm font-mono"
          />
        </div>
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-wider text-ink-400 mb-1">Couche</label>
          <div className="flex gap-1">
            {(['visits', 'points'] as const).map((l) => (
              <button
                key={l}
                onClick={() => setLayer(l)}
                className={cn(
                  'flex-1 px-2 py-1.5 rounded-md text-xs border transition-colors',
                  layer === l
                    ? 'bg-accent/15 border-accent/40 text-accent'
                    : 'bg-ink-800 border-ink-700 text-ink-300 hover:border-ink-600'
                )}
              >
                {l === 'visits' ? <><MapPin size={10} className="inline mr-1" />Visites</> : <><Navigation size={10} className="inline mr-1" />Points GPS</>}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Layers size={13} className="text-ink-400" />
          <span className="text-xs text-ink-400 font-mono">
            {isLoading ? '…' : `${count.toLocaleString('fr-CA')} ${layer === 'visits' ? 'visites' : 'pts'}`}
          </span>
        </div>
      </div>

      {/* Carte */}
      <div className="panel overflow-hidden flex-1 min-h-[520px] relative">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-ink-950/60 z-10 text-sm text-ink-300 font-mono">
            Chargement…
          </div>
        )}
        <LocationMap
          points={layer === 'points' ? (points ?? []) : []}
          visits={layer === 'visits' ? (visits ?? []) : []}
        />
      </div>
    </div>
  )
}

// ─── Tab Visites ─────────────────────────────────────────────────────────────

const SEMANTIC_FILTER_OPTIONS = [
  { id: '',                 label: 'Tous' },
  { id: 'HOME',             label: '🏠 Domicile' },
  { id: 'WORK',             label: '💼 Travail' },
  { id: 'SEARCHED_ADDRESS', label: '📍 Adresse' },
  { id: 'UNKNOWN',          label: '❓ Inconnu' },
]

function VisitesTab() {
  const [semanticFilter, setSemanticFilter] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate]   = useState('')
  const [page, setPage] = useState(0)
  const PAGE_SIZE = 50

  const { data: visits, isLoading } = useSWR(
    ['loc-visits', semanticFilter, startDate, endDate, page],
    () =>
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
      {/* Filtres */}
      <div className="panel p-3 flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-wider text-ink-400 mb-1">Type</label>
          <div className="flex flex-wrap gap-1">
            {SEMANTIC_FILTER_OPTIONS.map((o) => (
              <button
                key={o.id}
                onClick={() => { setSemanticFilter(o.id); setPage(0) }}
                className={cn(
                  'px-2 py-1 rounded-md text-xs border transition-colors',
                  semanticFilter === o.id
                    ? 'bg-accent/15 border-accent/40 text-accent'
                    : 'bg-ink-800 border-ink-700 text-ink-300 hover:border-ink-600'
                )}
              >
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

      {/* Liste visites */}
      {isLoading ? (
        <div className="panel p-6 flex justify-center">
          <RefreshCw size={18} className="animate-spin text-ink-400" />
        </div>
      ) : (
        <div className="panel divide-y divide-ink-800/60">
          <AnimatePresence mode="popLayout">
            {(visits ?? []).map((v, i) => (
              <VisitRow key={v.id} visit={v} idx={i} />
            ))}
            {(visits ?? []).length === 0 && (
              <div className="p-8 text-center text-ink-400 text-sm">
                Aucune visite pour ce filtre.
              </div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Pagination */}
      <div className="flex gap-2 justify-center items-center">
        <button
          disabled={page === 0}
          onClick={() => setPage((p) => Math.max(0, p - 1))}
          className="px-3 py-1.5 text-xs border border-ink-700 rounded-md disabled:opacity-40 hover:border-ink-600 transition-colors"
        >
          ← Précédent
        </button>
        <span className="text-xs text-ink-400 font-mono">Page {page + 1}</span>
        <button
          disabled={(visits?.length ?? 0) < PAGE_SIZE}
          onClick={() => setPage((p) => p + 1)}
          className="px-3 py-1.5 text-xs border border-ink-700 rounded-md disabled:opacity-40 hover:border-ink-600 transition-colors"
        >
          Suivant →
        </button>
      </div>
    </div>
  )
}

function VisitRow({ visit, idx }: { visit: LocationVisit; idx: number }) {
  const meta = getSemanticMeta(visit.semantic_type)
  const Icon = meta.icon
  const start = new Date(visit.start_time)
  const end = new Date(visit.end_time)
  const durationMin = Math.round((end.getTime() - start.getTime()) / 60000)
  const fmtDuration = durationMin < 60
    ? `${durationMin}min`
    : `${Math.floor(durationMin / 60)}h${String(durationMin % 60).padStart(2, '0')}`

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: idx * 0.01 }}
      className="flex items-start gap-3 px-4 py-3 hover:bg-ink-800/30 transition-colors group"
    >
      {/* Icône sémantique */}
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
        style={{ backgroundColor: meta.hex + '22', border: `1px solid ${meta.hex}44` }}
      >
        <Icon size={14} style={{ color: meta.hex }} />
      </div>

      {/* Contenu */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold" style={{ color: meta.hex }}>
            {meta.label}
          </span>
          {visit.probability !== null && visit.probability < 0.8 && (
            <span className="text-[10px] text-ink-500 font-mono">
              {Math.round((visit.probability ?? 0) * 100)}%
            </span>
          )}
        </div>
        <div className="text-xs text-ink-400 font-mono mt-0.5 flex items-center gap-2">
          <span>{start.toLocaleDateString('fr-CA', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
          <span className="text-ink-600">·</span>
          <span>{start.toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' })}</span>
          <span className="text-ink-600">→</span>
          <span>{end.toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' })}</span>
          <span className="text-ink-600">·</span>
          <span className="text-accent/70">{fmtDuration}</span>
        </div>
        <div className="text-[10px] text-ink-600 font-mono mt-0.5">
          {parseFloat(visit.lat).toFixed(4)}°N, {parseFloat(visit.lng).toFixed(4)}°
          {visit.place_id && <span className="ml-2 text-ink-700">{visit.place_id.slice(0, 12)}…</span>}
        </div>
      </div>

      {/* Durée badge */}
      <div className="shrink-0 text-right">
        <span className="inline-block text-[10px] font-mono px-2 py-0.5 rounded bg-ink-800 border border-ink-700 text-ink-300">
          {fmtDuration}
        </span>
      </div>
    </motion.div>
  )
}

// ─── Tab Stats ───────────────────────────────────────────────────────────────

const ACTIVITY_ICONS: Record<string, { icon: ComponentType<{ size?: number; className?: string }>; label: string; hex: string }> = {
  IN_PASSENGER_VEHICLE: { icon: Car,       label: 'Voiture',    hex: '#ffb84d' },
  WALKING:              { icon: Footprints, label: 'Marche',    hex: '#5cdb95' },
  FLYING:               { icon: Plane,      label: 'Avion',     hex: '#5fb3f4' },
  IN_TRAIN:             { icon: Train,      label: 'Train',     hex: '#c084fc' },
  IN_SUBWAY:            { icon: Train,      label: 'Métro',     hex: '#a78bfa' },
  IN_BUS:               { icon: Car,        label: 'Bus',       hex: '#fb923c' },
  CYCLING:              { icon: Bike,       label: 'Vélo',      hex: '#34d399' },
  IN_VEHICLE:           { icon: Car,        label: 'Véhicule',  hex: '#fbbf24' },
  UNKNOWN_ACTIVITY_TYPE:{ icon: Navigation, label: 'Inconnu',   hex: '#6b7280' },
}

function StatsTab() {
  // On va chercher les activités directement via les points d'activités dans la DB
  // Pour l'instant on affiche les stats globales + des méta-stats calculées
  const { data: stats } = useSWR('locations-stats', () => api.locations.stats())

  if (!stats) {
    return <div className="panel p-8 flex justify-center"><RefreshCw size={18} className="animate-spin text-ink-400" /></div>
  }

  const yearsSpan = stats.earliest_date && stats.latest_date
    ? new Date(stats.latest_date).getFullYear() - new Date(stats.earliest_date).getFullYear() + 1
    : 0

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {/* Vue globale */}
      <div className="panel p-4 col-span-full">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-ink-400 mb-3">
          Vue globale — {yearsSpan} ans de données ({stats.earliest_date} → {stats.latest_date})
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatBlock icon={MapPin}     label="Visites totales"  value={stats.total_visits.toLocaleString('fr-CA')}  hex="#5cdb95" />
          <StatBlock icon={Globe}      label="Lieux uniques"    value={stats.unique_places.toLocaleString('fr-CA')} hex="#5fb3f4" />
          <StatBlock icon={Navigation} label="Points GPS"       value={stats.total_path_points.toLocaleString('fr-CA')} hex="#ffb84d" />
          <StatBlock icon={Car}        label="Activités"        value={stats.total_activities.toLocaleString('fr-CA')} hex="#c084fc" />
        </div>
      </div>

      {/* Répartition visites */}
      <div className="panel p-4">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-ink-400 mb-3">Répartition visites</div>
        <div className="space-y-3">
          {[
            { label: 'Domicile', value: stats.home_visits, total: stats.total_visits, hex: '#5cdb95' },
            { label: 'Travail',  value: stats.work_visits, total: stats.total_visits, hex: '#5fb3f4' },
            { label: 'Autres',   value: stats.total_visits - stats.home_visits - stats.work_visits, total: stats.total_visits, hex: '#8b95a3' },
          ].map((r) => (
            <div key={r.label}>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-ink-300">{r.label}</span>
                <span className="font-mono text-ink-400">
                  {r.value.toLocaleString('fr-CA')} ({Math.round((r.value / r.total) * 100)}%)
                </span>
              </div>
              <div className="h-1.5 bg-ink-800 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${(r.value / r.total) * 100}%`, backgroundColor: r.hex }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Transport modes estimés */}
      <div className="panel p-4 col-span-1 md:col-span-2">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-ink-400 mb-3">
          Modes de transport connus (12,333 activités)
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {[
            { key: 'IN_PASSENGER_VEHICLE', n: 8662, km: 223271 },
            { key: 'WALKING',              n: 2619, km: 3056 },
            { key: 'FLYING',               n: 51,   km: 108782 },
            { key: 'IN_TRAIN',             n: 110,  km: 10515 },
            { key: 'IN_SUBWAY',            n: 274,  km: 7416 },
            { key: 'CYCLING',              n: 57,   km: 136 },
          ].map((a) => {
            const meta = ACTIVITY_ICONS[a.key] ?? { icon: Navigation, label: a.key, hex: '#8b95a3' }
            const Icon = meta.icon
            return (
              <div key={a.key} className="flex items-center gap-2.5 p-2.5 rounded-lg bg-ink-800/50 border border-ink-700/50">
                <div
                  className="w-7 h-7 rounded-md flex items-center justify-center shrink-0"
                  style={{ backgroundColor: meta.hex + '22' }}
                >
                  <Icon size={13} style={{ color: meta.hex }} />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-ink-200 leading-tight">{meta.label}</div>
                  <div className="text-[10px] font-mono text-ink-400 mt-0.5">
                    {a.n.toLocaleString()} · {(a.km / 1000).toFixed(0)}k km
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Fun facts */}
      <div className="panel p-4 col-span-full">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-ink-400 mb-3">Fun facts</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <FunFact label="Vols enregistrés"        value="51"         sub="108,782 km parcourus en avion" hex="#5fb3f4" />
          <FunFact label="Distance en voiture"      value="223,271 km" sub="≈ 5.6× le tour de la Terre"   hex="#ffb84d" />
          <FunFact label="Sessions de ski 🎿"       value="40"         sub="détectées automatiquement"     hex="#c084fc" />
          <FunFact label="Couverture géographique"  value="102°"       sub="latitude -34° à +69°"          hex="#5cdb95" />
        </div>
      </div>
    </div>
  )
}

function StatBlock({
  icon: Icon,
  label,
  value,
  hex,
}: {
  icon: ComponentType<{ size?: number; className?: string }>
  label: string
  value: string
  hex: string
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

function FunFact({ label, value, sub, hex }: { label: string; value: string; sub: string; hex: string }) {
  return (
    <div className="flex flex-col gap-1 p-3 rounded-lg border border-ink-700/50 bg-ink-800/30">
      <div className="text-[10px] uppercase tracking-wider font-semibold text-ink-400">{label}</div>
      <div className="text-xl font-bold font-mono" style={{ color: hex }}>{value}</div>
      <div className="text-[10px] text-ink-500">{sub}</div>
    </div>
  )
}
