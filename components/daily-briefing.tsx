'use client'

/**
 * <DailyBriefing/> — synthese du jour pour la page /me.
 *
 * Agrege en parallele :
 *  - Calendar events du jour (api.calendar.events avec since=today, until=tomorrow)
 *  - Tasks dues aujourd'hui ou en retard (api.tasks.list non-completed)
 *  - Health summary (steps + sleep derniere nuit) via api.healthData.summary
 *  - Insights critiques (api.insights.list) — count des severity 'critical'
 *
 * Layout bento 2x2 / 4 colonnes selon viewport. Pas de fake data : si une
 * source n'a rien, on affiche un dash.
 */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Calendar,
  CheckSquare,
  Heart,
  Sparkles,
  Loader2,
  Clock,
  AlertTriangle,
} from 'lucide-react'
import { api, type CalEventItem, type TaskItem } from '@/lib/api'

interface BriefingData {
  events: CalEventItem[]
  tasksDueToday: TaskItem[]
  tasksOverdue: TaskItem[]
  steps: number | null
  sleepHours: number | null
  criticalInsights: number
}

function greeting(): string {
  const h = new Date().getHours()
  if (h < 5) return 'Bonne nuit Marc'
  if (h < 12) return 'Bonjour Marc'
  if (h < 18) return 'Bon apres-midi Marc'
  return 'Bonsoir Marc'
}

