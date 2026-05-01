'use client'

/**
 * /calendar - Vue type Google Calendar : jour / 3 jours / semaine / agenda.
 * Click event = modal detail. Couleurs par calendrier (hash deterministe).
 */

import { Sidebar } from '@/components/sidebar'
import { HubStatus } from '@/components/hub-status'
import {
  Calendar as CalendarIcon,
  RefreshCw,
  Loader2,
  MapPin,
  Users,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  X,
  Clock,
  Search,
  Calendar as CalendarMini,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import useSWR, { mutate as swrMutate } from 'swr'
import {
  startOfWeek,
  endOfWeek,
  addDays,
  startOfDay,
  endOfDay,
  eachDayOfInterval,
  format,
  isToday,
  isSameDay,
  differenceInMinutes,
  parseISO,
} from 'date-fns'
import { fr } from 'date-fns/locale'
import { api, type CalEventItem, type CalStatsResponse } from '@/lib/api'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'

type ViewMode = 'day' | '3days' | 'week' | 'agenda'

const VIEW_MODES: { id: ViewMode; label: string }[] = [
  { id: 'day', label: 'Jour' },
  { id: '3days', label: '3 jours' },
  { id: 'week', label: 'Semaine' },
  { id: 'agenda', label: 'Agenda' },
]

// Palette de couleurs pour les calendriers - hash sur calendar_id
const CALENDAR_COLORS = [
  '#5cdb95', // green accent
  '#5b8def', // blue
  '#f0a050', // orange
  '#f06363', // red
  '#a78bfa', // purple
  '#06b6d4', // cyan
  '#ec4899', // pink
  '#84cc16', // lime
  '#eab308', // yellow
]

function colorFor(calendarId: string): string {
  let h = 0
  for (let i = 0; i < calendarId.length; i++) {
    h = (h * 31 + calendarId.charCodeAt(i)) >>> 0
  }
  return CALENDAR_COLORS[h % CALENDAR_COLORS.length]
}

const HOUR_HEIGHT = 48 // px per hour
const HOURS = Array.from({ length: 24 }, (_, i) => i)

export default function CalendarPage() {
  const [view, setView] = useState<ViewMode>('week')
  const [anchor, setAnchor] = useState<Date>(new Date())
  const [selectedEvent, setSelectedEvent] = useState<CalEventItem | null>(null)
  const [search, setSearch] = useState('')
  const [syncing, setSyncing] = useState(false)

  const { from, to } = useMemo(() => computeRange(view, anchor), [view, anchor])

  const { data: events } = useSWR<CalEventItem[]>(
    ['cal-events', view, anchor.toISOString(), search],
    () =>
      api.calendar.events({
        since: from.toISOString(),
        until: to.toISOString(),
        q: search.trim() || undefined,
        limit: 1000,
      })
  )
  const { data: stats } = useSWR<CalStatsResponse>('cal-stats', () => api.calendar.stats())

  async function handleSync() {
    setSyncing(true)
    try {
      const res = await api.calendar.sync({ days_back: 365, days_forward: 180 })
      toast.success(
        `Sync OK · ${res.events_ingested} nouveaux, ${res.events_updated} màj`,
        { description: `${res.duration_seconds}s · ${res.calendars_synced} calendriers` }
      )
      void swrMutate(['cal-events', view, anchor.toISOString(), search])
      void swrMutate('cal-stats')
    } catch (err) {
      toast.apiError(err, 'Sync Calendar échoué')
    } finally {
      setSyncing(false)
    }
  }

  function navigate(delta: number) {
    const days = view === 'day' ? 1 : view === '3days' ? 3 : view === 'week' ? 7 : 7
    setAnchor(addDays(anchor, days * delta))
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 px-4 sm:px-6 lg:px-8 pt-16 lg:pt-6 pb-6 max-w-[1400px] flex flex-col">
        <header className="mb-3 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Calendrier</h1>
            <p className="text-xs text-ink-400">
              {stats ? `${stats.total} évènements · ${stats.upcoming} à venir` : 'Chargement…'}
            </p>
          </div>
          <button
            type="button"
            onClick={handleSync}
            disabled={syncing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-accent text-ink-950 text-xs font-semibold hover:bg-accent-light transition-colors disabled:opacity-50"
          >
            {syncing ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
            {syncing ? 'Sync…' : 'Sync'}
          </button>
        </header>

        {/* Toolbar */}
        <div className="ga-card p-2 mb-3 flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setAnchor(new Date())}
            className="px-2.5 py-1 rounded-md text-xs bg-ink-800 border border-ink-700 hover:border-ink-600"
          >
            Aujourd&apos;hui
          </button>
          <div className="flex">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="w-7 h-7 flex items-center justify-center rounded-l bg-ink-800 border border-ink-700 hover:border-ink-600"
            >
              <ChevronLeft size={13} />
            </button>
            <button
              type="button"
              onClick={() => navigate(1)}
              className="w-7 h-7 flex items-center justify-center rounded-r bg-ink-800 border border-ink-700 border-l-0 hover:border-ink-600"
            >
              <ChevronRight size={13} />
            </button>
          </div>
          <div className="text-sm font-semibold text-ink-100 ml-2">
            {formatRangeLabel(view, anchor, from, to)}
          </div>

          <div className="flex-1" />

          <div className="relative">
            <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-ink-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher…"
              className="bg-ink-800 border border-ink-700 rounded-md pl-7 pr-2 py-1 text-xs w-48 focus:outline-none focus:border-accent/60"
            />
          </div>

          <div className="flex">
            {VIEW_MODES.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => setView(v.id)}
                className={cn(
                  'px-2.5 py-1 text-xs border-y border-ink-700 first:border-l first:rounded-l last:border-r last:rounded-r',
                  view === v.id
                    ? 'bg-accent/15 border-accent/30 text-accent'
                    : 'bg-ink-800 text-ink-300 hover:text-ink-100 hover:bg-ink-700'
                )}
              >
                {v.label}
              </button>
            ))}
          </div>
        </div>

        {/* Vue */}
        <div className="flex-1 min-h-0">
          {view === 'agenda' ? (
            <AgendaView
              events={events ?? []}
              from={from}
              to={to}
              onClick={setSelectedEvent}
            />
          ) : (
            <TimeGridView
              events={events ?? []}
              from={from}
              to={to}
              onClick={setSelectedEvent}
            />
          )}
        </div>

        {selectedEvent && (
          <EventModal event={selectedEvent} onClose={() => setSelectedEvent(null)} />
        )}

        <div className="mt-3">
          <HubStatus />
        </div>
      </main>
    </div>
  )
}

