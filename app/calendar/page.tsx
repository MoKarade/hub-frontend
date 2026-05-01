'use client'

import { Sidebar } from '@/components/sidebar'
import { HubStatus } from '@/components/hub-status'
import {
  RefreshCw,
  Loader2,
  MapPin,
  Users,
  ExternalLink,
  Inbox,
} from 'lucide-react'
import { useState } from 'react'
import useSWR, { mutate as swrMutate } from 'swr'
import { api, type CalEventItem, type CalStatsResponse } from '@/lib/api'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'

export default function CalendarPage() {
  const [syncing, setSyncing] = useState(false)
  const { data: events } = useSWR<CalEventItem[]>('cal-events', () =>
    api.calendar.events({ limit: 100 })
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
      void swrMutate('cal-events')
      void swrMutate('cal-stats')
    } catch (err) {
      toast.apiError(err, 'Sync Calendar échoué')
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 px-4 sm:px-6 lg:px-8 pt-16 lg:pt-6 pb-6 max-w-[1400px] flex flex-col">
        <header className="mb-4 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Calendrier</h1>
            <p className="text-sm text-ink-400">
              Google Calendar synchronisé (365 jours passés + 180 futurs)
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
          <div className="grid grid-cols-3 gap-2 mb-3">
            <Kpi label="Total" value={stats.total} color="text-ink-100" />
            <Kpi label="À venir" value={stats.upcoming} color="text-accent" />
            <Kpi label="30 derniers jours" value={stats.past_30d} color="text-info" />
          </div>
        )}

        <div className="flex-1 min-h-0">
          {events && events.length === 0 && (
            <div className="ga-card p-6 text-center">
              <Inbox size={24} className="text-ink-500 mx-auto mb-2" />
              <div className="text-sm text-ink-300">Aucun évènement</div>
              <p className="text-xs text-ink-500 mt-1">
                Click &laquo;&nbsp;Sync Calendar&nbsp;&raquo; pour importer
              </p>
            </div>
          )}
          {events && events.length > 0 && (
            <div className="ga-card divide-y divide-ink-700/30 max-h-[70vh] overflow-y-auto">
              {events.map((e) => (
                <EventRow key={e.id} event={e} />
              ))}
            </div>
          )}
        </div>

        <div className="mt-auto pt-4">
          <HubStatus />
        </div>
      </main>
    </div>
  )
}

function Kpi({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="ga-card p-3">
      <div className="metric-label mb-1">{label}</div>
      <div className={cn('metric truncate', color)}>{value.toLocaleString('fr-CA')}</div>
    </div>
  )
}

function EventRow({ event }: { event: CalEventItem }) {
  const start = new Date(event.start_at)
  const isPast = start < new Date()
  return (
    <div className={cn('flex items-start gap-3 px-3 py-2', isPast && 'opacity-60')}>
      <div className="shrink-0 w-12 text-center">
        <div className="text-[10px] uppercase font-mono text-ink-500">
          {start.toLocaleDateString('fr-CA', { month: 'short' })}
        </div>
        <div className="text-xl font-bold text-ink-100">{start.getDate()}</div>
        {!event.all_day && (
          <div className="text-[10px] font-mono text-ink-500">
            {start.toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' })}
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
          {event.calendar_id && event.calendar_id !== 'marc.richard4@gmail.com' && (
            <span className="font-mono">{event.calendar_id.split('@')[0]}</span>
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
