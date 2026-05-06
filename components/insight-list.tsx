'use client'

/**
 * Insights pro-actifs (anomalies, doublons, patterns).
 *
 * Branche en live sur GET /v1/insights (top 4 par severite croissante :
 * critical -> warning -> info -> positive). Click un insight -> /insights ou
 * vers le action_url si fourni.
 */

import useSWR from 'swr'
import Link from 'next/link'
import {
  Sparkles,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Bell,
  TrendingDown,
  TrendingUp,
  Zap,
  Calendar,
  Home,
  MapPin,
  Wallet,
  Mail,
  Heart,
  CheckSquare,
  Activity,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { getBaseUrl } from '@/lib/api'

interface InsightApi {
  severity: 'critical' | 'warning' | 'info' | 'positive'
  icon: string
  title: string
  description: string
  delta?: string | null
  action?: string | null
  action_url?: string | null
  source: string
}

interface InsightsResponse {
  insights: InsightApi[]
}

const ICON_MAP: Record<string, LucideIcon> = {
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Bell,
  TrendingDown,
  TrendingUp,
  Zap,
  Calendar,
  Home,
  MapPin,
  Wallet,
  Mail,
  Heart,
  CheckSquare,
  Activity,
}

const SEV_COLOR: Record<string, string> = {
  critical: 'text-data-negative',
  warning: 'text-warn',
  info: 'text-info',
  positive: 'text-data-positive',
}

const SEV_DOT: Record<string, string> = {
  critical: 'bg-data-negative',
  warning: 'bg-warn',
  info: 'bg-info',
  positive: 'bg-data-positive',
}

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export function InsightList() {
  const { data, isLoading, error } = useSWR<InsightsResponse>(
    `${getBaseUrl()}/v1/insights`,
    fetcher,
    { refreshInterval: 5 * 60_000 },
  )

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
        <Loader2 size={16} className="animate-spin text-ink-500" />
        <p className="text-xs text-ink-500">Chargement…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
        <AlertTriangle size={20} className="text-warn" />
        <p className="text-xs text-ink-400">Erreur de chargement</p>
      </div>
    )
  }

  const insights = data?.insights ?? []
  if (insights.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
        <CheckCircle2 size={20} className="text-data-positive" />
        <p className="text-sm text-ink-300">Tout est sous contrôle</p>
        <p className="text-xs text-ink-500">Aucune anomalie détectée.</p>
      </div>
    )
  }

  const top4 = insights.slice(0, 4)

  return (
    <div className="space-y-2">
      {top4.map((ins, i) => {
        const Icon = ICON_MAP[ins.icon] ?? Sparkles
        const row = (
          <div className="flex items-start gap-2 px-2 py-1.5 rounded hover:bg-ink-800/40 transition-colors">
            <span
              className={cn(
                'w-1.5 h-1.5 rounded-full shrink-0 mt-2',
                SEV_DOT[ins.severity],
              )}
            />
            <Icon size={13} className={cn('shrink-0 mt-0.5', SEV_COLOR[ins.severity])} />
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2">
                <span className="text-xs font-semibold text-ink-200 truncate">
                  {ins.title}
                </span>
                {ins.delta && (
                  <span
                    className={cn(
                      'text-[10px] font-mono ml-auto shrink-0',
                      SEV_COLOR[ins.severity],
                    )}
                  >
                    {ins.delta}
                  </span>
                )}
              </div>
              <p className="text-[10px] text-ink-500 truncate">{ins.description}</p>
            </div>
          </div>
        )
        if (ins.action_url) {
          return (
            <Link key={i} href={ins.action_url} className="block">
              {row}
            </Link>
          )
        }
        return <div key={i}>{row}</div>
      })}
      <Link
        href="/insights"
        className="block text-[10px] text-ink-500 hover:text-accent text-center pt-2 font-mono"
      >
        Voir tous les insights →
      </Link>
    </div>
  )
}
