'use client'

/**
 * /tasks - CRUD complet : valider, ajouter, supprimer, click pour détails.
 * Couleur par tasklist. Filtre par liste, par statut, par due_at.
 */

import { Sidebar } from '@/components/sidebar'
import { HubStatus } from '@/components/hub-status'
import {
  CheckSquare,
  Square,
  RefreshCw,
  Loader2,
  AlertCircle,
  Clock,
  Plus,
  Trash2,
  X,
  Calendar,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import useSWR, { mutate as swrMutate } from 'swr'
import { api, type TaskItem, type TasksStatsResponse } from '@/lib/api'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'

// Couleur deterministe par tasklist
const COLORS = ['#5cdb95', '#5b8def', '#f0a050', '#a78bfa', '#06b6d4', '#ec4899', '#84cc16', '#f06363']
function colorFor(id: string): string {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return COLORS[h % COLORS.length]
}

type Filter = 'pending' | 'completed' | 'overdue' | 'all'

export default function TasksPage() {
  const [syncing, setSyncing] = useState(false)
  const [filter, setFilter] = useState<Filter>('pending')
  const [activeList, setActiveList] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [selected, setSelected] = useState<TaskItem | null>(null)

  const completedFilter =
    filter === 'pending' ? false : filter === 'completed' ? true : undefined

  const { data: tasks } = useSWR<TaskItem[]>(
    ['tasks', filter, activeList],
    () =>
      api.tasks.list({
        completed: completedFilter,
        tasklist_id: activeList ?? undefined,
        limit: 500,
      })
  )
  const { data: stats } = useSWR<TasksStatsResponse>('tasks-stats', () => api.tasks.stats())
  const { data: tasklists } = useSWR('tasks-lists', () => api.tasks.lists())

  // Filtre overdue côté front
  const visibleTasks = useMemo(() => {
    if (!tasks) return []
    if (filter !== 'overdue') return tasks
    const now = new Date()
    return tasks.filter(
      (t) => !t.is_completed && t.due_at && new Date(t.due_at) < now
    )
  }, [tasks, filter])

  async function handleSync() {
    setSyncing(true)
    try {
      const res = await api.tasks.sync()
      toast.success(`Sync OK · ${res.tasks_ingested} nouveaux, ${res.tasks_updated} màj`, {
        description: `${res.duration_seconds}s · ${res.tasklists_synced} listes`,
      })
      void swrMutate(['tasks', filter, activeList])
      void swrMutate('tasks-stats')
      void swrMutate('tasks-lists')
    } catch (err) {
      toast.apiError(err, 'Sync Tasks échoué')
    } finally {
      setSyncing(false)
    }
  }

  async function handleToggle(t: TaskItem) {
    try {
      await api.tasks.toggle(t.task_id, !t.is_completed)
      void swrMutate(['tasks', filter, activeList])
      void swrMutate('tasks-stats')
    } catch (err) {
      toast.apiError(err, 'Toggle échoué (re-consent peut-être nécessaire)')
    }
  }

  async function handleDelete(t: TaskItem) {
    if (!confirm(`Supprimer la tâche "${t.title}" ?`)) return
    try {
      await api.tasks.remove(t.task_id)
      toast.success('Tâche supprimée')
      void swrMutate(['tasks', filter, activeList])
      void swrMutate('tasks-stats')
      setSelected(null)
    } catch (err) {
      toast.apiError(err, 'Suppression échouée')
    }
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 px-4 sm:px-6 lg:px-8 pt-16 lg:pt-6 pb-6 max-w-[1400px] flex flex-col">
        <header className="mb-3 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Tâches</h1>
            <p className="text-xs text-ink-400">
              {stats
                ? `${stats.pending} à faire · ${stats.completed} faites · ${stats.overdue} en retard`
                : '…'}
            </p>
          </div>
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => setShowAdd(true)}
              disabled={!tasklists || tasklists.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-accent text-ink-950 text-xs font-semibold hover:bg-accent-light transition-colors disabled:opacity-50"
            >
              <Plus size={12} />
              Nouvelle tâche
            </button>
            <button
              type="button"
              onClick={handleSync}
              disabled={syncing}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-ink-800 border border-ink-700 hover:border-ink-600 text-xs"
            >
              {syncing ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
            </button>
          </div>
        </header>

        {/* KPIs */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
            <Kpi label="Total" value={stats.total} icon={CheckSquare} color="text-ink-100" />
            <Kpi label="À faire" value={stats.pending} icon={Square} color="text-accent" />
            <Kpi label="Faites" value={stats.completed} icon={CheckSquare} color="text-data-positive" />
            <Kpi label="En retard" value={stats.overdue} icon={AlertCircle} color="text-data-negative" />
          </div>
        )}

        {/* Filtres status + listes */}
        <div className="flex flex-wrap gap-1 mb-3">
          {(['pending', 'overdue', 'completed', 'all'] as Filter[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={cn(
                'px-2.5 py-1 rounded-md text-[11px] border transition-colors',
                filter === f
                  ? 'bg-accent/15 border-accent/30 text-accent'
                  : 'bg-ink-800 border-ink-700 text-ink-400 hover:text-ink-200'
              )}
            >
              {f === 'pending' ? 'À faire' : f === 'overdue' ? 'En retard' : f === 'completed' ? 'Faites' : 'Toutes'}
            </button>
          ))}
          <div className="flex-1" />
          {tasklists && tasklists.length > 0 && (
            <select
              value={activeList ?? ''}
              onChange={(e) => setActiveList(e.target.value || null)}
              className="bg-ink-800 border border-ink-700 rounded-md px-2 py-1 text-[11px]"
            >
              <option value="">Toutes les listes</option>
              {tasklists.map((tl) => (
                <option key={tl.id} value={tl.id}>
                  {tl.title ?? '(sans nom)'} ({tl.count})
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="flex-1 min-h-0">
          {visibleTasks.length === 0 ? (
            <div className="ga-card p-8 text-center">
              <CheckSquare size={28} className="text-ink-600 mx-auto mb-2" />
              <div className="text-sm text-ink-400">Aucune tâche</div>
            </div>
          ) : (
            <div className="ga-card divide-y divide-ink-700/20 max-h-[60vh] overflow-y-auto">
              {visibleTasks.map((t) => (
                <TaskRow
                  key={t.id}
                  task={t}
                  onToggle={() => handleToggle(t)}
                  onClick={() => setSelected(t)}
                />
              ))}
            </div>
          )}
        </div>

        {showAdd && tasklists && (
          <AddTaskModal
            tasklists={tasklists}
            onClose={() => setShowAdd(false)}
            onCreated={() => {
              void swrMutate(['tasks', filter, activeList])
              void swrMutate('tasks-stats')
            }}
          />
        )}
        {selected && (
          <TaskDetailModal
            task={selected}
            onClose={() => setSelected(null)}
            onToggle={() => handleToggle(selected)}
            onDelete={() => handleDelete(selected)}
          />
        )}

        <div className="mt-3">
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

function TaskRow({
  task,
  onToggle,
  onClick,
}: {
  task: TaskItem
  onToggle: () => void
  onClick: () => void
}) {
  const isOverdue =
    !task.is_completed && task.due_at && new Date(task.due_at) < new Date()
  const color = colorFor(task.tasklist_id)

  return (
    <div className="flex items-start gap-3 px-3 py-2 hover:bg-ink-800/40 transition-colors">
      <div className="w-1 self-stretch rounded shrink-0" style={{ background: color }} />
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onToggle()
        }}
        className="shrink-0 mt-0.5"
        aria-label={task.is_completed ? 'Décocher' : 'Cocher'}
      >
        {task.is_completed ? (
          <CheckSquare size={15} className="text-data-positive" />
        ) : (
          <Square size={15} className="text-ink-400 hover:text-ink-200" />
        )}
      </button>
      <button
        type="button"
        onClick={onClick}
        className="flex-1 min-w-0 text-left"
      >
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
            <span
              className="inline-flex items-center gap-1 px-1.5 py-0 rounded font-mono text-[10px]"
              style={{ background: color + '20', color }}
            >
              {task.tasklist_title}
            </span>
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
          {task.notes && <span className="text-ink-500 truncate">📝 {task.notes.slice(0, 60)}</span>}
        </div>
      </button>
    </div>
  )
}

function AddTaskModal({
  tasklists,
  onClose,
  onCreated,
}: {
  tasklists: { id: string; title: string | null; count: number }[]
  onClose: () => void
  onCreated: () => void
}) {
  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')
  const [due, setDue] = useState('')
  const [tasklistId, setTasklistId] = useState(tasklists[0]?.id ?? '')
  const [creating, setCreating] = useState(false)

  async function submit() {
    if (!title.trim() || !tasklistId) return
    setCreating(true)
    try {
      await api.tasks.create({
        tasklist_id: tasklistId,
        title: title.trim(),
        notes: notes.trim() || undefined,
        due_at: due ? new Date(due).toISOString() : undefined,
      })
      toast.success('Tâche créée')
      onCreated()
      onClose()
    } catch (err) {
      toast.apiError(err, 'Création échouée')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-ink-950/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="ga-card max-w-md w-full" onClick={(e) => e.stopPropagation()}>
        <div className="p-4 border-b border-ink-700/50 flex items-center justify-between">
          <h2 className="text-base font-semibold">Nouvelle tâche</h2>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded text-ink-400 hover:text-ink-100 hover:bg-ink-800"
          >
            <X size={13} />
          </button>
        </div>
        <div className="p-4 space-y-3">
          <div>
            <label className="metric-label block mb-1">Liste</label>
            <select
              value={tasklistId}
              onChange={(e) => setTasklistId(e.target.value)}
              className="w-full bg-ink-800 border border-ink-700 rounded-md px-2 py-1.5 text-sm"
            >
              {tasklists.map((tl) => (
                <option key={tl.id} value={tl.id}>
                  {tl.title ?? '(sans nom)'}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="metric-label block mb-1">Titre *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Que faire ?"
              autoFocus
              className="w-full bg-ink-800 border border-ink-700 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:border-accent/60"
            />
          </div>
          <div>
            <label className="metric-label block mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full bg-ink-800 border border-ink-700 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:border-accent/60 resize-none"
            />
          </div>
          <div>
            <label className="metric-label block mb-1">Échéance</label>
            <input
              type="date"
              value={due}
              onChange={(e) => setDue(e.target.value)}
              className="w-full bg-ink-800 border border-ink-700 rounded-md px-2 py-1.5 text-sm"
            />
          </div>
        </div>
        <div className="p-4 border-t border-ink-700/50 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-md bg-ink-800 border border-ink-700 text-xs"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!title.trim() || creating}
            className="px-3 py-1.5 rounded-md bg-accent text-ink-950 text-xs font-semibold hover:bg-accent-light disabled:opacity-50"
          >
            {creating ? 'Création…' : 'Créer'}
          </button>
        </div>
      </div>
    </div>
  )
}

function TaskDetailModal({
  task,
  onClose,
  onToggle,
  onDelete,
}: {
  task: TaskItem
  onClose: () => void
  onToggle: () => void
  onDelete: () => void
}) {
  const color = colorFor(task.tasklist_id)
  return (
    <div
      className="fixed inset-0 z-50 bg-ink-950/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="ga-card max-w-md w-full overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="h-1" style={{ background: color }} />
        <div className="p-4">
          <div className="flex items-start justify-between gap-2 mb-3">
            <h2
              className={cn(
                'text-base font-semibold flex-1',
                task.is_completed ? 'line-through text-ink-500' : 'text-ink-100'
              )}
            >
              {task.title || '(sans titre)'}
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
            <div className="flex items-center gap-2">
              <span
                className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-mono"
                style={{ background: color + '20', color }}
              >
                {task.tasklist_title ?? '(sans liste)'}
              </span>
            </div>
            {task.due_at && (
              <div className="flex items-center gap-2 text-ink-300">
                <Calendar size={11} className="text-ink-500" />
                {new Date(task.due_at).toLocaleString('fr-CA')}
              </div>
            )}
            {task.completed_at && (
              <div className="flex items-center gap-2 text-data-positive">
                <CheckSquare size={11} />
                Faite : {new Date(task.completed_at).toLocaleString('fr-CA')}
              </div>
            )}
            {task.notes && (
              <div className="text-ink-300 whitespace-pre-wrap p-2 bg-ink-800/40 rounded">
                {task.notes}
              </div>
            )}
          </div>

          <div className="flex gap-2 mt-4">
            <button
              type="button"
              onClick={onToggle}
              className="flex-1 px-3 py-1.5 rounded-md bg-accent text-ink-950 text-xs font-semibold hover:bg-accent-light"
            >
              {task.is_completed ? 'Réouvrir' : 'Marquer faite'}
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="px-2.5 py-1.5 rounded-md bg-ink-800 border border-data-negative/40 text-data-negative hover:bg-data-negative/10 text-xs"
            >
              <Trash2 size={11} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
