'use client'

/**
 * ErrorState — affiche une erreur API avec bouton "Réessayer".
 *
 * Gère ApiError proprement :
 *  - 401 → "Session expirée" + CTA vers /settings
 *  - 403 → "Accès refusé"
 *  - 429 → "Trop de requêtes — réessaie dans quelques secondes"
 *  - 0   → "Hub injoignable" (timeout / réseau)
 *  - autre → message brut de l'erreur
 *
 * Variants visuels :
 *  - default : padding standard, centré
 *  - inline  : compact, intégrable dans une carte
 */

import { AlertCircle, RefreshCw, LogIn } from 'lucide-react'
import { ApiError } from '@/lib/api'
import { cn } from '@/lib/utils'

interface ErrorStateProps {
  /** Erreur capturée (ApiError, Error, ou unknown). */
  error: unknown
  /** Callback "Réessayer". Si absent → bouton non affiché. */
  onRetry?: () => void
  /** Titre custom. Sinon dérivé du status. */
  title?: string
  variant?: 'default' | 'inline'
  className?: string
}

interface ResolvedError {
  title: string
  description: string
  /** Indique si on doit rediriger vers /settings au lieu de retry. */
  needsAuth: boolean
}

function resolveError(error: unknown, customTitle?: string): ResolvedError {
  if (error instanceof ApiError) {
    if (error.status === 401) {
      return {
        title: customTitle ?? 'Session expirée',
        description: 'Reconnecte-toi pour continuer.',
        needsAuth: true,
      }
    }
    if (error.status === 403) {
      return {
        title: customTitle ?? 'Accès refusé',
        description: error.message,
        needsAuth: false,
      }
    }
    if (error.status === 429) {
      return {
        title: customTitle ?? 'Trop de requêtes',
        description: 'Le hub limite la cadence. Réessaie dans quelques secondes.',
        needsAuth: false,
      }
    }
    if (error.status === 0) {
      return {
        title: customTitle ?? 'Hub injoignable',
        description: 'Vérifie que hub-core est démarré, puis réessaie.',
        needsAuth: false,
      }
    }
    if (error.status >= 500) {
      return {
        title: customTitle ?? 'Erreur serveur',
        description: error.message,
        needsAuth: false,
      }
    }
    return {
      title: customTitle ?? `Erreur ${error.status}`,
      description: error.message,
      needsAuth: false,
    }
  }

  if (error instanceof Error) {
    return {
      title: customTitle ?? 'Une erreur est survenue',
      description: error.message,
      needsAuth: false,
    }
  }

  return {
    title: customTitle ?? 'Une erreur est survenue',
    description: 'Erreur inconnue.',
    needsAuth: false,
  }
}

export function ErrorState({
  error,
  onRetry,
  title,
  variant = 'default',
  className,
}: ErrorStateProps) {
  const isInline = variant === 'inline'
  const resolved = resolveError(error, title)

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={cn(
        'flex flex-col items-center justify-center text-center',
        isInline ? 'py-6 px-4' : 'py-12 px-6',
        className,
      )}
    >
      <div
        className={cn(
          'rounded-full flex items-center justify-center mb-3 bg-danger/10 border border-danger/30',
          isInline ? 'w-10 h-10' : 'w-14 h-14',
        )}
      >
        <AlertCircle size={isInline ? 18 : 24} className="text-danger" />
      </div>

      <h3 className={cn('font-semibold text-ink-100 mb-1', isInline ? 'text-sm' : 'text-base')}>
        {resolved.title}
      </h3>

      <p
        className={cn(
          'text-ink-400 leading-relaxed max-w-md break-words',
          isInline ? 'text-xs' : 'text-sm',
        )}
      >
        {resolved.description}
      </p>

      <div className="mt-4 flex items-center gap-2 flex-wrap justify-center">
        {resolved.needsAuth ? (
          <a
            href="/settings"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-accent/10 border border-accent/40 text-accent text-xs font-semibold hover:bg-accent/20 hover:border-accent/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 transition-colors"
          >
            <LogIn size={12} />
            Reconnecter
          </a>
        ) : null}

        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-ink-800 border border-ink-700 text-ink-200 text-xs font-semibold hover:border-accent/40 hover:text-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 transition-colors"
          >
            <RefreshCw size={12} />
            Réessayer
          </button>
        )}
      </div>
    </div>
  )
}
