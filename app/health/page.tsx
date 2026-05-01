'use client'

import { Sidebar } from '@/components/sidebar'
import { HubStatus } from '@/components/hub-status'
import {
  Heart,
  Footprints,
  Flame,
  Timer,
  Scale,
  Activity,
  RefreshCw,
  Loader2,
  type LucideIcon,
} from 'lucide-react'
import { useState } from 'react'
import useSWR, { mutate as swrMutate } from 'swr'
import { api, type HealthSummaryResponse } from '@/lib/api'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'

const METRIC_META: Record<string, { label: string; icon: LucideIcon; unit: string; color: string }> = {
  steps: { label: 'Pas/jour', icon: Footprints, unit: '', color: 'text-accent' },
  distance_m: { label: 'Distance', icon: Activity, unit: 'm', color: 'text-info' },
  calories: { label: 'Calories', icon: Flame, unit: 'kcal', color: 'text-warn' },
  active_minutes: { label: 'Minutes actives', icon: Timer, unit: 'min', color: 'text-data-positive' },
  weight_kg: { label: 'Poids', icon: Scale, unit: 'kg', color: 'text-ink-100' },
  heart_rate_avg: { label: 'FC moyenne', icon: Heart, unit: 'bpm', color: 'text-data-negative' },
}

export default function HealthPage() {
  const [syncing, setSyncing] = useState(false)
  const { data: summary } = useSWR<HealthSummaryResponse>(
    'health-summary',
    () => api.healthData.summary()
  )

  async function handleSync() {
    setSyncing(true)
    try {
      const res = await api.healthData.sync({ days_back: 90 })
      toast.success(
        `Sync OK · ${res.metrics_ingested} nouveaux, ${res.metrics_updated} màj, ${res.errors} erreurs`,
        { description: `${res.duration_seconds}s` }
      )
      void swrMutate('health-summary')
    } catch (err) {
      toast.apiError(err, 'Sync Google Fit échoué')
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
            <h1 className="text-2xl font-semibold tracking-tight">Santé</h1>
            <p className="text-sm text-ink-400">
              Google Fit · 90 jours · steps, distance, calories, sommeil, poids, FC
            </p>
          </div>
          <button
            type="button"
            onClick={handleSync}
            disabled={syncing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-accent text-ink-950 text-xs font-semibold hover:bg-accent-light transition-colors disabled:opacity-50"
          >
            {syncing ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
            {syncing ? 'Sync…' : 'Sync Fit'}
          </button>
        </header>

        {summary && summary.total_datapoints === 0 && (
          <div className="ga-card p-6 text-center">
            <Heart size={24} className="text-ink-500 mx-auto mb-2" />
            <div className="text-sm text-ink-300">Aucune donnée santé</div>
            <p className="text-xs text-ink-500 mt-1">
              Click &laquo;&nbsp;Sync Fit&nbsp;&raquo; pour importer tes 90 derniers jours
            </p>
          </div>
        )}

        {summary && summary.by_metric.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {summary.by_metric.map((m) => {
              const meta = METRIC_META[m.metric] ?? {
                label: m.metric,
                icon: Activity,
                unit: '',
                color: 'text-ink-200',
              }
              const Icon = meta.icon
              return (
                <div key={m.metric} className="ga-card p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div
                      className={cn(
                        'w-8 h-8 rounded-lg border flex items-center justify-center bg-ink-800/40',
                        meta.color.replace('text-', 'border-') + '/30'
                      )}
                    >
                      <Icon size={14} className={meta.color} />
                    </div>
                    <div className="text-sm font-semibold text-ink-100">{meta.label}</div>
                  </div>
                  <div className="text-[10px] text-ink-500 mb-1">Moyenne sur 90j</div>
                  <div className={cn('text-2xl font-bold', meta.color)}>
                    {m.avg !== null
                      ? `${m.avg.toLocaleString('fr-CA', { maximumFractionDigits: 1 })} ${meta.unit}`
                      : '—'}
                  </div>
                  <div className="text-[10px] font-mono text-ink-500 mt-1">
                    {m.count} datapoints · dernier : {m.last_date ?? '—'}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <div className="mt-auto pt-4">
          <HubStatus />
        </div>
      </main>
    </div>
  )
}
