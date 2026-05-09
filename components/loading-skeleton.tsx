'use client'

/**
 * LoadingSkeleton — placeholders animés (pulse) pour les états de chargement.
 *
 * Variants :
 *  - card      : carte simulée (header + body)
 *  - list-row  : ligne de liste (avatar + 2 lignes texte)
 *  - grid-tile : tuile carrée (photo, app-tile)
 *  - chart     : zone graphique
 *  - text      : ligne de texte simple (lignes multiples avec `lines`)
 *
 * Palette : bg-ink-800 + animate-pulse. Aucun texte.
 */

import { cn } from '@/lib/utils'

export type SkeletonVariant = 'card' | 'list-row' | 'grid-tile' | 'chart' | 'text'

interface LoadingSkeletonProps {
  variant?: SkeletonVariant
  /** Nombre de répétitions (ex: 5 lignes de liste). Défaut 1. */
  count?: number
  /** Pour `text` : nombre de lignes par bloc. Défaut 3. */
  lines?: number
  className?: string
  /** ARIA label pour les screen readers. */
  ariaLabel?: string
}

export function LoadingSkeleton({
  variant = 'card',
  count = 1,
  lines = 3,
  className,
  ariaLabel = 'Chargement',
}: LoadingSkeletonProps) {
  const items = Array.from({ length: Math.max(1, count) })

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={ariaLabel}
      className={cn('animate-pulse', className)}
    >
      {items.map((_, i) => (
        <SkeletonItem key={i} variant={variant} lines={lines} index={i} total={count} />
      ))}
      <span className="sr-only">{ariaLabel}…</span>
    </div>
  )
}

function SkeletonItem({
  variant,
  lines,
  index,
  total,
}: {
  variant: SkeletonVariant
  lines: number
  index: number
  total: number
}) {
  const spacing = total > 1 && index < total - 1 ? 'mb-3' : ''

  if (variant === 'card') {
    return (
      <div className={cn('rounded-lg border border-ink-800 bg-ink-900/40 p-4', spacing)}>
        <div className="h-3 w-1/3 rounded bg-ink-800 mb-3" />
        <div className="h-2 w-full rounded bg-ink-800 mb-2" />
        <div className="h-2 w-5/6 rounded bg-ink-800 mb-2" />
        <div className="h-2 w-2/3 rounded bg-ink-800" />
      </div>
    )
  }

  if (variant === 'list-row') {
    return (
      <div className={cn('flex items-center gap-3 py-2', spacing)}>
        <div className="w-9 h-9 rounded-full bg-ink-800 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="h-2.5 w-2/5 rounded bg-ink-800 mb-1.5" />
          <div className="h-2 w-3/5 rounded bg-ink-800" />
        </div>
      </div>
    )
  }

  if (variant === 'grid-tile') {
    return <div className={cn('aspect-square rounded bg-ink-800', spacing)} />
  }

  if (variant === 'chart') {
    return (
      <div className={cn('rounded-lg border border-ink-800 bg-ink-900/40 p-4', spacing)}>
        <div className="h-3 w-1/4 rounded bg-ink-800 mb-4" />
        <div className="flex items-end gap-1.5 h-28">
          {Array.from({ length: 12 }).map((_, j) => (
            <div
              key={j}
              className="flex-1 bg-ink-800 rounded-t"
              style={{ height: `${30 + ((j * 17) % 60)}%` }}
            />
          ))}
        </div>
      </div>
    )
  }

  // text
  return (
    <div className={spacing}>
      {Array.from({ length: Math.max(1, lines) }).map((_, j) => (
        <div
          key={j}
          className={cn(
            'h-2 rounded bg-ink-800',
            j < lines - 1 ? 'mb-2' : '',
            j === lines - 1 ? 'w-2/3' : 'w-full',
          )}
        />
      ))}
    </div>
  )
}
