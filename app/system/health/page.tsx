'use client'

import { Sidebar } from '@/components/sidebar'
import { HubStatus } from '@/components/hub-status'
import { Activity, Database, Cpu, Server, Cloud, RefreshCw, Loader2 } from 'lucide-react'
import useSWR from 'swr'
import { useCallback, useState } from 'react'
import { api, getBaseUrl } from '@/lib/api'

type CheckStatus = 'up' | 'down' | 'unknown'

type ServiceCheck = {
  label: string
  icon: typeof Activity
  status: CheckStatus
  detail: string
  latencyMs?: number
}

type EndpointProbe = {
  ok: boolean
  status: number
  latencyMs: number
}

async function probeEndpoint(path: string): Promise<EndpointProbe> {
  const t0 = performance.now()
  const url = getBaseUrl() + path
  const res = await fetch(url, { method: 'GET', cache: 'no-store' })
  const latencyMs = Math.round(performance.now() - t0)
  return { ok: res.ok, status: res.status, latencyMs }
}

const ENDPOINTS = [
  '/v1/health',
  '/v1/ready',
  '/v1/finance/accounts?limit=1',
  '/v1/locations/points?limit=1',
  '/v1/contacts/stats',
] as const

function useProbe(path: string) {
  return useSWR(['probe', path], () => probeEndpoint(path), {
    refreshInterval: 30000,
    shouldRetryOnError: false,
  })
}

export default function SystemHealthPage() {
  const [refreshing, setRefreshing] = useState(false)
  const {
    data,
    error,
    isLoading,
    mutate: mutateReady,
  } = useSWR('/v1/ready', () => api.ready(), {
    refreshInterval: 5000,
    shouldRetryOnError: false,
  })

  const p1 = useProbe(ENDPOINTS[0])
  const p2 = useProbe(ENDPOINTS[1])
  const p3 = useProbe(ENDPOINTS[2])
  const p4 = useProbe(ENDPOINTS[3])
  const p5 = useProbe(ENDPOINTS[4])
  const probes = [p1, p2, p3, p4, p5]

  const handleRecheck = useCallback(async () => {
    setRefreshing(true)
    try {
      await Promise.all([
        mutateReady(),
        p1.mutate(),
        p2.mutate(),
        p3.mutate(),
        p4.mutate(),
        p5.mutate(),
      ])
    } finally {
      setRefreshing(false)
    }
  }, [mutateReady, p1, p2, p3, p4, p5])

  const dbCheck = data?.checks?.database
  const ollamaCheck = data?.checks?.ollama
  const cfCheck = data?.checks?.cloudflare

  const services: ServiceCheck[] = [
    {
      label: 'PostgreSQL',
      icon: Database,
      status: !data
        ? 'unknown'
        : dbCheck?.status === 'ok'
        ? 'up'
        : 'down',
      detail: 'pgvector:pg16',
      latencyMs:
        typeof dbCheck?.latency_ms === 'number' ? dbCheck.latency_ms : undefined,
    },
    {
      label: 'Ollama',
      icon: Cpu,
      status: !data
        ? 'unknown'
        : ollamaCheck?.status === 'ok'
        ? 'up'
        : 'down',
      detail:
        typeof ollamaCheck?.configured_model === 'string'
          ? ollamaCheck.configured_model
          : 'LLM local',
      latencyMs:
        typeof ollamaCheck?.latency_ms === 'number'
          ? ollamaCheck.latency_ms
          : undefined,
    },
    {
      label: 'Hub-core',
      icon: Server,
      status: data ? 'up' : error ? 'down' : 'unknown',
      detail: 'FastAPI :8000',
    },
    {
      label: 'Cloudflare',
      icon: Cloud,
      status: !data
        ? 'unknown'
        : cfCheck?.status === 'ok'
        ? 'up'
        : cfCheck?.status === 'error'
        ? 'down'
        : 'unknown',
      detail:
        typeof cfCheck?.detail === 'string'
          ? cfCheck.detail
          : cfCheck?.via_tunnel
          ? 'via tunnel'
          : 'Access',
    },
  ]

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 px-4 sm:px-6 lg:px-8 pt-16 lg:pt-6 pb-6 max-w-[1400px] flex flex-col">
        <header className="mb-4 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Santé du hub</h1>
            <p className="text-sm text-ink-400">
              État des services · refresh auto toutes les 5s
            </p>
            {data?.checked_at && (
              <p className="text-[11px] text-ink-500 font-mono mt-1">
                Dernière vérif : {new Date(data.checked_at).toLocaleString('fr-CA')}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={handleRecheck}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-accent text-ink-950 text-xs font-semibold hover:bg-accent-light transition-colors disabled:opacity-50"
          >
            {refreshing ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <RefreshCw size={12} />
            )}
            Re-check tout
          </button>
        </header>

        {/* Status grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          {services.map((s) => (
            <ServiceCard key={s.label} service={s} loading={isLoading && !data} />
          ))}
        </div>

        {/* Endpoints check */}
        <div className="ga-card p-5 mb-6">
          <div className="metric-label mb-3">Endpoints (sondes réelles)</div>
          <ul className="space-y-2 text-sm font-mono">
            {ENDPOINTS.map((path, i) => (
              <EndpointRow
                key={path}
                path={path}
                probe={probes[i].data}
                error={probes[i].error}
                loading={probes[i].isLoading}
              />
            ))}
          </ul>
        </div>

        <div className="mt-auto">
          <HubStatus />
        </div>
      </main>
    </div>
  )
}

