'use client'

import { Sidebar } from '@/components/sidebar'
import { HubStatus } from '@/components/hub-status'
import {
  Calendar as CalendarIcon,
  RefreshCw,
  Loader2,
  MapPin,
  Users,
  ExternalLink,
  Inbox,
  Clock,
  Search,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import useSWR, { mutate as swrMutate } from 'swr'
import { api, type CalEventItem, type CalStatsResponse } from '@/lib/api'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'

export default function CalendarPage() {
  const [syncing, setSyncing] = useState(false)
  const [search, setSearch] = useState('')

  const { data: events } = useSWR<CalEventItem[]>(
    ['cal-events', search],
    () => api.calendar.events({ q: search.trim() || undefined, limit: 200 })
  )
  const { data: stats } = useSWR<CalStatsResponse>('cal-stats', () => api.calendar.stats())

  async function handleSync() {
    setSyncing(true)
    try {
      const res = await api.calendar.sync({ days_back: 365, days_forward: 180 })
      toast.success(
        `Sync OK · ${res.events_ingested} nouveaux, ${res.events_updated} màj sur ${res.calendars_synced} calendriers`,
        { description: `${res.duration_seconds}s` }
      )
      void swrMutate(['cal-events', search])
      void swrMutate('cal-stats')
    } catch (err) {
      toast.apiError(err, 'Sync Calendar échoué')
    } finally {
      setSyncing(false)
    }
  }

  const grouped = useMemo(() => groupEvents(events ?? []), [events])

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 px-4 sm:px-6 lg:px-8 pt-16 lg:pt-6 pb-6 max-w-[1400px] flex flex-col">
        <header className="mb-4 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Calendrier</h1>
            <p className="text-sm text-ink-400">
              Google Calendar · 365j passés + 180j futurs
            </p>
          </div>
          <button
            type="button"
            onClick={handleSync}
            disabled={syncing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-accent text-ink-950 text-xs font-semibold hover:bg-accent-light transition-colors disabled:opacity-50"
          >
            {syncing ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
            {syncing ? 'Sync…' : 'Sync Calendar'}
          </button>
        </header>

        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
            <Kpi
              label="Total"
              value={stats.total}
              icon={CalendarIcon}
              color="text-ink-100"
            />
            <Kpi
              label="À venir"
              value={stats.upcoming}
              icon={Clock}
              color="text-accent"
            />
            <Kpi
              label="30 derniers j"
              value={stats.past_30d}
              icon={CalendarIcon}
              color="text-info"
            />
            <Kpi
              label="Calendriers"
              value={stats.by_calendar.length}
              icon={Users}
              color="text-warn"
            />
          </div>
        )}

        <div className="relative mb-3">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Recherche par titre…"
            className="w-full bg-ink-800 border border-ink-700 rounded-md pl-7 pr-3 py-1.5 text-xs focus:outline-none focus:border-accent/60"
          />
        </div>

        <div className="flex-1 min-h-0 space-y-3">
          {events && events.length === 0 && (
            <div className="ga-card p-6 text-center">
              <Inbox size={24} className="text-ink-500 mx-auto mb-2" />
              <div className="text-sm text-ink-300">Aucun évènement</div>
              <p className="text-xs text-ink-500 mt-1">
                Click &laquo;&nbsp;Sync Calendar&nbsp;&raquo; pour importer
              </p>
            </div>
          )}
          {grouped.today.length > 0 && (
            <EventGroup title="Aujourd'hui" events={grouped.today} accent />
          )}
          {grouped.thisWeek.length > 0 && (
            <EventGroup title="Cette semaine" events={grouped.thisWeek} />
          )}
          {grouped.upcoming.length > 0 && (
            <EventGroup title="À venir" events={grouped.upcoming} />
          )}
          {grouped.past.length > 0 && (
            <EventGroup title="Passés" events={grouped.past} muted />
          )}
        </div>

        <div className="mt-auto pt-4">
          <HubStatus />
        </div>
      </main>
    </div>
  )
}

