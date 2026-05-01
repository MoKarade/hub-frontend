'use client'

import { Sidebar } from '@/components/sidebar'
import { HubStatus } from '@/components/hub-status'
import {
  CheckSquare,
  Square,
  RefreshCw,
  Loader2,
  AlertCircle,
  Clock,
} from 'lucide-react'
import { useState } from 'react'
import useSWR, { mutate as swrMutate } from 'swr'
import { api, type TaskItem, type TasksStatsResponse } from '@/lib/api'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'

export default function TasksPage() {
  const [syncing, setSyncing] = useState(false)
  const [filter, setFilter] = useState<'pending' | 'completed' | 'all'>('pending')
  const completedFilter = filter === 'pending' ? false : filter === 'completed' ? true : undefined
  const { data: tasks } = useSWR<TaskItem[]>(
    ['tasks', filter],
    () => api.tasks.list({ completed: completedFilter, limit: 200 })
  )
  const { data: stats } = useSWR<TasksStatsResponse>('tasks-stats', () => api.tasks.stats())

  async function handleSync() {
    setSyncing(true)
    try {
      const res = await api.tasks.sync()
      toast.success(
        `Sync OK · ${res.tasks_ingested} nouveaux, ${res.tasks_updated} màj sur ${res.tasklists_synced} listes`,
        { description: `${res.duration_seconds}s` }
      )
      void swrMutate(['tasks', filter])
      void swrMutate('tasks-stats')
    } catch (err) {
      toast.apiError(err, 'Sync Tasks échoué')
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
            <h1 className="text-2xl font-semibold tracking-tight">Tâches</h1>
            <p className="text-sm text-ink-400">Google Tasks · toutes tes listes</p>
          </div>
          <button
            type="button"
            onClick={handleSync}
            disabled={syncing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-accent text-ink-950 text-xs font-semibold hover:bg-accent-light transition-colors disabled:opacity-50"
          >
            {syncing ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
            {syncing ? 'Sync…' : 'Sync Tasks'}
          </button>
        </header>

        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
            <Kpi label="Total" value={stats.total} icon={CheckSquare} color="text-ink-100" />
            <Kpi label="À faire" value={stats.pending} icon={Square} color="text-accent" />
            <Kpi label="Faites" value={stats.completed} icon={CheckSquare} color="text-data-positive" />
            <Kpi
              label="En retard"
              value={stats.overdue}
              icon={AlertCircle}
              color="text-data-negative"
            />
          </div>
        )}

        <div className="flex gap-1 mb-3">
          {(['pending', 'completed', 'all'] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={cn(
                'px-2.5 py-1 rounded-md text-[11px] border',
                filter === f
                  ? 'bg-accent/15 border-accent/30 text-accent'
                  : 'bg-ink-800 border-ink-700 text-ink-400 hover:text-ink-200'
              )}
            >
              {f === 'pending' ? 'À faire' : f === 'completed' ? 'Faites' : 'Toutes'}
            </button>
          ))}
        </div>

        <div className="flex-1 min-h-0">
          {tasks && tasks.length === 0 && (
            <div className="ga-card p-6 text-center">
              <CheckSquare size={24} className="text-ink-500 mx-auto mb-2" />
              <div className="text-sm text-ink-300">Aucune tâche</div>
            </div>
          )}
          {tasks && tasks.length > 0 && (
            <div className="ga-card divide-y divide-ink-700/30 max-h-[60vh] overflow-y-auto">
              {tasks.map((t) => (
                <TaskRow key={t.id} task={t} />
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

function Kpi({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string
  value: number
  icon: typeof CheckSquare
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

function TaskRow({ task }: { task: TaskItem }) {
  const isOverdue =
    !task.is_completed && task.due_at && new Date(task.due_at) < new Date()
  return (
    <div className={cn('flex items-start gap-3 px-3 py-2', task.is_completed && 'opacity-60')}>
      {task.is_completed ? (
        <CheckSquare size={14} className="text-data-positive shrink-0 mt-0.5" />
      ) : (
        <Square size={14} className="text-ink-500 shrink-0 mt-0.5" />
      )}
      <div className="flex-1 min-w-0">
        <div
          className={cn(
            'text-sm truncate',
            task.is_completed ? 'line-through text-ink-500' : 'text-ink-100'
          )}
        >
          {task.title || '(sans titre)'}
        </div>
        <div className="flex items-center gap-2 flex-wrap text-[11px] mt-0.5">
          {task.tasklist_title && (
            <span className="font-mono text-ink-500">{task.tasklist_title}</span>
          )}
          {task.due_at && (
            <span
              className={cn(
                'inline-flex items-center gap-1',
                isOverdue ? 'text-data-negative' : 'text-ink-400'
              )}
            >
              <Clock size={10} />
              {new Date(task.due_at).toLocaleDateString('fr-CA')}
            </span>
          )}
        </div>
        {task.notes && (
          <div className="text-[11px] text-ink-400 mt-0.5 truncate">{task.notes}</div>
        )}
      </div>
    </div>
  )
}