function formatDate(): string {
  return new Date().toLocaleDateString('fr-CA', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('fr-CA', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function startOfToday(): string {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

function startOfTomorrow(): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

function endOfToday(): Date {
  const d = new Date()
  d.setHours(23, 59, 59, 999)
  return d
}

export function DailyBriefing() {
  const [data, setData] = useState<BriefingData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancel = false
    const load = async () => {
      const since = startOfToday()
      const until = startOfTomorrow()
      const todayEnd = endOfToday()

      // Toutes les requetes en parallele — chacune resilient a son echec
      const [eventsR, tasksR, healthR, insightsR] = await Promise.allSettled([
        api.calendar.events({ since, until, limit: 20 }),
        api.tasks.list({ completed: false, limit: 200 }),
        api.healthData.summary(),
        api.insights.list(),
      ])

      if (cancel) return

      const events =
        eventsR.status === 'fulfilled'
          ? eventsR.value.sort((a, b) => a.start_at.localeCompare(b.start_at))
          : []

      const allPendingTasks = tasksR.status === 'fulfilled' ? tasksR.value : []
      const tasksDueToday = allPendingTasks.filter((t) => {
        if (!t.due_at) return false
        const due = new Date(t.due_at)
        return due >= new Date(since) && due <= todayEnd
      })
      const tasksOverdue = allPendingTasks.filter((t) => {
        if (!t.due_at) return false
        return new Date(t.due_at) < new Date(since)
      })

      let steps: number | null = null
      let sleepHours: number | null = null
      if (healthR.status === 'fulfilled') {
        const stepsRow = healthR.value.by_metric.find((m) => m.metric === 'steps')
        steps = stepsRow?.last_value ?? null
        const sleepRow = healthR.value.by_metric.find(
          (m) => m.metric === 'sleep_seconds'
        )
        if (sleepRow?.last_value != null) {
          sleepHours = Math.round((sleepRow.last_value / 3600) * 10) / 10
        }
      }

      const criticalInsights =
        insightsR.status === 'fulfilled'
          ? insightsR.value.insights.filter((i) => i.severity === 'critical').length
          : 0

      setData({
        events,
        tasksDueToday,
        tasksOverdue,
        steps,
        sleepHours,
        criticalInsights,
      })
      setLoading(false)
    }
    void load()
    return () => {
      cancel = true
    }
  }, [])

  if (loading) {
    return (
      <section className="panel p-6 text-center text-ink-400">
        <Loader2 size={16} className="inline animate-spin mr-2" />
        Synthese du jour...
      </section>
    )
  }

  if (!data) return null

  const nextEvent = data.events[0]

  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-ink-100">
            {greeting()}
          </h2>
          <p className="text-xs text-ink-500 mt-0.5 capitalize">{formatDate()}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        {/* Calendrier */}
        <BriefingCard
          icon={<Calendar size={14} />}
          label="Aujourd'hui"
          href="/calendar"
        >
          {data.events.length === 0 ? (
            <div className="text-ink-500 text-xs">Pas d&apos;evenement</div>
          ) : (
            <>
              <div className="text-base font-mono font-semibold tabular-nums text-ink-100">
                {data.events.length} evenement{data.events.length > 1 ? 's' : ''}
              </div>
              {nextEvent && (
                <div className="text-[11px] text-ink-300 mt-1.5 truncate flex items-center gap-1">
                  <Clock size={10} className="text-accent shrink-0" />
                  <span className="font-mono shrink-0">
                    {nextEvent.all_day ? "tte la jrnee" : formatTime(nextEvent.start_at)}
                  </span>
                  <span className="truncate ml-1">
                    {nextEvent.summary ?? '(sans titre)'}
                  </span>
                </div>
              )}
            </>
          )}
        </BriefingCard>

        {/* Taches */}
        <BriefingCard
          icon={<CheckSquare size={14} />}
          label="A faire"
          href="/tasks"
        >
          {data.tasksDueToday.length === 0 && data.tasksOverdue.length === 0 ? (
            <div className="text-ink-500 text-xs">Rien d&apos;urgent</div>
          ) : (
            <>
              <div className="text-base font-mono font-semibold tabular-nums text-ink-100">
                {data.tasksDueToday.length} aujourd&apos;hui
              </div>
              {data.tasksOverdue.length > 0 && (
                <div className="text-[11px] text-data-negative mt-1.5 flex items-center gap-1">
                  <AlertTriangle size={10} className="shrink-0" />
                  {data.tasksOverdue.length} en retard
                </div>
              )}
              {data.tasksDueToday.length > 0 && (
                <div className="text-[11px] text-ink-400 mt-0.5 truncate">
                  {data.tasksDueToday[0].title ?? '(sans titre)'}
                </div>
              )}
            </>
          )}
        </BriefingCard>

        {/* Sante */}
        <BriefingCard icon={<Heart size={14} />} label="Sante" href="/health">
          {data.steps == null && data.sleepHours == null ? (
            <div className="text-ink-500 text-xs">Pas de data Garmin recente</div>
          ) : (
            <>
              <div className="text-base font-mono font-semibold tabular-nums text-ink-100">
                {data.steps != null
                  ? `${data.steps.toLocaleString('fr-CA')} pas`
                  : '—'}
              </div>
              <div className="text-[11px] text-ink-400 mt-1.5">
                {data.sleepHours != null
                  ? `${data.sleepHours} h de sommeil`
                  : 'Sommeil : —'}
              </div>
            </>
          )}
        </BriefingCard>

        {/* Insights */}
        <BriefingCard
          icon={<Sparkles size={14} />}
          label="Insights"
          href="/insights"
        >
          {data.criticalInsights === 0 ? (
            <div className="text-ink-500 text-xs">Rien de critique</div>
          ) : (
            <>
              <div className="text-base font-mono font-semibold tabular-nums text-data-negative">
                {data.criticalInsights} critique
                {data.criticalInsights > 1 ? 's' : ''}
              </div>
              <div className="text-[11px] text-ink-400 mt-1.5">
                A traiter en priorite
              </div>
            </>
          )}
        </BriefingCard>
      </div>
    </section>
  )
}

function BriefingCard({
  icon,
  label,
  href,
  children,
}: {
  icon: React.ReactNode
  label: string
  href: string
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      className="ga-card p-3 flex flex-col gap-1 min-w-0 hover:border-accent/40 transition-colors group"
    >
      <div className="flex items-center gap-1.5 text-ink-400 group-hover:text-accent transition-colors">
        {icon}
        <span className="text-[10px] font-semibold uppercase tracking-wider truncate">
          {label}
        </span>
      </div>
      <div className="min-w-0">{children}</div>
    </Link>
  )
}
