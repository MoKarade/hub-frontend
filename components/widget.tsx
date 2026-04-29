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
import { Pin, PinOff, Maximize2, GripVertical } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { fadeIn } from '@/lib/motion'
import { FocusModal } from '@/components/focus-modal'
import { useLayout, type WidgetSize } from '@/lib/layout-context'

// ── Sizing ────────────────────────────────────────────────────────────────────

const SIZE_LABELS: Record<WidgetSize, string> = {
  sm: 'S',
  md: 'M',
  lg: 'L',
  xl: 'XL',
  full: '↔',
}

const SIZE_CYCLE: WidgetSize[] = ['sm', 'md', 'lg', 'xl', 'full']

/** Retourne la prochaine taille dans le cycle. */
function nextSize(current: WidgetSize): WidgetSize {
  const idx = SIZE_CYCLE.indexOf(current)
  return SIZE_CYCLE[(idx + 1) % SIZE_CYCLE.length]
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface WidgetProps {
  /** Identifiant unique — clé dans LayoutProvider. */
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
  /** Taille par défaut si absente du localStorage. */
  defaultSize?: WidgetSize
  defaultPinned?: boolean
  /** Boutons/actions supplémentaires dans le header (ex: liens, selects). */
  headerActions?: ReactNode
  /** Si true, retire le padding interne du body — pour les tables, cartes, etc. */
  noPadding?: boolean
  /** Classes CSS additionnelles sur le conteneur. */
  className?: string
  /**
   * Si true, déclenche l'animation ring-pulse (réception d'un événement SSE).
   * Sprint B : passé depuis le hook useEventSource.
   */
  pulse?: boolean
}

// ── Component ─────────────────────────────────────────────────────────────────

export function Widget({
  id,
  title,
  subtitle,
  icon: Icon,
  badge,
  children,
  focusContent,
  defaultSize = 'md',
  defaultPinned = false,
  headerActions,
  noPadding = false,
  className,
  pulse = false,
}: WidgetProps) {
  const { getWidget, setSize, togglePin } = useLayout()
  const config = getWidget(id, { size: defaultSize, pinned: defaultPinned })
  const [focusOpen, setFocusOpen] = useState(false)

  function handleCycleSize() {
    setSize(id, nextSize(config.size))
  }

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
          // Anneau vert discret si épinglé
          config.pinned && 'ring-1 ring-accent/25',
          // Animation SSE (Sprint B)
          pulse && 'animate-ring-pulse',
          className
        )}
      >
        {/* ── Header ── */}
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-ink-800/70 shrink-0">

          {/* Drag handle — visuel Sprint A, câblé Sprint B */}
          <GripVertical
            size={13}
            className="text-ink-700 group-hover:text-ink-500 cursor-grab active:cursor-grabbing transition-colors shrink-0 select-none"
            aria-hidden="true"
          />

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
          <div
            className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150 shrink-0"
            role="toolbar"
            aria-label={`Contrôles du widget ${title}`}
          >
            {/* Cycle de taille */}
            <button
              onClick={handleCycleSize}
              title={`Taille : ${SIZE_LABELS[config.size]} → ${SIZE_LABELS[nextSize(config.size)]}`}
              className="w-5 h-5 flex items-center justify-center text-[9px] font-mono font-bold text-ink-400 hover:text-ink-100 hover:bg-ink-700 rounded transition-colors"
            >
              {SIZE_LABELS[config.size]}
            </button>

            {/* Épingle */}
            <button
              onClick={() => togglePin(id)}
              title={config.pinned ? 'Désépingler' : 'Épingler en haut'}
              className="p-1 text-ink-400 hover:text-accent hover:bg-ink-700 rounded transition-colors"
            >
              {config.pinned
                ? <PinOff size={11} aria-label="Désépingler" />
                : <Pin size={11} aria-label="Épingler" />
              }
            </button>

            {/* Mode focus */}
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
