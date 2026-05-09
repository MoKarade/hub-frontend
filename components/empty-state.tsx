'use client'

/**
 * EmptyState — composant cohérent pour les états vides.
 *
 * Variants sémantiques :
 *  - default        : pas de données du tout (fallback générique)
 *  - not-connected  : OAuth/source pas configurée → CTA vers /settings
 *  - no-data        : connecté mais aucune donnée (vide légitime)
 *  - filtered-empty : filtres trop restrictifs → CTA "Reset filtres"
 *  - inline         : variant visuel compact (carte, modal, panel étroit)
 *
 * Palette : ink-700 borders, ink-300 texte, accent pour CTA.
 * Aucune logique métier ici — purement présentationnel.
 */

import type { LucideIcon } from 'lucide-react'
import { Inbox, Plug, FilterX } from 'lucide-react'
import { cn } from '@/lib/utils'

export type EmptyStateVariant =
  | 'default'
  | 'not-connected'
  | 'no-data'
  | 'filtered-empty'
  | 'inline'

interface EmptyStateAction {
  label: string
  onClick?: () => void
  href?: string
}

interface EmptyStateProps {
  /** Icône Lucide. Optionnelle si un variant fournit son icône par défaut. */
  icon?: LucideIcon
  title: string
  description?: string
  action?: EmptyStateAction
  variant?: EmptyStateVariant
  className?: string
}

const VARIANT_DEFAULTS: Record<
  Exclude<EmptyStateVariant, 'default' | 'inline'>,
  { icon: LucideIcon; tone: 'neutral' | 'info' | 'warn' }
> = {
  'not-connected':  { icon: Plug,    tone: 'info'    },
  'no-data':        { icon: Inbox,   tone: 'neutral' },
  'filtered-empty': { icon: FilterX, tone: 'warn'    },
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  variant = 'default',
  className,
}: EmptyStateProps) {
  const isInline = variant === 'inline'
  const variantDefault =
    variant === 'not-connected' || variant === 'no-data' || variant === 'filtered-empty'
      ? VARIANT_DEFAULTS[variant]
      : null

  const Icon = icon ?? variantDefault?.icon ?? Inbox
  const tone = variantDefault?.tone ?? 'neutral'

  const iconColor =
    tone === 'info' ? 'text-info'
    : tone === 'warn' ? 'text-warn'
    : 'text-ink-400'

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'flex flex-col items-center justify-center text-center',
        isInline ? 'py-6 px-4' : 'py-12 px-6',
        className,
      )}
    >
      <div
        className={cn(
          'rounded-full flex items-center justify-center mb-3 relative bg-ink-800/60 border border-ink-700',
          isInline ? 'w-10 h-10' : 'w-14 h-14',
        )}
      >
        <Icon size={isInline ? 18 : 24} className={iconColor} />
        <span
          aria-hidden
          className={cn(
            'absolute inset-0 rounded-full border border-ink-700 animate-pulse-slow opacity-40 pointer-events-none',
            isInline ? '' : 'scale-110',
          )}
        />
      </div>

      <h3 className={cn('font-semibold text-ink-200 mb-1', isInline ? 'text-sm' : 'text-base')}>
        {title}
      </h3>

      {description && (
        <p className={cn('text-ink-400 leading-relaxed max-w-sm', isInline ? 'text-xs' : 'text-sm')}>
          {description}
        </p>
      )}

      {action && (
        <div className="mt-4">
          {action.href ? (
            <a
              href={action.href}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-accent/10 border border-accent/40 text-accent text-xs font-semibold hover:bg-accent/20 hover:border-accent/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 transition-colors"
            >
              {action.label}
            </a>
          ) : (
            <button
              type="button"
              onClick={action.onClick}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-accent/10 border border-accent/40 text-accent text-xs font-semibold hover:bg-accent/20 hover:border-accent/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 transition-colors"
            >
              {action.label}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
