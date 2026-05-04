'use client'

import { motion, AnimatePresence } from 'framer-motion'
import useSWR from 'swr'
import dynamic from 'next/dynamic'
import { useState, useMemo, useCallback } from 'react'
import {
  X, ChevronLeft, ChevronRight, MapPin, Home, Briefcase, Navigation,
  Sparkles, Car, Train, Plane, Footprints, Bike, Clock, Ruler, RefreshCw, Calendar,
  CalendarDays, Camera, type LucideIcon,
} from 'lucide-react'
import { api, photoThumbUrl, type LocationVisit, type LocationActivity, type CalEventItem, type PhotoItem } from '@/lib/api'
import { cn } from '@/lib/utils'

const LocationMap = dynamic(
  () => import('@/components/location-map').then(m => ({ default: m.LocationMap })),
  { ssr: false, loading: () => <div className="h-full w-full flex items-center justify-center text-ink-400 text-sm font-mono">Chargement…</div> }
)

const SEMANTIC: Record<string, { label: string; hex: string; icon: LucideIcon }> = {
  HOME:              { label: 'Domicile',     hex: '#5cdb95', icon: Home       },
  INFERRED_HOME:     { label: 'Domicile inf', hex: '#3db37a', icon: Home       },
  WORK:              { label: 'Travail',      hex: '#5fb3f4', icon: Briefcase  },
  INFERRED_WORK:     { label: 'Travail inf',  hex: '#3a8fd6', icon: Briefcase  },
  SEARCHED_ADDRESS:  { label: 'Adresse',      hex: '#ffb84d', icon: Navigation },
  ALIASED_LOCATION:  { label: 'Favori',       hex: '#c084fc', icon: Sparkles   },
  UNKNOWN:           { label: 'Lieu',         hex: '#8b95a3', icon: MapPin     },
}

