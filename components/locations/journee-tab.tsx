'use client'

import { motion, AnimatePresence } from 'framer-motion'
import useSWR from 'swr'
import dynamic from 'next/dynamic'
import { useState, useMemo, useCallback, type ComponentType } from 'react'
import {
  ChevronLeft, ChevronRight, MapPin, Home, Briefcase, Navigation,
  Sparkles, Car, Train, Plane, Footprints, Bike, Clock, Ruler, RefreshCw, Calendar,
} from 'lucide-react'
import { api, type LocationVisit, type LocationActivity } from '@/lib/api'
import { cn } from '@/lib/utils'

const LocationMap = dynamic(
  () => import('@/components/location-map').then(m => ({ default: m.LocationMap })),
  { ssr: false, loading: () => <div className="h-full w-full flex items-center justify-center text-ink-400 text-sm font-mono">Chargement…</div> }
)

const SEMANTIC: Record<string, { label: string; hex: string; icon: ComponentType<{ size?: number; className?: string }> }> = {
  HOME:              { label: 'Domicile',     hex: '#5cdb95', icon: Home       },
  INFERRED_HOME:     { label: 'Domicile inf', hex: '#3db37a', icon: Home       },
  WORK:              { label: 'Travail',      hex: '#5fb3f4', icon: Briefcase  },
  INFERRED_WORK:     { label: 'Travail inf',  hex: '#3a8fd6', icon: Briefcase  },
  SEARCHED_ADDRESS:  { label: 'Adresse',      hex: '#ffb84d', icon: Navigation },
  ALIASED_LOCATION:  { label: 'Favori',       hex: '#c084fc', icon: Sparkles   },
  UNKNOWN:           { label: 'Lieu',         hex: '#8b95a3', icon: MapPin     },
}

const ACTIVITY: Record<string, { label: string; hex: string; icon: ComponentType<{ size?: number; className?: string }> }> = {
  IN_PASSENGER_VEHICLE: { label: 'Voiture',  hex: '#ffb84d', icon: Car        },
  IN_VEHICLE:           { label: 'Véhicule', hex: '#fbbf24', icon: Car        },
  WALKING:              { label: 'Marche',   hex: '#5cdb95', icon: Footprints },
  RUNNING:              { label: 'Course',   hex: '#86efac', icon: Footprints },
  CYCLING:              { label: 'Vélo',     hex: '#34d399', icon: Bike       },
  IN_TRAIN:             { label: 'Train',    hex: '#c084fc', icon: Train      },
  IN_SUBWAY:            { label: 'Métro',    hex: '#a78bfa', icon: Train      },
  IN_BUS:               { label: 'Bus',      hex: '#fb923c', icon: Car        },
  FLYING:               { label: 'Avion',    hex: '#5fb3f4', icon: Plane      },
  SKIING:               { label: 'Ski',      hex: '#e0f2fe', icon: Footprints },
  UNKNOWN_ACTIVITY_TYPE:{ label: 'Inconnu',  hex: '#6b7280', icon: Navigation },
}

export interface JourneeTabProps {
  initialDate?: string
  defaultDate: string  // ISO YYYY-MM-DD (typiquement stats.latest_date)
}

