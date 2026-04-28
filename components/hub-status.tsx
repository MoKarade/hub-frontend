'use client'

import useSWR from 'swr'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'

type CheckStatus = 'ok' | 'error' | 'unknown'

const COMPONENTS = [
  { id: 'database', label: 'PostgreSQL' },
  { id: 'ollama', label: 'Ollama' },
  { id: 'hub-core', label: 'Backend' },
  { id: 'tunnel', label: 'Tunnel' },
  { id: 'backup', label: 'Backup' },
] as const

export function HubStatus() {
  const { data, error } = useSWR(
    '/v1/ready',
    () => api.ready().catch(() => null),
    { refreshInterval: 30000 }
  )

  const getStatus = (id: string): CheckStatus => {
    if (error || !data) return 'unknown'
    if (id === 'hub-core') return 'ok' // si on a une réponse, hub-core marche
    const check = data.checks?.[id]
    if (!check) return 'unknown'
    return check.status === 'ok' ? 'ok' : 'error'
  }

  return (
    <div className="panel px-4 py-3 flex items-center gap-5 overflow-x-auto">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-500 shrink-0">
        Santé
      </span>
      {COMPONENTS.map((c) => {
        const status = getStatus(c.id)
        return (
          <div key={c.id} className="flex items-center gap-2 shrink-0">
            <span
              className={cn(
                'w-1.5 h-1.5 rounded-full',
                status === 'ok' && 'bg-accent',
                status === 'error' && 'bg-danger',
                status === 'unknown' && 'bg-ink-500 animate-pulse'
              )}
            />
            <span className="text-xs text-ink-300 font-mono">{c.label}</span>
          </div>
        )
      })}
    </div>
  )
}