// ============================================================================
// Vues
// ============================================================================

function computeRange(view: ViewMode, anchor: Date): { from: Date; to: Date } {
  if (view === 'day') {
    return { from: startOfDay(anchor), to: endOfDay(anchor) }
  }
  if (view === '3days') {
    return { from: startOfDay(anchor), to: endOfDay(addDays(anchor, 2)) }
  }
  if (view === 'week') {
    const from = startOfWeek(anchor, { weekStartsOn: 1 })
    return { from, to: endOfWeek(anchor, { weekStartsOn: 1 }) }
  }
  // agenda : 30 jours
  return { from: startOfDay(anchor), to: endOfDay(addDays(anchor, 30)) }
}

function formatRangeLabel(view: ViewMode, anchor: Date, from: Date, to: Date): string {
  if (view === 'day') {
    return format(anchor, 'EEEE d MMMM yyyy', { locale: fr })
  }
  if (view === '3days') {
    return `${format(from, 'd MMM', { locale: fr })} – ${format(to, 'd MMM yyyy', { locale: fr })}`
  }
  if (view === 'week') {
    return `Semaine du ${format(from, 'd MMM', { locale: fr })} au ${format(to, 'd MMM yyyy', { locale: fr })}`
  }
  return `30 jours à partir du ${format(from, 'd MMM yyyy', { locale: fr })}`
}

