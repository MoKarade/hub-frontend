'use client'

/**
 * Widget — conteneur universel pour le dashboard.
 *
 * Fonctionnalités Sprint A :
 *   - Header avec titre, icône, badge, actions custom
 *   - Drag handle visuel (fonctionnel en Sprint B avec dnd-kit)
 *   - Bouton épingle (pin/unpin) → persisté dans LayoutProvider
 *   - Bouton taille (S/M/L/XL/↔) → persisté dans LayoutProvider
 *   - Bouton mode focus → ouvre FocusModal plein écran
 *   - Hover effect : légère élévation + ring vert
 *   - fadeIn animation au montage
 *   - ring-pulse quand la prop `pulse` est true (Sprint B : SSE events)
 *
 * Fonctionnalités Sprint B :
 *   - Drag-and-drop via dnd-kit (le drag handle sera câblé)
 *   - Resize (les spans de colonne seront appliqués par le parent grid)
 */

import { useState, type ReactNode } from 'react'
import { motion } from 'framer-motion'
import { Maximize2, GripVertical } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { fadeIn } from '@/lib/motion'
import { FocusModal } from '@/components/focus-modal'

// ── Props ─────────────────────────────────────────────────────────────────────

export interface WidgetProps {
  /** Identifiant unique (utilisé pour aria-labels). */
  id: string
  title: string
  subtitle?: string
  icon?: LucideIcon
  /** Badge affiché dans le header (ex: "Phase 4+", "live", "Garmin"). */
  badge?: string
  /** Contenu principal du widget. */
  children: ReactNode
  /**
   * Contenu affiché dans le mode focus (FocusModal).
   * Si absent, le mode focus affiche `children`.
   */
  focusContent?: ReactNode
  /** Boutons/actions supplémentaires dans le header (ex: liens, selects). */
  headerActions?: ReactNode
  /** Si true, retire le padding interne du body — pour les tables, cartes, etc. */
  noPadding?: boolean
  /** Classes CSS additionnelles sur le conteneur. */
  className?: string
  /**
   * Si true, déclenche l'animation ring-pulse (réception d'un événement SSE).
   */
  pulse?: boolean
  /** Listeners dnd-kit (cas legacy WidgetGrid). Si absent, pas de drag handle. */
  dragListeners?: Record<string, unknown>
  /** Attributs ARIA dnd-kit (cas legacy). */
  dragAttributes?: Record<string, unknown>
}

// ── Component ─────────────────────────────────────────────────────────────────

export function Widget({
  title,
  subtitle,
  icon: Icon,
  badge,
  children,
  focusContent,
  headerActions,
  noPadding = false,
  className,
  pulse = false,
  dragListeners,
  dragAttributes,
}: WidgetProps) {
  const [focusOpen, setFocusOpen] = useState(false)

  return (
    <>
      <motion.div
        variants={fadeIn}
        initial="initial"
        animate="animate"
        whileHover={{
          boxShadow: '0 0 0 1px rgba(92,219,149,0.12), 0 8px 32px rgba(0,0,0,0.35)',
          y: -1,
          transition: { duration: 0.15, ease: 'easeOut' },
        }}
        className={cn(
          'panel flex flex-col group relative',
          // Animation SSE (pulse ring sur new event)
          pulse && 'animate-ring-pulse',
          className
        )}
      >
        {/* ── Header ── */}
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-ink-800/70 shrink-0">

          {/* Drag handle — affiche uniquement si dragListeners (mode sortable) */}
          {dragListeners && (
            <span
              {...dragListeners}
              {...(dragAttributes ?? {})}
              className="inline-flex cursor-grab active:cursor-grabbing touch-none shrink-0"
            >
              <GripVertical
                size={13}
                className="text-ink-700 group-hover:text-ink-500 transition-colors select-none"
                aria-hidden="true"
              />
            </span>
          )}

          {Icon && (
            <Icon size={13} className="text-accent/60 shrink-0" aria-hidden="true" />
          )}

          {/* Titre + sous-titre */}
          <div className="flex-1 min-w-0 flex items-baseline gap-2">
            <span className="text-xs font-semibold text-ink-200 leading-none truncate">
              {title}
            </span>
            {subtitle && (
              <span className="text-[10px] text-ink-500 font-mono hidden sm:inline truncate">
                {subtitle}
              </span>
            )}
          </div>

          {/* Badge phase/statut */}
          {badge && (
            <span className="text-[9px] font-mono text-ink-500 bg-ink-800 border border-ink-700 px-1.5 py-0.5 rounded shrink-0 select-none">
              {badge}
            </span>
          )}

          {/* Slot pour actions custom */}
          {headerActions}

          {/* ── Contrôles widget — visibles au hover ── */}
          {/* Mode focus uniquement (size/pin retirés avec le drag-drop) */}
          <div
            className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150 shrink-0"
            role="toolbar"
            aria-label={`Contrôles du widget ${title}`}
          >
            <button
              onClick={() => setFocusOpen(true)}
              title="Mode focus — plein écran"
              className="p-1 text-ink-400 hover:text-ink-100 hover:bg-ink-700 rounded transition-colors"
            >
              <Maximize2 size={11} aria-label="Plein écran" />
            </button>
          </div>
        </div>

        {/* ── Body ── */}
        <div className={cn('flex-1 min-h-0', !noPadding && 'p-4')}>
          {children}
        </div>
      </motion.div>

      {/* Focus modal */}
      <FocusModal
        isOpen={focusOpen}
        onClose={() => setFocusOpen(false)}
        title={title}
        subtitle={subtitle}
      >
        {focusContent ?? children}
      </FocusModal>
    </>
  )
}
