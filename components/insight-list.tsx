import { AlertTriangle, TrendingUp, MapPin, Sparkles, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'

type Insight = {
  id: string
  type: 'anomaly' | 'pattern' | 'travel' | 'subscription' | 'opportunity'
  title: string
  meta: string
  importance: 1 | 2 | 3 | 4 | 5
}

const INSIGHTS_DEMO: Insight[] = [
  {
    id: '1',
    type: 'subscription',
    title: 'Abo Netflix prélevé 2× ce mois',
    meta: '17.99 $ × 2 · à investiguer',
    importance: 4,
  },
  {
    id: '2',
    type: 'pattern',
    title: 'Dépenses restos +45 %',
    meta: 'vs ta moyenne 3 mois · 12 transactions',
    importance: 3,
  },
  {
    id: '3',
    type: 'travel',
    title: 'Voyage Seattle ce week-end ?',
    meta: '487 km tracked vers le nord · timeline GPS',
    importance: 2,
  },
  {
    id: '4',
    type: 'anomaly',
    title: 'Achat Amazon hors moyenne',
    meta: '312 $ · 3× ta médiane Amazon',
    importance: 3,
  },
]

const ICONS = {
  anomaly: AlertTriangle,
  pattern: TrendingUp,
  travel: MapPin,
  subscription: Zap,
  opportunity: Sparkles,
}

const COLORS = {
  anomaly: 'text-danger bg-danger/10',
  pattern: 'text-warn bg-warn/10',
  travel: 'text-info bg-info/10',
  subscription: 'text-accent bg-accent/10',
  opportunity: 'text-info bg-info/10',
}

export function InsightList() {
  return (
    <div className="space-y-1">
      {INSIGHTS_DEMO.map((insight) => {
        const Icon = ICONS[insight.type]
        return (
          <button
            key={insight.id}
            className="w-full text-left flex items-start gap-3 px-3 py-2.5 rounded-lg hover:bg-ink-800/60 transition-colors group"
          >
            <div
              className={cn(
                'w-7 h-7 rounded-md flex items-center justify-center shrink-0 mt-0.5',
                COLORS[insight.type]
              )}
            >
              <Icon size={14} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm text-ink-100 group-hover:text-white">{insight.title}</div>
              <div className="text-xs text-ink-400 mt-0.5">{insight.meta}</div>
            </div>
            <ImportanceDots importance={insight.importance} />
          </button>
        )
      })}
    </div>
  )
}

function ImportanceDots({ importance }: { importance: number }) {
  return (
    <div className="flex gap-0.5 mt-1.5 shrink-0" aria-label={`Importance ${importance}/5`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <span
          key={i}
          className={cn(
            'w-1 h-1 rounded-full',
            i < importance ? 'bg-ink-300' : 'bg-ink-700'
          )}
        />
      ))}
    </div>
  )
}