const ACTIVITY: Record<string, { label: string; hex: string; icon: LucideIcon }> = {
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

  // Cross-data : Calendar events ce jour-la
  const dayStart = `${date}T00:00:00Z`
  const dayEnd = `${date}T23:59:59Z`
  const { data: calEvents } = useSWR(
    ['day-calendar', date],
    () => api.calendar.events({ since: dayStart, until: dayEnd, limit: 50 })
      .catch(() => [] as CalEventItem[])
  )
  // Cross-data : Photos prises ce jour
  const { data: dayPhotos } = useSWR(
    ['day-photos', date],
    () => api.photos.list({ since: dayStart, until: dayEnd, limit: 24 })
      .catch(() => [] as PhotoItem[])
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

      {/* Calendar events + photos du jour */}
      {((calEvents && calEvents.length > 0) || (dayPhotos && dayPhotos.length > 0)) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {calEvents && calEvents.length > 0 && (
            <CalendarPanel events={calEvents} date={date} />
          )}
          {dayPhotos && dayPhotos.length > 0 && (
            <PhotosPanel photos={dayPhotos} date={date} />
          )}
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

// ─── CalendarPanel + EventDetailModal ─────────────────────────────────────────

function CalendarPanel({ events, date }: { events: CalEventItem[]; date: string }) {
  const [selected, setSelected] = useState<CalEventItem | null>(null)
  return (
    <>
      <div className="panel p-3">
        <div className="flex items-center gap-1.5 mb-2">
          <CalendarDays size={12} className="text-blue-400" />
          <span className="text-[10px] uppercase tracking-wider font-semibold text-ink-400">
            Calendrier · {events.length} événement{events.length > 1 ? 's' : ''}
          </span>
          <span className="ml-auto text-[10px] font-mono text-ink-600">
            {new Date(date + 'T00:00:00').toLocaleDateString('fr-CA', { weekday: 'short', day: 'numeric', month: 'short' })}
          </span>
        </div>
        <div className="space-y-1 max-h-[200px] overflow-y-auto">
          {events.map((e) => {
            const start = e.start_at ? new Date(e.start_at) : null
            const end = e.end_at ? new Date(e.end_at) : null
            const isAllDay = e.all_day || (!start || (start.getUTCHours() === 0 && start.getUTCMinutes() === 0 && end?.getUTCHours() === 0))
            return (
              <button key={e.id}
                onClick={() => setSelected(e)}
                className="w-full text-left flex items-start gap-2 text-xs py-1.5 px-1.5 rounded border-l-2 border-blue-400/30 hover:border-blue-400 hover:bg-ink-800/50 transition-colors group">
                <span className="font-mono text-blue-400/80 shrink-0 w-14 group-hover:text-blue-300">
                  {isAllDay ? 'jour' : start
                    ? start.toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' })
                    : '--:--'}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-ink-200 truncate group-hover:text-ink-100">{e.summary ?? '(sans titre)'}</div>
                  {e.location && (
                    <div className="text-[10px] text-ink-500 truncate">📍 {e.location}</div>
                  )}
                  {!isAllDay && start && end && (
                    <div className="text-[10px] text-ink-600 font-mono">
                      → {end.toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' })}
                      {' '}({Math.round((end.getTime() - start.getTime()) / 60000)}min)
                    </div>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      <AnimatePresence>
        {selected && <EventDetailModal event={selected} onClose={() => setSelected(null)} />}
      </AnimatePresence>
    </>
  )
}

function EventDetailModal({ event, onClose }: { event: CalEventItem; onClose: () => void }) {
  const start = event.start_at ? new Date(event.start_at) : null
  const end = event.end_at ? new Date(event.end_at) : null
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <motion.div
        initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
        className="panel w-full max-w-md p-5 space-y-3 max-h-[85vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="text-[10px] uppercase tracking-wider font-semibold text-blue-400 mb-1">
              📅 Événement Calendar
            </div>
            <h3 className="text-base font-bold text-ink-100">{event.summary ?? '(sans titre)'}</h3>
          </div>
          <button onClick={onClose} className="text-ink-500 hover:text-ink-200">
            <X size={16} />
          </button>
        </div>
        <div className="space-y-2 text-xs">
          {start && (
            <div className="flex items-start gap-2">
              <CalendarDays size={11} className="text-blue-400 mt-0.5" />
              <div className="font-mono text-ink-300">
                {start.toLocaleDateString('fr-CA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                <br />
                {start.toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' })}
                {end && <> → {end.toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' })}</>}
              </div>
            </div>
          )}
          {event.location && (
            <div className="flex items-start gap-2">
              <MapPin size={11} className="text-amber-400 mt-0.5" />
              <div className="text-ink-300">{event.location}</div>
            </div>
          )}
          {event.attendees && event.attendees.length > 0 && (
            <div className="pt-2 border-t border-ink-800/60">
              <div className="text-[10px] uppercase tracking-wider font-semibold text-ink-400 mb-1">
                Participants ({event.attendees.length})
              </div>
              <div className="flex flex-wrap gap-1">
                {event.attendees.slice(0, 12).map((a, i) => (
                  <span key={i} className="px-1.5 py-0.5 rounded bg-ink-800 border border-ink-700 text-[10px] font-mono text-ink-300">
                    {a}
                  </span>
                ))}
              </div>
            </div>
          )}
          {event.calendar_id && (
            <div className="pt-2 border-t border-ink-800/60 text-[10px] font-mono text-ink-500">
              Calendrier : {event.calendar_id}
            </div>
          )}
          {event.html_link && (
            <a href={event.html_link} target="_blank" rel="noopener noreferrer"
              className="block text-center mt-3 px-3 py-1.5 rounded text-xs font-semibold border border-blue-500/40 text-blue-400 hover:bg-blue-500/10 transition-colors">
              Ouvrir dans Google Calendar →
            </a>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}

// ─── PhotosPanel + Lightbox ───────────────────────────────────────────────────

function PhotosPanel({ photos, date }: { photos: PhotoItem[]; date: string }) {
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null)
  return (
    <>
      <div className="panel p-3">
        <div className="flex items-center gap-1.5 mb-2">
          <Camera size={12} className="text-amber-400" />
          <span className="text-[10px] uppercase tracking-wider font-semibold text-ink-400">
            Photos · {photos.length} prise{photos.length > 1 ? 's' : ''}
          </span>
          <span className="ml-auto text-[10px] font-mono text-ink-600">
            click pour agrandir
          </span>
        </div>
        <div className="grid grid-cols-6 gap-1 bg-ink-950/50 rounded overflow-hidden">
          {photos.slice(0, 24).map((p, i) => (
            <button key={p.id} onClick={() => setLightboxIdx(i)}
              className="relative aspect-square bg-ink-900 hover:scale-105 transition-transform group">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photoThumbUrl(p.media_id, 200)} alt={p.filename ?? ''}
                className="w-full h-full object-cover" loading="lazy"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
              {p.is_video && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-white text-xs">
                  ▶
                </div>
              )}
              <div className="absolute inset-0 ring-1 ring-inset ring-transparent group-hover:ring-accent transition-colors" />
            </button>
          ))}
        </div>
        {photos.length > 24 && (
          <div className="text-[10px] text-ink-600 mt-1 text-center">
            … et {photos.length - 24} autre{photos.length - 24 > 1 ? 's' : ''}
          </div>
        )}
      </div>

      <AnimatePresence>
        {lightboxIdx !== null && (
          <PhotoLightbox photos={photos} idx={lightboxIdx}
            onChange={setLightboxIdx} onClose={() => setLightboxIdx(null)} date={date} />
        )}
      </AnimatePresence>
    </>
  )
}

function PhotoLightbox({ photos, idx, onChange, onClose, date }: {
  photos: PhotoItem[]; idx: number
  onChange: (i: number | null) => void
  onClose: () => void; date: string
}) {
  const photo = photos[idx]
  const next = () => onChange(idx + 1 < photos.length ? idx + 1 : 0)
  const prev = () => onChange(idx - 1 >= 0 ? idx - 1 : photos.length - 1)
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/95 p-4"
      onClick={onClose}
    >
      <button onClick={(e) => { e.stopPropagation(); onClose() }}
        className="absolute top-4 right-4 z-10 text-ink-300 hover:text-white p-2 rounded-full bg-black/50 hover:bg-black/80">
        <X size={20} />
      </button>
      {photos.length > 1 && (
        <>
          <button onClick={(e) => { e.stopPropagation(); prev() }}
            className="absolute left-4 z-10 text-ink-300 hover:text-white p-3 text-3xl rounded-full bg-black/50 hover:bg-black/80">
            ←
          </button>
          <button onClick={(e) => { e.stopPropagation(); next() }}
            className="absolute right-4 z-10 text-ink-300 hover:text-white p-3 text-3xl rounded-full bg-black/50 hover:bg-black/80">
            →
          </button>
        </>
      )}
      <motion.div
        key={photo.id}
        initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        className="relative max-w-[95vw] max-h-[90vh] flex flex-col items-center"
        onClick={(e) => e.stopPropagation()}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photoThumbUrl(photo.media_id, 1600)} alt={photo.filename ?? ''}
          className="max-w-full max-h-[80vh] object-contain rounded" />
        <div className="mt-3 text-center text-xs text-ink-300 font-mono space-y-0.5">
          <div className="text-ink-100 text-sm">{photo.filename ?? '(sans nom)'}</div>
          <div className="text-ink-500">
            {new Date(photo.creation_time).toLocaleString('fr-CA', { dateStyle: 'long', timeStyle: 'short' })}
          </div>
          {photo.width && photo.height && (
            <div className="text-ink-600">{photo.width}×{photo.height}px</div>
          )}
          {photo.camera_make && (
            <div className="text-ink-600">📷 {photo.camera_make} {photo.camera_model ?? ''}</div>
          )}
          {photo.location_name && (
            <div className="text-amber-400">📍 {photo.location_name}</div>
          )}
          <div className="text-ink-700 text-[10px] pt-1">{idx + 1} / {photos.length} · {date}</div>
        </div>
      </motion.div>
    </motion.div>
  )
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
  icon: LucideIcon
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
