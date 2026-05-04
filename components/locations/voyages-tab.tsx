'use client'

import { motion, AnimatePresence } from 'framer-motion'
import useSWR from 'swr'
import dynamic from 'next/dynamic'
import { useState, useMemo } from 'react'
import {
  MapPin, Compass, Plane, Calendar, Ruler, Hash, RefreshCw, ChevronRight,
  Settings, Globe, Clock,
} from 'lucide-react'
import { api, type Trip } from '@/lib/api'
import { cn } from '@/lib/utils'

const LocationMap = dynamic(
  () => import('@/components/location-map').then(m => ({ default: m.LocationMap })),
  { ssr: false, loading: () => <div className="h-full w-full bg-ink-900/40 animate-pulse" /> }
)

export interface VoyagesTabProps {
  onOpenDay?: (date: string) => void  // pour ouvrir un jour du voyage dans l'onglet Journée
}

export function VoyagesTab({ onOpenDay }: VoyagesTabProps) {
  const [showSettings, setShowSettings] = useState(false)
  const [minHours, setMinHours]         = useState(48)
  const [minDistKm, setMinDistKm]       = useState(200)
  const [homeRadiusKm, setHomeRadiusKm] = useState(50)

  const { data, isLoading, error } = useSWR(
    ['trips', minHours, minDistKm, homeRadiusKm],
    () => api.locations.trips({
      min_duration_hours: minHours,
      min_distance_km: minDistKm,
      home_radius_km: homeRadiusKm,
    })
  )

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
            className="panel p-4 overflow-hidden"
          >
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-ink-400 mb-1">
                  Durée minimum : {minHours}h ({Math.floor(minHours/24)}j)
                </label>
                <input type="range" min="12" max="240" step="12" value={minHours}
                  onChange={(e) => setMinHours(Number(e.target.value))}
                  className="w-full accent-accent" />
                <div className="flex justify-between text-[9px] text-ink-600 font-mono"><span>12h</span><span>10j</span></div>
              </div>
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-ink-400 mb-1">
                  Distance min : {minDistKm} km
                </label>
                <input type="range" min="20" max="2000" step="20" value={minDistKm}
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
            {data && (
              <p className="text-[10px] text-ink-500 font-mono mt-3">
                💡 Centroid HOME calculé : {data.home_lat.toFixed(4)}°, {data.home_lng.toFixed(4)}°
              </p>
            )}
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
            Va dans l'onglet "Mes Lieux" pour définir ton HOME et activer la détection de voyages.
          </p>
        </div>
      ) : data?.trips.length === 0 ? (
        <div className="panel p-8 text-center">
          <div className="text-3xl mb-2 opacity-40">🏝️</div>
          <p className="text-sm text-ink-400">Aucun voyage trouvé avec ces critères</p>
          <p className="text-[10px] text-ink-500 font-mono mt-1">Réduis la durée ou la distance min ↑</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {data?.trips.map((trip, i) => (
            <TripCard key={`${trip.start_date}-${i}`} trip={trip} idx={i} onOpenDay={onOpenDay} />
          ))}
        </div>
      )}
    </div>
  )
}

function TripCard({ trip, idx, onOpenDay }: {
  trip: Trip; idx: number; onOpenDay?: (date: string) => void
}) {
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
      </div>

      {/* Body */}
      <div className="p-3 flex flex-col gap-2 flex-1">
        {/* Dates */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Calendar size={11} className="text-accent" />
            <span className="text-xs font-semibold text-ink-200">{dateLabel}</span>
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

        {/* Total distance */}
        {trip.total_distance_km > 0 && (
          <div className="text-[10px] text-ink-500 font-mono mt-auto pt-1">
            Distance totale parcourue : <span className="text-amber-400">{trip.total_distance_km.toLocaleString('fr-CA')} km</span>
          </div>
        )}
      </div>
    </motion.div>
  )
}

function CompactStat({ icon: Icon, label, value, hex }: {
  icon: React.ComponentType<{ size?: number; className?: string }>
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
