'use client'

/**
 * /system/scheduler — admin des jobs auto-sync (APScheduler hub-core).
 *
 * Branche sur :
 *  - GET  /v1/scheduler/status        : liste jobs + next_run
 *  - POST /v1/scheduler/run/{job_id}  : trigger manuel
 */

import { useCallback, useState } from 'react'
import useSWR from 'swr'
import {
  Loader2,
  Play,
  RefreshCw,
  Clock,
  AlertTriangle,
  CheckCircle2,
  ArrowLeft,
} from 'lucide-react'
import Link from 'next/link'
import { Sidebar } from '@/components/sidebar'
import { Widget } from '@/components/widget'
import { HubStatus } from '@/components/hub-status'
import { getBaseUrl } from '@/lib/api'
import { cn } from '@/lib/utils'

interface Job {
  id: string
  name: string
  next_run: string | null
  trigger: string
}

interface SchedulerStatus {
  running: boolean
  jobs: Job[]
}

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export default function SchedulerAdminPage() {
  const base = getBaseUrl()
  const [running, setRunning] = useState<string | null>(null)
  const [results, setResults] = useState<Record<string, { ok: boolean; msg: string; ts: number }>>(
    {},
  )

  const { data, isLoading, mutate } = useSWR<SchedulerStatus>(
    `${base}/v1/scheduler/status`,
    fetcher,
    { refreshInterval: 30_000 },
  )

  const triggerJob = useCallback(
    async (jobId: string) => {
      setRunning(jobId)
      try {
        const r = await fetch(`${base}/v1/scheduler/run/${jobId}`, { method: 'POST' })
        if (!r.ok) {
          const data = await r.json().catch(() => ({}))
          throw new Error(data.detail || `HTTP ${r.status}`)
        }
        const body = await r.json()
        setResults((prev) => ({
          ...prev,
          [jobId]: {
            ok: true,
            msg: `${body.status} @ ${body.started_at?.slice(11, 19) ?? '?'}`,
            ts: Date.now(),
          },
        }))
      } catch (e) {
        setResults((prev) => ({
          ...prev,
          [jobId]: {
            ok: false,
            msg: e instanceof Error ? e.message : String(e),
            ts: Date.now(),
          },
        }))
      } finally {
        setRunning(null)
        // Refresh status apres un trigger (next_run peut changer)
        setTimeout(mutate, 1000)
      }
    },
    [base, mutate],
  )

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 px-4 sm:px-6 lg:px-8 pt-16 lg:pt-6 pb-6 max-w-[1400px] space-y-4">
        <header className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <Link
              href="/system/health"
              className="inline-flex items-center gap-1 text-xs text-ink-400 hover:text-ink-200 mb-1"
            >
              <ArrowLeft size={11} /> Système
            </Link>
            <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
              <Clock size={20} className="text-accent" />
              Scheduler
            </h1>
            <p className="text-xs text-ink-400 mt-0.5">
              Jobs auto-sync APScheduler (hub-core background)
            </p>
          </div>
          <button
            onClick={() => mutate()}
            className="px-3 py-2 rounded-md text-xs font-semibold bg-ink-800 border border-ink-700 hover:border-ink-600 inline-flex items-center gap-1.5"
          >
            <RefreshCw size={11} className={isLoading ? 'animate-spin' : ''} />
            Actualiser
          </button>
        </header>

        {data && !data.running && (
          <div className="panel p-4 border-amber-500/40 flex items-start gap-3">
            <AlertTriangle size={16} className="text-amber-400 shrink-0 mt-0.5" />
            <div className="text-xs">
              <p className="text-ink-200 font-semibold mb-1">Scheduler désactivé</p>
              <p className="text-ink-400">
                Aucun job actif. Vérifie <code className="font-mono bg-ink-800 px-1">SCHEDULER_ENABLED</code>{' '}
                dans hub-core/.env (mettre à <code className="font-mono">true</code>) puis restart uvicorn.
              </p>
            </div>
          </div>
        )}

        {data && data.running && (
          <div className="panel p-3 border-accent/40 flex items-center gap-2 text-xs">
            <CheckCircle2 size={14} className="text-accent" />
            <span className="text-ink-200 font-semibold">Scheduler actif</span>
            <span className="text-ink-500">·</span>
            <span className="text-ink-400 font-mono">{data.jobs.length} jobs</span>
          </div>
        )}

        {/* Jobs list */}
        {isLoading && !data && (
          <div className="panel p-12 text-center text-ink-400">
            <Loader2 size={20} className="inline animate-spin" /> Chargement…
          </div>
        )}

        {data && data.jobs.length > 0 && (
          <Widget id="jobs" title="Jobs configurés" icon={Clock} noPadding>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[520px]">
                <thead className="bg-ink-800/40 text-[11px] uppercase tracking-wider text-ink-400">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium">Job</th>
                    <th className="text-left px-3 py-2 font-medium hidden md:table-cell">Trigger</th>
                    <th className="text-left px-3 py-2 font-medium">Prochain run</th>
                    <th className="text-right px-3 py-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-800/60">
                  {data.jobs.map((job) => {
                    const result = results[job.id]
                    const nextRun = job.next_run ? new Date(job.next_run) : null
                    const minsUntil = nextRun
                      ? Math.round((nextRun.getTime() - Date.now()) / 60000)
                      : null
                    return (
                      <tr key={job.id} className="hover:bg-ink-800/30 transition-colors">
                        <td className="px-3 py-2 font-mono font-semibold text-ink-200">{job.id}</td>
                        <td className="px-3 py-2 text-xs text-ink-400 hidden md:table-cell font-mono truncate max-w-[200px]">
                          {job.trigger}
                        </td>
                        <td className="px-3 py-2 text-xs">
                          {nextRun ? (
                            <>
                              <div className="font-mono text-ink-300">
                                {nextRun.toLocaleString('fr-CA', {
                                  day: '2-digit',
                                  month: 'short',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </div>
                              {minsUntil !== null && (
                                <div className="text-[10px] text-ink-500 font-mono">
                                  {minsUntil > 0
                                    ? `dans ${minsUntil < 60 ? `${minsUntil} min` : `${(minsUntil / 60).toFixed(1)} h`}`
                                    : 'imminent'}
                                </div>
                              )}
                            </>
                          ) : (
                            <span className="text-ink-500">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {result && Date.now() - result.ts < 60_000 && (
                              <span
                                className={cn(
                                  'text-[10px] font-mono',
                                  result.ok ? 'text-data-positive' : 'text-data-negative',
                                )}
                                title={result.msg}
                              >
                                {result.ok ? '✓ ' + result.msg : '✗ ' + result.msg.slice(0, 30)}
                              </span>
                            )}
                            <button
                              onClick={() => triggerJob(job.id)}
                              disabled={running !== null}
                              className="px-2 py-1 rounded text-[10px] font-semibold bg-accent/15 border border-accent/40 text-accent hover:bg-accent/25 disabled:opacity-40 inline-flex items-center gap-1"
                            >
                              {running === job.id ? (
                                <Loader2 size={10} className="animate-spin" />
                              ) : (
                                <Play size={10} />
                              )}
                              Run
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Widget>
        )}

        {data && data.running && data.jobs.length === 0 && (
          <div className="panel p-6 text-center text-xs text-ink-400">
            Aucun job configuré. Vérifie les variables d&apos;env{' '}
            <code className="font-mono">SCHEDULER_*_MINUTES</code> dans hub-core/.env.
          </div>
        )}

        <HubStatus />
      </main>
    </div>
  )
}