function ServiceCard({
  service,
  loading,
}: {
  service: ServiceCheck
  loading: boolean
}) {
  const Icon = service.icon
  const color = {
    up: 'data-positive',
    down: 'data-negative',
    unknown: 'text-ink-500',
  }[service.status]

  const dot = {
    up: 'bg-data-positive',
    down: 'bg-data-negative',
    unknown: 'bg-ink-600',
  }[service.status]

  return (
    <div className="ga-card ga-card-hover p-4">
      <div className="flex items-start justify-between mb-2">
        <Icon size={16} className={color} />
        <span
          className={`w-2 h-2 rounded-full ${dot} ${
            service.status === 'up' ? 'animate-pulse-slow' : ''
          }`}
        />
      </div>
      <div className="metric-label mb-0.5">{service.label}</div>
      <div className="text-[11px] text-ink-500 font-mono truncate">{service.detail}</div>
      <div className={`text-xs mt-2 font-mono ${color}`}>
        {loading ? (
          <Loader2 size={12} className="inline animate-spin" />
        ) : (
          <>
            {service.status === 'up' ? 'UP' : service.status === 'down' ? 'DOWN' : '—'}
            {service.latencyMs !== undefined && (
              <span className="text-ink-500 ml-1.5">· {service.latencyMs}ms</span>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function EndpointRow({
  path,
  probe,
  error,
  loading,
}: {
  path: string
  probe: EndpointProbe | undefined
  error: unknown
  loading: boolean
}) {
  let status: string
  let color: string

  if (loading && !probe) {
    status = '…'
    color = 'text-ink-500'
  } else if (error) {
    status = 'ERR'
    color = 'data-negative'
  } else if (probe) {
    status = String(probe.status)
    color = probe.ok ? 'data-positive' : 'data-negative'
  } else {
    status = '—'
    color = 'text-ink-500'
  }

  return (
    <li className="flex items-center justify-between gap-2 text-[12px]">
      <span className="text-ink-300 truncate">{path}</span>
      <span className="shrink-0 flex items-center gap-2">
        {probe && (
          <span className="text-ink-500 text-[11px]">{probe.latencyMs}ms</span>
        )}
        <span className={`font-bold ${color}`}>{status}</span>
      </span>
    </li>
  )
}
