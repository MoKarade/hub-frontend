import type { ComponentType } from 'react'
import { TrendingDown, TrendingUp, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'

type StatCardProps = {
  label: string
  value: string
  delta?: { value: string; direction: 'up' | 'down' | 'flat'; isGood?: boolean }
  icon?: ComponentType<{ size?: number; className?: string }>
  sparkline?: number[]
}

export function StatCard({ label, value, delta, icon: Icon, sparkline }: StatCardProps) {
  const TrendIcon = delta?.direction === 'up' ? TrendingUp : delta?.direction === 'down' ? TrendingDown : Minus
  const trendColor =
    delta?.isGood === undefined
      ? 'text-ink-400'
      : delta.isGood
        ? 'text-accent'
        : 'text-danger'

  return (
    <div className="panel panel-hover p-4 relative overflow-hidden">
      <div className="flex items-start justify-between mb-2">
        <div className="text-xs text-ink-400">{label}</div>
        {Icon && <Icon size={14} className="text-ink-500" />}
      </div>
      <div className="text-2xl font-semibold tabular-nums tracking-tight">{value}</div>
      {delta && (
        <div className={cn('flex items-center gap-1 mt-1.5 text-[11px]', trendColor)}>
          <TrendIcon size={12} strokeWidth={2.5} />
          <span className="font-mono">{delta.value}</span>
        </div>
      )}
      {sparkline && (
        <Sparkline data={sparkline} className="absolute bottom-0 left-0 right-0 opacity-30" />
      )}
    </div>
  )
}

function Sparkline({ data, className }: { data: number[]; className?: string }) {
  const max = Math.max(...data, 1)
  const min = Math.min(...data, 0)
  const range = max - min || 1
  const w = 100
  const h = 30
  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * w
      const y = h - ((v - min) / range) * h
      return `${x},${y}`
    })
    .join(' ')

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      className={cn('w-full h-8', className)}
    >
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )
}