function TimeGridView({
  events,
  from,
  to,
  onClick,
}: {
  events: CalEventItem[]
  from: Date
  to: Date
  onClick: (e: CalEventItem) => void
}) {
  const days = eachDayOfInterval({ start: from, end: to })
  // All-day events séparés
  const allDay = events.filter((e) => e.all_day)
  const timed = events.filter((e) => !e.all_day)

  return (
    <div className="ga-card overflow-hidden flex flex-col h-full">
      {/* Headers jours */}
      <div
        className="grid border-b border-ink-700/50"
        style={{ gridTemplateColumns: `48px repeat(${days.length}, 1fr)` }}
      >
        <div />
        {days.map((d) => (
          <div
            key={d.toISOString()}
            className={cn(
              'text-center py-1.5 border-l border-ink-700/30',
              isToday(d) && 'bg-accent/5'
            )}
          >
            <div className="text-[10px] uppercase tracking-wider text-ink-500">
              {format(d, 'EEE', { locale: fr })}
            </div>
            <div
              className={cn(
                'text-base font-semibold',
                isToday(d) ? 'text-accent' : 'text-ink-100'
              )}
            >
              {format(d, 'd')}
            </div>
          </div>
        ))}
      </div>

      {/* Bandeau all-day */}
      {allDay.length > 0 && (
        <div
          className="grid border-b border-ink-700/50 min-h-[28px]"
          style={{ gridTemplateColumns: `48px repeat(${days.length}, 1fr)` }}
        >
          <div className="text-[9px] text-ink-500 self-center text-center">all-day</div>
          {days.map((d) => (
            <div key={d.toISOString()} className="border-l border-ink-700/30 p-1 space-y-0.5">
              {allDay
                .filter((e) => isSameDay(parseISO(e.start_at), d))
                .map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => onClick(e)}
                    className="block w-full text-left text-[11px] truncate px-1.5 py-0.5 rounded hover:opacity-80 transition-opacity"
                    style={{
                      background: colorFor(e.calendar_id) + '30',
                      borderLeft: `2px solid ${colorFor(e.calendar_id)}`,
                      color: '#e2e8f0',
                    }}
                  >
                    {e.summary || '(sans titre)'}
                  </button>
                ))}
            </div>
          ))}
        </div>
      )}

      {/* Grille heures */}
      <div className="flex-1 overflow-y-auto relative">
        <div
          className="grid relative"
          style={{
            gridTemplateColumns: `48px repeat(${days.length}, 1fr)`,
            minHeight: 24 * HOUR_HEIGHT,
          }}
        >
          {/* Col heures */}
          <div className="border-r border-ink-700/50">
            {HOURS.map((h) => (
              <div
                key={h}
                className="text-[10px] font-mono text-ink-500 text-right pr-1 -translate-y-1.5"
                style={{ height: HOUR_HEIGHT }}
              >
                {h.toString().padStart(2, '0')}:00
              </div>
            ))}
          </div>

          {/* Col jours */}
          {days.map((d) => {
            const dayEvents = timed.filter((e) => isSameDay(parseISO(e.start_at), d))
            return (
              <div
                key={d.toISOString()}
                className={cn(
                  'border-l border-ink-700/30 relative',
                  isToday(d) && 'bg-accent/[0.02]'
                )}
              >
                {/* Lignes horizontales */}
                {HOURS.map((h) => (
                  <div
                    key={h}
                    className="border-b border-ink-700/20"
                    style={{ height: HOUR_HEIGHT }}
                  />
                ))}
                {/* Events */}
                {dayEvents.map((e) => (
                  <EventBlock key={e.id} event={e} onClick={onClick} />
                ))}
                {/* Now indicator */}
                {isToday(d) && <NowLine />}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function EventBlock({
  event,
  onClick,
}: {
  event: CalEventItem
  onClick: (e: CalEventItem) => void
}) {
  const start = parseISO(event.start_at)
  const end = parseISO(event.end_at)
  const startMin = start.getHours() * 60 + start.getMinutes()
  const durMin = Math.max(20, differenceInMinutes(end, start))
  const top = (startMin * HOUR_HEIGHT) / 60
  const height = (durMin * HOUR_HEIGHT) / 60
  const color = colorFor(event.calendar_id)

  return (
    <button
      type="button"
      onClick={() => onClick(event)}
      className="absolute left-0.5 right-0.5 rounded text-left px-1.5 py-0.5 overflow-hidden hover:opacity-80 hover:z-10 transition-opacity"
      style={{
        top: `${top}px`,
        height: `${height}px`,
        background: color + '30',
        borderLeft: `2px solid ${color}`,
      }}
    >
      <div className="text-[11px] font-semibold text-ink-100 truncate leading-tight">
        {event.summary || '(sans titre)'}
      </div>
      <div className="text-[9px] font-mono text-ink-300 leading-tight">
        {format(start, 'HH:mm')}
        {height > 32 && ` – ${format(end, 'HH:mm')}`}
      </div>
      {height > 50 && event.location && (
        <div className="text-[9px] text-ink-400 truncate leading-tight">📍 {event.location}</div>
      )}
    </button>
  )
}

function NowLine() {
  const now = new Date()
  const top = ((now.getHours() * 60 + now.getMinutes()) * HOUR_HEIGHT) / 60
  return (
    <div className="absolute left-0 right-0 z-20 pointer-events-none" style={{ top }}>
      <div className="h-0.5 bg-data-negative" />
      <div className="absolute -left-1 -top-1 w-2 h-2 rounded-full bg-data-negative" />
    </div>
  )
}

function AgendaView({
  events,
  from,
  to,
  onClick,
}: {
  events: CalEventItem[]
  from: Date
  to: Date
  onClick: (e: CalEventItem) => void
}) {
  const days = eachDayOfInterval({ start: from, end: to })
  return (
    <div className="ga-card overflow-y-auto h-full">
      {days.map((d) => {
        const dayEvents = events.filter((e) => isSameDay(parseISO(e.start_at), d))
        if (dayEvents.length === 0) return null
        return (
          <div key={d.toISOString()} className="border-b border-ink-700/30 last:border-0">
            <div
              className={cn(
                'sticky top-0 z-10 px-3 py-1.5 backdrop-blur',
                isToday(d) ? 'bg-accent/15 text-accent' : 'bg-ink-900/95 text-ink-200'
              )}
            >
              <div className="text-xs font-semibold">
                {format(d, 'EEEE d MMMM', { locale: fr })}
              </div>
            </div>
            <div className="divide-y divide-ink-700/20">
              {dayEvents.map((e) => (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => onClick(e)}
                  className="w-full flex items-start gap-3 px-3 py-2 text-left hover:bg-ink-800/40 transition-colors"
                >
                  <div
                    className="w-1 self-stretch rounded shrink-0"
                    style={{ background: colorFor(e.calendar_id) }}
                  />
                  <div className="text-[10px] font-mono text-ink-500 w-20 shrink-0 pt-0.5">
                    {e.all_day ? 'all-day' : format(parseISO(e.start_at), 'HH:mm')}
                    {!e.all_day && (
                      <div className="text-ink-600">
                        {format(parseISO(e.end_at), 'HH:mm')}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-ink-100 truncate">
                      {e.summary || '(sans titre)'}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap text-[11px] text-ink-500 mt-0.5">
                      {e.location && (
                        <span className="inline-flex items-center gap-1 truncate max-w-[220px]">
                          <MapPin size={9} /> {e.location}
                        </span>
                      )}
                      {e.attendees.length > 0 && (
                        <span className="inline-flex items-center gap-1">
                          <Users size={9} /> {e.attendees.length}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )
      })}
      {events.length === 0 && (
        <div className="p-8 text-center text-sm text-ink-500">
          <CalendarMini size={24} className="mx-auto mb-2 text-ink-600" />
          Aucun évènement dans cette période
        </div>
      )}
    </div>
  )
}

// ============================================================================
// Modal détail
// ============================================================================

function EventModal({ event, onClose }: { event: CalEventItem; onClose: () => void }) {
  const start = parseISO(event.start_at)
  const end = parseISO(event.end_at)
  const color = colorFor(event.calendar_id)
  return (
    <div
      className="fixed inset-0 z-50 bg-ink-950/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="ga-card max-w-lg w-full overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="h-1" style={{ background: color }} />
        <div className="p-4">
          <div className="flex items-start justify-between gap-2 mb-3">
            <h2 className="text-base font-semibold text-ink-100 flex-1">
              {event.summary || '(sans titre)'}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="w-7 h-7 flex items-center justify-center rounded text-ink-400 hover:text-ink-100 hover:bg-ink-800"
            >
              <X size={13} />
            </button>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex items-start gap-2">
              <Clock size={12} className="text-ink-500 mt-0.5" />
              <div>
                <div className="text-ink-200">
                  {event.all_day
                    ? format(start, "EEEE d MMMM", { locale: fr }) + ' (toute la journée)'
                    : `${format(start, "EEEE d MMMM, HH:mm", { locale: fr })} → ${format(end, "HH:mm", { locale: fr })}`}
                </div>
                {!event.all_day && (
                  <div className="text-ink-500 text-[10px] font-mono">
                    {differenceInMinutes(end, start)} min
                  </div>
                )}
              </div>
            </div>

            {event.location && (
              <div className="flex items-start gap-2">
                <MapPin size={12} className="text-ink-500 mt-0.5" />
                <a
                  href={`https://maps.google.com/?q=${encodeURIComponent(event.location)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-info hover:text-info-light"
                >
                  {event.location}
                </a>
              </div>
            )}

            {event.attendees.length > 0 && (
              <div className="flex items-start gap-2">
                <Users size={12} className="text-ink-500 mt-0.5" />
                <div className="text-ink-300 text-[11px]">
                  {event.attendees.join(', ')}
                </div>
              </div>
            )}

            <div className="flex items-start gap-2">
              <CalendarIcon size={12} className="text-ink-500 mt-0.5" />
              <span className="text-ink-400 font-mono text-[10px]">{event.calendar_id}</span>
            </div>

            {event.status && event.status !== 'confirmed' && (
              <div className="text-[11px] uppercase tracking-wider text-warn">
                Statut : {event.status}
              </div>
            )}
          </div>

          {event.html_link && (
            <a
              href={event.html_link}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-accent text-ink-950 text-xs font-semibold hover:bg-accent-light"
            >
              Ouvrir sur Google Calendar
              <ExternalLink size={11} />
            </a>
          )}
        </div>
      </div>
    </div>
  )
}
