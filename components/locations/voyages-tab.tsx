'use client'

import { motion, AnimatePresence } from 'framer-motion'
import useSWR from 'swr'
import dynamic from 'next/dynamic'
import { useState, useMemo } from 'react'
import {
  MapPin, Compass, Plane, Calendar, Ruler, Hash, RefreshCw, ChevronRight,
  Settings, Globe, Clock, Search, X, Camera, type LucideIcon,
} from 'lucide-react'
import { api, photoThumbUrl, type Trip, type TripNote, type PhotoItem } from '@/lib/api'
import { cn } from '@/lib/utils'
import { TripNoteButton } from '@/components/locations/trip-note-editor'

const LocationMap = dynamic(
  () => import('@/components/location-map').then(m => ({ default: m.LocationMap })),
  { ssr: false, loading: () => <div className="h-full w-full bg-ink-900/40 animate-pulse" /> }
)

export interface VoyagesTabProps {
  onOpenDay?: (date: string) => void  // pour ouvrir un jour du voyage dans l'onglet Journée
}

export function VoyagesTab({ onOpenDay }: VoyagesTabProps) {
  const [showSettings, setShowSettings] = useState(false)
  const [minHours, setMinHours]         = useState(24)
  const [minDistKm, setMinDistKm]       = useState(150)
  const [homeRadiusKm, setHomeRadiusKm] = useState(30)
  const [recencyMonths, setRecencyMonths] = useState(12)
  const [manualHome, setManualHome]     = useState<{ lat: string; lng: string }>({ lat: '', lng: '' })
  const [search, setSearch]             = useState('')
  const [yearFilter, setYearFilter]     = useState<number | null>(null)

  const useManual = manualHome.lat !== '' && manualHome.lng !== ''
  const homeLatN = useManual ? parseFloat(manualHome.lat) : undefined
  const homeLngN = useManual ? parseFloat(manualHome.lng) : undefined

  const { data, isLoading, error } = useSWR(
    ['trips', minHours, minDistKm, homeRadiusKm, recencyMonths, homeLatN, homeLngN],
    () => api.locations.trips({
      min_duration_hours: minHours,
      min_distance_km: minDistKm,
      home_radius_km: homeRadiusKm,
      home_recency_months: useManual ? undefined : recencyMonths,
      home_lat: homeLatN,
      home_lng: homeLngN,
    })
  )

  // Notes des voyages (pour montrer un badge sur les cards)
  const { data: tripNotes } = useSWR('trip-notes-all', () => api.locations.tripNotes.list())
  const noteByDate = useMemo(() => {
    const m = new Map<string, TripNote>()
    for (const n of tripNotes ?? []) m.set(n.start_date, n)
    return m
  }, [tripNotes])

  // Filtre client : recherche texte + année
  const filteredTrips = useMemo(() => {
    if (!data) return []
    let trips = data.trips
    if (yearFilter) {
      trips = trips.filter(t =>
        t.start_date.startsWith(String(yearFilter)) || t.end_date.startsWith(String(yearFilter)))
    }
    if (search.trim()) {
      const s = search.toLowerCase().trim()
      trips = trips.filter(t => {
        // Match dates, distances, destinations
        const haystack = [
          t.start_date, t.end_date,
          t.destinations.map(d => `${d.lat.toFixed(2)},${d.lng.toFixed(2)}`).join(' '),
          // Coords-based country guess (très rough)
          guessRegionFromCoords(t.destinations[0]?.lat, t.destinations[0]?.lng),
          `${t.duration_days}j`,
          `${Math.round(t.max_distance_from_home_km)}km`,
        ].join(' ').toLowerCase()
        return haystack.includes(s)
      })
    }
    return trips
  }, [data, yearFilter, search])

  // Années uniques pour le filter chips
  const years = useMemo(() => {
    if (!data) return []
    const set = new Set<number>()
    for (const t of data.trips) set.add(parseInt(t.start_date.slice(0, 4)))
    return [...set].sort((a, b) => b - a)
  }, [data])

  return (
    <div className="flex flex-col gap-3">
      {/* Header */}
      <div className="panel p-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Compass size={14} className="text-accent" />
          <span className="text-sm font-semibold">Voyages détectés</span>
          {data && (
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-ink-800 border border-ink-700 text-ink-400">
              {data.trips.length} voyage{data.trips.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <button onClick={() => setShowSettings(!showSettings)}
          className={cn('flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs border transition-colors',
            showSettings ? 'border-accent/50 text-accent bg-accent/10' : 'border-ink-700 text-ink-400 hover:border-ink-500')}>
          <Settings size={11} />
          Critères
        </button>
      </div>

      {/* Settings panel */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="panel p-4 overflow-hidden space-y-4"
          >
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-ink-400 mb-1">
                  Durée minimum : {minHours}h ({Math.floor(minHours/24)}j)
                </label>
                <input type="range" min="6" max="240" step="6" value={minHours}
                  onChange={(e) => setMinHours(Number(e.target.value))}
                  className="w-full accent-accent" />
                <div className="flex justify-between text-[9px] text-ink-600 font-mono"><span>6h</span><span>10j</span></div>
              </div>
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-ink-400 mb-1">
                  Distance min : {minDistKm} km
                </label>
                <input type="range" min="20" max="2000" step="10" value={minDistKm}
                  onChange={(e) => setMinDistKm(Number(e.target.value))}
                  className="w-full accent-accent" />
                <div className="flex justify-between text-[9px] text-ink-600 font-mono"><span>20km</span><span>2000km</span></div>
              </div>
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-ink-400 mb-1">
                  Rayon home : {homeRadiusKm} km
                </label>
                <input type="range" min="5" max="200" step="5" value={homeRadiusKm}
                  onChange={(e) => setHomeRadiusKm(Number(e.target.value))}
                  className="w-full accent-accent" />
                <div className="flex justify-between text-[9px] text-ink-600 font-mono"><span>5km</span><span>200km</span></div>
              </div>
            </div>

            {/* Auto-detect HOME settings */}
            <div className="p-3 rounded-md bg-ink-800/40 border border-ink-700/40 space-y-2.5">
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase tracking-wider font-semibold text-ink-300">Domicile</span>
                {data && (
                  <span className="text-[10px] font-mono text-accent">
                    {useManual ? '🎯 manuel' : '🤖 auto'} → {data.home_lat.toFixed(4)}°, {data.home_lng.toFixed(4)}°
                  </span>
                )}
              </div>

              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-ink-400 mb-1">
                  Auto-détection : HOME des {recencyMonths} derniers mois (gère les déménagements)
                </label>
                <input type="range" min="3" max="120" step="3" value={recencyMonths}
                  onChange={(e) => { setRecencyMonths(Number(e.target.value)); setManualHome({lat:'', lng:''}) }}
                  disabled={useManual}
                  className="w-full accent-accent disabled:opacity-30" />
                <div className="flex justify-between text-[9px] text-ink-600 font-mono"><span>3m</span><span>10ans</span></div>
              </div>

              <div className="grid grid-cols-3 gap-2 items-end">
                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-ink-500 mb-1">Lat (manuel)</label>
                  <input type="number" step="0.0001" placeholder="46.7383"
                    value={manualHome.lat}
                    onChange={(e) => setManualHome((m) => ({ ...m, lat: e.target.value }))}
                    className="w-full bg-ink-900 border border-ink-700 rounded px-2 py-1 text-xs font-mono focus:border-accent/50 outline-none" />
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-ink-500 mb-1">Lng (manuel)</label>
                  <input type="number" step="0.0001" placeholder="-71.2433"
                    value={manualHome.lng}
                    onChange={(e) => setManualHome((m) => ({ ...m, lng: e.target.value }))}
                    className="w-full bg-ink-900 border border-ink-700 rounded px-2 py-1 text-xs font-mono focus:border-accent/50 outline-none" />
                </div>
                {useManual && (
                  <button onClick={() => setManualHome({lat:'', lng:''})}
                    className="px-2 py-1 text-[10px] rounded bg-ink-800 border border-ink-700 hover:border-ink-500 text-ink-400">
                    ↺ Auto
                  </button>
                )}
              </div>

              <p className="text-[10px] text-ink-500 font-mono leading-relaxed">
                💡 Si tu as déménagé : laisse &quot;auto&quot; et ajuste la fenêtre récente, OU saisis tes coords manuellement (Google Maps clic-droit).
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Liste */}
      {isLoading ? (
        <div className="panel p-8 flex justify-center">
          <RefreshCw size={18} className="animate-spin text-ink-400" />
        </div>
      ) : error ? (
        <div className="panel p-8 text-center">
          <div className="text-3xl mb-2 opacity-40">🏠</div>
          <p className="text-sm text-ink-400">Pas encore de domicile défini</p>
          <p className="text-[10px] text-ink-500 font-mono mt-1">
            Va dans l&apos;onglet &quot;Mes Lieux&quot; pour définir ton HOME et activer la détection de voyages.
          </p>
        </div>
      ) : data?.trips.length === 0 ? (
        <div className="panel p-8 text-center">
          <div className="text-3xl mb-2 opacity-40">🏝️</div>
          <p className="text-sm text-ink-400">Aucun voyage trouvé avec ces critères</p>
          <p className="text-[10px] text-ink-500 font-mono mt-1">Réduis la durée ou la distance min ↑</p>
        </div>
      ) : (
        <>
          {/* Search + year chips */}
          <div className="flex flex-col gap-2">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-500 pointer-events-none" />
              <input
                type="text" placeholder="Rechercher un voyage (année, destination, pays, durée…)"
                value={search} onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-ink-800 border border-ink-700 rounded-md pl-9 pr-9 py-2 text-sm placeholder:text-ink-500 focus:border-accent/50 outline-none"
              />
              {search && (
                <button onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-500 hover:text-ink-200">
                  <X size={14} />
                </button>
              )}
            </div>
            {years.length > 1 && (
              <div className="flex items-center gap-1 flex-wrap">
                <span className="text-[10px] uppercase tracking-wider font-semibold text-ink-500 mr-1">Année :</span>
                <button onClick={() => setYearFilter(null)}
                  className={cn('px-2 py-0.5 text-xs rounded font-mono transition-colors',
                    yearFilter === null ? 'bg-accent text-ink-900 font-semibold' : 'bg-ink-800 border border-ink-700 text-ink-400 hover:border-ink-500')}>
                  Toutes
                </button>
                {years.map((y) => (
                  <button key={y} onClick={() => setYearFilter(yearFilter === y ? null : y)}
                    className={cn('px-2 py-0.5 text-xs rounded font-mono transition-colors',
                      yearFilter === y ? 'bg-accent text-ink-900 font-semibold' : 'bg-ink-800 border border-ink-700 text-ink-400 hover:border-ink-500')}>
                    {y}
                  </button>
                ))}
              </div>
            )}
            {(search || yearFilter) && (
              <p className="text-[10px] text-ink-500 font-mono">
                {filteredTrips.length} voyage{filteredTrips.length > 1 ? 's' : ''} sur {data?.trips.length ?? 0}
                {(search || yearFilter) && (
                  <button onClick={() => { setSearch(''); setYearFilter(null) }}
                    className="ml-2 text-accent hover:underline">effacer filtres</button>
                )}
              </p>
            )}
          </div>

          {filteredTrips.length === 0 ? (
            <div className="panel p-6 text-center">
              <p className="text-sm text-ink-400">Aucun voyage ne match la recherche.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredTrips.map((trip, i) => (
                <TripCard key={`${trip.start_date}-${i}`} trip={trip} idx={i}
                  note={noteByDate.get(trip.start_date) ?? null} onOpenDay={onOpenDay} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function TripCard({ trip, idx, note, onOpenDay }: {
  trip: Trip; idx: number; note?: TripNote | null; onOpenDay?: (date: string) => void
}) {
  // Photos prises pendant le voyage (best-effort)
  const { data: photos } = useSWR(
    ['trip-photos', trip.start_date, trip.end_date],
    () => api.photos.list({
      since: `${trip.start_date}T00:00:00Z`,
      until: `${trip.end_date}T23:59:59Z`,
      limit: 6,
    }).catch(() => [] as PhotoItem[])
  )
  const photoCount = photos?.length ?? 0

  const start = new Date(trip.start_date), end = new Date(trip.end_date)
  const sameYear = start.getFullYear() === end.getFullYear()
  const dateLabel = sameYear
    ? `${start.toLocaleDateString('fr-CA', { day: 'numeric', month: 'short' })} → ${end.toLocaleDateString('fr-CA', { day: 'numeric', month: 'short', year: 'numeric' })}`
    : `${start.toLocaleDateString('fr-CA', { day: 'numeric', month: 'short', year: 'numeric' })} → ${end.toLocaleDateString('fr-CA', { day: 'numeric', month: 'short', year: 'numeric' })}`

  // Dérive un emoji thématique basé sur la distance
  const isInternational = trip.max_distance_from_home_km > 1500

  // Mini-map data : on montre les destinations comme visites
  const miniVisits = useMemo(() => trip.destinations.map((d, i) => ({
    id: `${trip.start_date}-dest-${i}`,
    start_time: trip.start_date + 'T00:00:00Z',
    end_time: trip.end_date + 'T23:59:59Z',
    lat: String(d.lat), lng: String(d.lng),
    semantic_type: d.semantic_type, place_id: null, probability: null,
    tz_offset_minutes: null, source: 'derived', created_at: trip.start_date,
  })), [trip])

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: idx * 0.05 }}
      whileHover={{ y: -2 }}
      className="panel overflow-hidden flex flex-col group cursor-pointer"
      onClick={() => onOpenDay?.(trip.start_date)}
    >
      {/* Mini map preview */}
      <div className="h-32 bg-ink-900 overflow-hidden relative pointer-events-none">
        <LocationMap visits={miniVisits} mode="visits" />
        <div className="absolute top-2 left-2 px-2 py-0.5 rounded text-[10px] font-mono font-bold backdrop-blur-sm pointer-events-auto"
          style={{ backgroundColor: 'rgba(13,17,23,0.7)', color: isInternational ? '#5fb3f4' : '#5cdb95', borderLeft: `2px solid ${isInternational ? '#5fb3f4' : '#5cdb95'}` }}>
          {isInternational ? <><Plane size={10} className="inline mr-1" />International</> : <><Globe size={10} className="inline mr-1" />Domestique</>}
        </div>
        {photoCount > 0 && (
          <div className="absolute top-2 right-2 px-2 py-0.5 rounded text-[10px] font-mono font-bold backdrop-blur-sm flex items-center gap-1"
            style={{ backgroundColor: 'rgba(13,17,23,0.85)', color: '#fbbf24', border: '1px solid #fbbf2440' }}>
            <Camera size={10} /> {photoCount}
          </div>
        )}
      </div>

      {/* Photo strip si photos */}
      {photos && photos.length > 0 && (
        <div className="flex gap-px h-14 overflow-hidden bg-ink-950 pointer-events-none">
          {photos.slice(0, 6).map((p) => (
            <div key={p.id} className="flex-1 relative bg-ink-900">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photoThumbUrl(p.media_id, 160)} alt={p.filename ?? ''}
                className="w-full h-full object-cover" loading="lazy"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
            </div>
          ))}
        </div>
      )}

      {/* Body */}
      <div className="p-3 flex flex-col gap-2 flex-1">
        {/* Auto-name (if available) */}
        {trip.name && (
          <div className="flex items-center gap-1.5 -mb-1">
            <span className="text-sm font-bold text-amber-300 truncate" title={trip.name}>
              📍 {trip.name}
            </span>
          </div>
        )}
        {/* Dates */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Calendar size={11} className="text-accent" />
            <span className={cn('text-xs', trip.name ? 'text-ink-400 font-mono' : 'font-semibold text-ink-200')}>{dateLabel}</span>
          </div>
          <ChevronRight size={14} className="text-ink-500 group-hover:text-accent transition-colors" />
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-3 gap-1.5 mt-1">
          <CompactStat icon={Clock}  label="Durée"     value={`${trip.duration_days}j`} hex="#c084fc" />
          <CompactStat icon={Ruler}  label="Max"       value={`${Math.round(trip.max_distance_from_home_km)}km`} hex="#5fb3f4" />
          <CompactStat icon={Hash}   label="Activités" value={trip.activity_count.toString()} hex="#ffb84d" />
        </div>

        {/* Top destinations */}
        {trip.destinations.length > 0 && (
          <div className="mt-1">
            <div className="text-[9px] uppercase tracking-wider font-semibold text-ink-500 mb-1">Top lieux</div>
            <div className="flex flex-wrap gap-1">
              {trip.destinations.slice(0, 4).map((d, i) => (
                <span key={i} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-ink-800 border border-ink-700">
                  <MapPin size={8} className="text-ink-500" />
                  <span className="font-mono text-ink-300">
                    {d.lat.toFixed(2)}°, {d.lng.toFixed(2)}°
                  </span>
                  <span className="text-ink-500">×{d.count}</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Total distance + Note button */}
        <div className="flex items-end justify-between gap-2 mt-auto pt-1">
          {trip.total_distance_km > 0 ? (
            <div className="text-[10px] text-ink-500 font-mono">
              <span className="text-amber-400">{trip.total_distance_km.toLocaleString('fr-CA')} km</span> parcourus
            </div>
          ) : <div />}
          <TripNoteButton
            startDate={trip.start_date}
            endDate={trip.end_date}
            existingNote={note ?? undefined}
          />
        </div>

        {/* Snippet de la note si presente */}
        {note?.title && (
          <div className="text-[10px] text-amber-200 italic mt-1 truncate font-medium" title={note.content}>
            「 {note.title} 」
          </div>
        )}
        {!note?.title && note?.content && (
          <div className="text-[10px] text-amber-200/70 italic mt-1 line-clamp-2" title={note.content}>
            {note.content}
          </div>
        )}
      </div>
    </motion.div>
  )
}

// Heuristique très simple : devine la région depuis lat/lng pour permettre la recherche
// "France", "Canada", etc. sans nécessiter de geocoding API.
function guessRegionFromCoords(lat: number | undefined, lng: number | undefined): string {
  if (lat == null || lng == null) return ''
  // Quebec / Canada
  if (lat >= 43 && lat <= 60 && lng >= -80 && lng <= -57) return 'canada quebec'
  // USA
  if (lat >= 25 && lat <= 49 && lng >= -125 && lng <= -67) return 'usa etats-unis amerique'
  // Mexico / centroamerica
  if (lat >= 14 && lat <= 32 && lng >= -118 && lng <= -86) return 'mexique mexico'
  // France métropole
  if (lat >= 41 && lat <= 51 && lng >= -5 && lng <= 9) return 'france europe'
  // Italie
  if (lat >= 36 && lat <= 47 && lng >= 6 && lng <= 19) return 'italie italy europe'
  // Espagne
  if (lat >= 35 && lat <= 44 && lng >= -10 && lng <= 4) return 'espagne spain europe'
  // UK / Ireland
  if (lat >= 49 && lat <= 61 && lng >= -11 && lng <= 2) return 'uk angleterre irlande europe'
  // Allemagne / Pologne
  if (lat >= 47 && lat <= 55 && lng >= 5 && lng <= 24) return 'allemagne germany europe'
  // Scandinavie
  if (lat >= 55 && lat <= 71 && lng >= 4 && lng <= 32) return 'scandinavie nordique europe'
  // Maroc / Tunisie
  if (lat >= 27 && lat <= 38 && lng >= -13 && lng <= 12) return 'maroc afrique du nord'
  // Asie est
  if (lat >= 18 && lat <= 50 && lng >= 100 && lng <= 145) return 'asie japan china korea'
  // Australie / NZ
  if (lat >= -47 && lat <= -10 && lng >= 110 && lng <= 180) return 'australie nouvelle-zelande'
  // Moyen-Orient
  if (lat >= 12 && lat <= 42 && lng >= 25 && lng <= 65) return 'moyen-orient dubai turquie'
  return ''
}

function CompactStat({ icon: Icon, label, value, hex }: {
  icon: LucideIcon
  label: string; value: string; hex: string
}) {
  return (
    <div className="flex flex-col items-center gap-0.5 p-1.5 rounded-md bg-ink-800/40 border border-ink-700/40">
      <Icon size={10} style={{ color: hex }} />
      <span className="text-xs font-bold font-mono leading-none" style={{ color: hex }}>{value}</span>
      <span className="text-[9px] uppercase tracking-wider text-ink-500">{label}</span>
    </div>
  )
}