function groupEvents(events: CalEventItem[]) {
  const now = new Date()
  const today0 = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const tomorrow0 = new Date(today0)
  tomorrow0.setDate(tomorrow0.getDate() + 1)
  const weekEnd = new Date(today0)
  weekEnd.setDate(weekEnd.getDate() + 7)

  const today: CalEventItem[] = []
  const thisWeek: CalEventItem[] = []
  const upcoming: CalEventItem[] = []
  const past: CalEventItem[] = []

  for (const ev of events) {
    const start = new Date(ev.start_at)
    if (start < today0) past.push(ev)
    else if (start < tomorrow0) today.push(ev)
    else if (start < weekEnd) thisWeek.push(ev)
    else upcoming.push(ev)
  }

  return {
    today: today.sort((a, b) => +new Date(a.start_at) - +new Date(b.start_at)),
    thisWeek: thisWeek.sort((a, b) => +new Date(a.start_at) - +new Date(b.start_at)),
    upcoming: upcoming.sort((a, b) => +new Date(a.start_at) - +new Date(b.start_at)).slice(0, 30),
    past: past.sort((a, b) => +new Date(b.start_at) - +new Date(a.start_at)).slice(0, 20),
  }
}

function Kpi({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string
  value: number
  icon: typeof CalendarIcon
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

function EventGroup({
  title,
  events,
  accent = false,
  muted = false,
}: {
  title: string
  events: CalEventItem[]
  accent?: boolean
  muted?: boolean
}) {
  return (
    <div className={cn('ga-card overflow-hidden', accent && 'border-accent/30 bg-accent/5')}>
      <div className="px-3 py-2 flex items-center justify-between border-b border-ink-700/50">
        <h3
          className={cn(
            'text-xs font-semibold uppercase tracking-wider',
            accent ? 'text-accent' : muted ? 'text-ink-500' : 'text-ink-300'
          )}
        >
          {title}
        </h3>
        <span className="text-[10px] font-mono text-ink-500">{events.length}</span>
      </div>
      <div className="divide-y divide-ink-700/30 max-h-[40vh] overflow-y-auto">
        {events.map((e) => (
          <EventRow key={e.id} event={e} muted={muted} />
        ))}
      </div>
    </div>
  )
}

function EventRow({ event, muted }: { event: CalEventItem; muted?: boolean }) {
  const start = new Date(event.start_at)
  const end = new Date(event.end_at)
  const durationMin = (+end - +start) / 60000
  const sameDay = start.toDateString() === end.toDateString()

  return (
    <div className={cn('flex items-start gap-3 px-3 py-2', muted && 'opacity-60')}>
      <div className="shrink-0 w-14 text-center">
        <div className="text-[10px] uppercase font-mono text-ink-500">
          {start.toLocaleDateString('fr-CA', { weekday: 'short', day: 'numeric', month: 'short' })}
        </div>
        <div className="text-base font-bold text-ink-100">
          {event.all_day
            ? '—'
            : start.toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' })}
        </div>
        {!event.all_day && sameDay && (
          <div className="text-[9px] font-mono text-ink-500">
            {Math.round(durationMin)}min
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-ink-100 truncate">
          {event.summary || <em className="text-ink-600">(sans titre)</em>}
        </div>
        <div className="flex items-center gap-2 flex-wrap text-[11px] text-ink-500 mt-0.5">
          {event.location && (
            <span className="inline-flex items-center gap-1 truncate max-w-[200px]">
              <MapPin size={10} /> {event.location}
            </span>
          )}
          {event.attendees.length > 0 && (
            <span className="inline-flex items-center gap-1">
              <Users size={10} /> {event.attendees.length}
            </span>
          )}
          {event.calendar_id &&
            event.calendar_id !== 'marc.richard4@gmail.com' &&
            !event.calendar_id.includes('group.calendar') && (
              <span className="font-mono text-ink-600 truncate max-w-[120px]">
                {event.calendar_id.split('@')[0]}
              </span>
            )}
        </div>
      </div>
      {event.html_link && (
        <a
          href={event.html_link}
          target="_blank"
          rel="noopener noreferrer"
          className="text-ink-500 hover:text-accent shrink-0"
          title="Ouvrir dans Google Calendar"
        >
          <ExternalLink size={12} />
        </a>
      )}
    </div>
  )
}
