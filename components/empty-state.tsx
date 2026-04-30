'use client'

/**
 * EmptyState — composant cohérent pour les états vides.
 * Sprint C compatible : icône hero + titre + description + action optionnelle.
 *
 * Variants visuels :
 *  - default: padding standard, alignement centré
 *  - inline: pour intégrer dans une zone (carte, modal)
 */

import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description?: string
  action?: {
    label: string
    onClick?: () => void
    href?: string
  }
  variant?: 'default' | 'inline'
  className?: string
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  variant = 'default',
  className,
}: EmptyStateProps) {
  const isInline = variant === 'inline'

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center',
        isInline ? 'py-6 px-4' : 'py-12 px-6',
        className
      )}
    >
      {/* Icône hero avec halo subtle */}
      <div
        className={cn(
          'rounded-full flex items-center justify-center mb-3 relative',
          isInline ? 'w-10 h-10' : 'w-14 h-14',
          'bg-ink-800/60 border border-ink-700'
        )}
      >
        <Icon size={isInline ? 18 : 24} className="text-ink-400" />
        {/* Halo pulse subtil pour animer l'attention sans être distrayant */}
        <span
          aria-hidden
          className={cn(
            'absolute inset-0 rounded-full border border-ink-700 animate-pulse-slow opacity-40 pointer-events-none',
            isInline ? '' : 'scale-110'
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
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-ink-800 border border-ink-700 hover:border-accent/40 hover:text-accent text-xs font-mono text-ink-300 transition-colors"
            >
              {action.label}
            </a>
          ) : (
            <button
              type="button"
              onClick={action.onClick}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-ink-800 border border-ink-700 hover:border-accent/40 hover:text-accent text-xs font-mono text-ink-300 transition-colors"
            >
              {action.label}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