export function JourneeTab({ initialDate, defaultDate }: JourneeTabProps) {
  const [date, setDate] = useState(initialDate ?? defaultDate)

  const { data: dayData, isLoading } = useSWR(
    ['day', date],
    () => api.locations.day(date)
  )

  const shiftDay = useCallback((days: number) => {
    const d = new Date(date)
    d.setDate(d.getDate() + days)
    setDate(d.toISOString().slice(0, 10))
  }, [date])

  // Combine visits + activities en une timeline triée
  const timelineEvents = useMemo(() => {
    if (!dayData) return []
    const events: Array<{ type: 'visit' | 'activity'; time: Date; visit?: LocationVisit; activity?: LocationActivity }> = []
    for (const v of dayData.visits) {
      events.push({ type: 'visit', time: new Date(v.start_time), visit: v })
    }
    for (const a of dayData.activities) {
      events.push({ type: 'activity', time: new Date(a.start_time), activity: a })
    }
    events.sort((x, y) => x.time.getTime() - y.time.getTime())
    return events
  }, [dayData])

  const dateObj = new Date(date + 'T00:00:00')
  const dateLabel = dateObj.toLocaleDateString('fr-CA', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  })

  return (
    <div className="flex flex-col gap-3 flex-1">
      {/* Header avec date picker */}
      <div className="panel p-3 flex flex-wrap items-center gap-3">
        <button onClick={() => shiftDay(-1)}
          className="w-8 h-8 rounded-md bg-ink-800 border border-ink-700 hover:border-accent/50 flex items-center justify-center transition-colors">
          <ChevronLeft size={14} className="text-ink-300" />
        </button>
        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
          <Calendar size={14} className="text-accent" />
          <input
            type="date" value={date} onChange={(e) => setDate(e.target.value)}
            className="bg-ink-800 border border-ink-700 rounded-md px-3 py-1.5 text-sm font-mono focus:border-accent/50 outline-none"
          />
          <span className="text-sm font-medium capitalize text-ink-200">{dateLabel}</span>
        </div>
        <button onClick={() => shiftDay(1)}
          className="w-8 h-8 rounded-md bg-ink-800 border border-ink-700 hover:border-accent/50 flex items-center justify-center transition-colors">
          <ChevronRight size={14} className="text-ink-300" />
        </button>
      </div>

      {/* Stats du jour */}
      {dayData && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <DayTile icon={MapPin}     label="Visites"         value={dayData.summary.visits_count}                       hex="#5cdb95" />
          <DayTile icon={Navigation} label="Activités"       value={dayData.summary.activities_count}                   hex="#5fb3f4" />
          <DayTile icon={Ruler}      label="Distance"        value={`${dayData.summary.total_distance_km.toFixed(1)} km`} hex="#ffb84d" />
          <DayTile icon={Clock}      label="Temps actif"
            value={dayData.summary.total_duration_minutes < 60
              ? `${dayData.summary.total_duration_minutes} min`
              : `${Math.floor(dayData.summary.total_duration_minutes / 60)}h${String(dayData.summary.total_duration_minutes % 60).padStart(2, '0')}`}
            hex="#c084fc" />
        </div>
      )}

      {/* Layout principal : timeline + carte */}
      <div className="grid grid-cols-1 lg:grid-cols-[420px_1fr] gap-3 flex-1 min-h-[600px]">
        {/* Timeline */}
        <div className="panel overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-ink-800/60 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-ink-400">Timeline</span>
            {dayData && (
              <span className="text-[10px] font-mono text-ink-500">
                {timelineEvents.length} événement{timelineEvents.length > 1 ? 's' : ''}
              </span>
            )}
          </div>
          <div className="overflow-y-auto flex-1 relative">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw size={18} className="animate-spin text-ink-400" />
              </div>
            ) : timelineEvents.length === 0 ? (
              <div className="text-center py-12 px-4">
                <div className="text-3xl mb-2 opacity-40">🌙</div>
                <p className="text-sm text-ink-400">Aucune activité enregistrée</p>
                <p className="text-[10px] text-ink-600 font-mono mt-1">Essaie une autre date</p>
              </div>
            ) : (
              <div className="relative">
                {/* Rail vertical */}
                <div className="absolute left-[37px] top-4 bottom-4 w-px bg-ink-800" />

                <AnimatePresence mode="popLayout">
                  {timelineEvents.map((ev, i) => (
                    <TimelineEvent key={i} event={ev} idx={i} />
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>

        {/* Carte */}
        <div className="panel overflow-hidden min-h-[400px] lg:min-h-0">
          {isLoading ? (
            <div className="h-full flex items-center justify-center text-ink-400 text-sm font-mono">
              Chargement…
            </div>
          ) : dayData && (dayData.points.length > 0 || dayData.visits.length > 0) ? (
            <DayMap dayData={dayData} />
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center px-4">
              <div className="text-4xl mb-2 opacity-30">📍</div>
              <p className="text-sm text-ink-400">Aucune donnée GPS pour cette journée</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function TimelineEvent({ event, idx }: {
  event: { type: 'visit' | 'activity'; time: Date; visit?: LocationVisit; activity?: LocationActivity }
  idx: number
}) {
  const isVisit = event.type === 'visit'
  if (isVisit && event.visit) {
    const v = event.visit
    const meta = SEMANTIC[v.semantic_type ?? 'UNKNOWN'] ?? SEMANTIC.UNKNOWN
    const Icon = meta.icon
    const start = new Date(v.start_time), end = new Date(v.end_time)
    const durMin = Math.round((end.getTime() - start.getTime()) / 60000)
    return (
      <motion.div
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: idx * 0.04 }}
        className="flex items-start gap-3 px-4 py-2.5 hover:bg-ink-800/30 transition-colors relative"
      >
        <div className="flex flex-col items-center shrink-0 w-12">
          <span className="text-[10px] font-mono text-ink-400">
            {start.toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
        <div className="relative shrink-0">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: meta.hex + '22', border: `2px solid ${meta.hex}` }}>
            <Icon size={12} style={{ color: meta.hex }} />
          </div>
        </div>
        <div className="flex-1 min-w-0 pt-1">
          <div className="text-xs font-semibold" style={{ color: meta.hex }}>{meta.label}</div>
          <div className="text-[10px] text-ink-400 font-mono">
            {start.toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' })} →{' '}
            {end.toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' })}
            {' · '}{durMin < 60 ? `${durMin}min` : `${Math.floor(durMin / 60)}h${String(durMin % 60).padStart(2, '0')}`}
          </div>
          <div className="text-[9px] text-ink-600 font-mono mt-0.5">
            {parseFloat(v.lat).toFixed(4)}°, {parseFloat(v.lng).toFixed(4)}°
          </div>
        </div>
      </motion.div>
    )
  }
  if (event.activity) {
    const a = event.activity
    const meta = ACTIVITY[a.activity_type ?? 'UNKNOWN_ACTIVITY_TYPE'] ?? ACTIVITY.UNKNOWN_ACTIVITY_TYPE
    const Icon = meta.icon
    const start = new Date(a.start_time), end = new Date(a.end_time)
    const durMin = Math.round((end.getTime() - start.getTime()) / 60000)
    return (
      <motion.div
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: idx * 0.04 }}
        className="flex items-start gap-3 px-4 py-2 hover:bg-ink-800/30 transition-colors relative"
      >
        <div className="flex flex-col items-center shrink-0 w-12">
          <span className="text-[10px] font-mono text-ink-500">
            {start.toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
        <div className="relative shrink-0">
          <div className="w-7 h-7 rounded-full flex items-center justify-center"
            style={{ backgroundColor: meta.hex + '15', border: `1px dashed ${meta.hex}66` }}>
            <Icon size={11} style={{ color: meta.hex }} />
          </div>
        </div>
        <div className="flex-1 min-w-0 pt-1">
          <div className="flex items-center gap-1.5">
            <span className="text-xs" style={{ color: meta.hex }}>{meta.label}</span>
            {a.distance_meters && (
              <span className="text-[10px] font-mono text-ink-400">
                · {a.distance_meters >= 1000 ? `${(a.distance_meters / 1000).toFixed(1)} km` : `${Math.round(a.distance_meters)} m`}
              </span>
            )}
          </div>
          <div className="text-[10px] text-ink-500 font-mono">
            {durMin < 60 ? `${durMin}min` : `${Math.floor(durMin / 60)}h${String(durMin % 60).padStart(2, '0')}`}
          </div>
        </div>
      </motion.div>
    )
  }
  return null
}

function DayMap({ dayData }: { dayData: { points: import('@/lib/api').LocationPoint[]; visits: import('@/lib/api').LocationVisit[] } }) {
  const [layer, setLayer] = useState<'mix' | 'trajectory'>('mix')
  return (
    <div className="relative h-full">
      <div className="absolute top-2 left-2 z-[500] flex gap-1 panel p-1 border-ink-700/50">
        {(['mix', 'trajectory'] as const).map((l) => (
          <button key={l} onClick={() => setLayer(l)}
            className={cn('px-2 py-1 rounded text-[10px] font-semibold transition-colors',
              layer === l ? 'bg-accent/20 text-accent' : 'text-ink-400 hover:text-ink-200')}>
            {l === 'mix' ? 'Visites + Path' : 'Trajets'}
          </button>
        ))}
      </div>
      <LocationMap
        mode={layer === 'trajectory' ? 'trajectory' : 'visits'}
        visits={layer === 'mix' ? dayData.visits : []}
        points={dayData.points}
      />
    </div>
  )
}

function DayTile({ icon: Icon, label, value, hex }: {
  icon: ComponentType<{ size?: number; className?: string }>
  label: string; value: string | number; hex: string
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
      className="panel px-3 py-2.5 flex items-center gap-2.5">
      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
        style={{ backgroundColor: hex + '22', border: `1px solid ${hex}40` }}>
        <Icon size={14} style={{ color: hex }} />
      </div>
      <div>
        <div className="text-base font-bold font-mono leading-none" style={{ color: hex }}>{value}</div>
        <div className="text-[10px] uppercase tracking-wider text-ink-400 mt-0.5">{label}</div>
      </div>
    </motion.div>
  )
}
