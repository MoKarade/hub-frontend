'use client'

import { Sidebar } from '@/components/sidebar'
import { HubStatus } from '@/components/hub-status'
import { Activity, Database, Cpu, Server, Cloud, HardDrive } from 'lucide-react'
import useSWR from 'swr'
import { api } from '@/lib/api'

type ServiceStatus = {
  label: string
  icon: typeof Activity
  status: 'up' | 'down' | 'unknown'
  detail?: string
}

export default function SystemHealthPage() {
  // Try to fetch /v1/ready from hub-core
  const { data, error, isLoading } = useSWR(
    '/v1/ready',
    () => api.ready().catch(() => null),
    { refreshInterval: 5000 }
  )

  const services: ServiceStatus[] = [
    {
      label: 'PostgreSQL',
      icon: Database,
      status: data?.checks?.db?.status === 'ok' ? 'up' : data ? 'down' : 'unknown',
      detail: 'pgvector:pg16',
    },
    {
      label: 'Ollama',
      icon: Cpu,
      status: data?.checks?.ollama?.status === 'ok' ? 'up' : data ? 'down' : 'unknown',
      detail: 'Qwen 2.5 14B',
    },
    {
      label: 'Hub-core',
      icon: Server,
      status: data ? 'up' : error ? 'down' : 'unknown',
      detail: 'FastAPI :8000',
    },
    {
      label: 'Redis',
      icon: HardDrive,
      status: 'unknown',
      detail: 'redis:7-alpine',
    },
    {
      label: 'Cloudflare Tunnel',
      icon: Cloud,
      status: 'unknown',
      detail: 'Phase 0 fin',
    },
  ]

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 px-4 sm:px-6 lg:px-8 pt-16 lg:pt-6 pb-6 max-w-[1400px] flex flex-col">
        <header className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">Santé du hub</h1>
          <p className="text-sm text-ink-400">
            État des services · refresh auto toutes les 5 sec
          </p>
        </header>

        {/* Status grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
          {services.map((s) => (
            <ServiceCard key={s.label} service={s} loading={isLoading} />
          ))}
        </div>

        {/* Endpoints check */}
        <div className="ga-card p-5 mb-6">
          <div className="metric-label mb-3">Endpoints</div>
          <ul className="space-y-2 text-sm font-mono">
            <EndpointRow path="/v1/health" data={data} error={error} />
            <EndpointRow path="/v1/ready" data={data} error={error} />
            <EndpointRow path="/v1/finance/accounts" data={null} error={null} placeholder />
            <EndpointRow path="/v1/locations/points" data={null} error={null} placeholder />
            <EndpointRow path="/v1/ai/ask" data={null} error={null} placeholder />
          </ul>
        </div>

        <div className="mt-auto">
          <HubStatus />
        </div>
      </main>
    </div>
  )
}

function ServiceCard({ service, loading }: { service: ServiceStatus; loading: boolean }) {
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
        <span className={`w-2 h-2 rounded-full ${dot} ${service.status === 'up' ? 'animate-pulse-slow' : ''}`} />
      </div>
      <div className="metric-label mb-0.5">{service.label}</div>
      <div className="text-[11px] text-ink-500 font-mono">{service.detail}</div>
      <div className={`text-xs mt-2 font-mono ${color}`}>
        {loading ? '…' : service.status === 'up' ? 'UP' : service.status === 'down' ? 'DOWN' : 'unknown'}
      </div>
    </div>
  )
}

function EndpointRow({
  path,
  data,
  error,
  placeholder,
}: {
  path: string
  data: unknown
  error: unknown
  placeholder?: boolean
}) {
  const status = placeholder ? '—' : data ? '200' : error ? 'ERR' : '…'
  const color = placeholder
    ? 'text-ink-500'
    : data
    ? 'data-positive'
    : error
    ? 'data-negative'
    : 'text-ink-400'

  return (
    <li className="flex items-center justify-between gap-2 text-[12px]">
      <span className="text-ink-300 truncate">{path}</span>
      <span className={`shrink-0 font-bold ${color}`}>{status}</span>
    </li>
  )
}
