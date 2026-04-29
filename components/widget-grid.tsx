'use client'

/**
 * WidgetGrid — grille sortable via dnd-kit (Sprint B).
 *
 * Gère :
 *   - Lecture de l'ordre persisté depuis LayoutContext (getSortedIds)
 *   - Drag-and-drop avec PointerSensor (distance 8 px) + KeyboardSensor
 *   - Mise à jour du layout après chaque drop (reorder)
 *   - Application des col-span CSS selon la taille de chaque widget
 *   - Injection de dragListeners + dragAttributes dans chaque Widget via cloneElement
 *
 * Usage :
 *   <WidgetGrid ids={['ai-search', 'finances', 'insights', ...]}>
 *     <Widget id="ai-search" ...>...</Widget>
 *     <Widget id="finances" ...>...</Widget>
 *     ...
 *   </WidgetGrid>
 *
 * Les enfants doivent être dans le même ordre que `ids`.
 * WidgetGrid les réordonnance en fonction du layout persisté.
 */

import React, { type ReactNode } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  rectSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useLayout, type WidgetSize } from '@/lib/layout-context'

// ── Column spans ──────────────────────────────────────────────────────────────

/** Mappe une WidgetSize sur un col-span Tailwind (grille à 3 colonnes). */
const SIZE_COL: Record<WidgetSize, string> = {
  sm: 'col-span-1',
  md: 'col-span-1',
  lg: 'col-span-2',
  xl: 'col-span-3',
  full: 'col-span-3',
}

// ── SortableItem ──────────────────────────────────────────────────────────────

interface SortableItemProps {
  id: string
  children: React.ReactElement<any>
}

function SortableItem({ id, children }: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id })

  const { getWidget } = useLayout()
  const config = getWidget(id)

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition: transition ?? undefined,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={[
        SIZE_COL[config.size],
        isDragging ? 'opacity-40 z-50 relative' : '',
      ].join(' ').trim()}
    >
      {React.cloneElement(children, {
        dragListeners: listeners,
        dragAttributes: attributes,
      })}
    </div>
  )
}

// ── WidgetGrid ────────────────────────────────────────────────────────────────

export interface WidgetGridProps {
  /**
   * IDs de tous les widgets, dans leur ordre "source" (ordre déclaratif).
   * WidgetGrid les retrie selon l'ordre persisté dans LayoutContext.
   */
  ids: string[]
  /**
   * Éléments Widget, dans le même ordre que `ids`.
   * WidgetGrid réordonnance, applique les col-spans, et injecte les dragListeners.
   */
  children: ReactNode
}

export function WidgetGrid({ ids, children }: WidgetGridProps) {
  const { getSortedIds, reorder } = useLayout()
  const sortedIds = getSortedIds(ids)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      // Exige 8 px de déplacement pour activer le drag (évite les faux déclenchements)
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIdx = sortedIds.indexOf(active.id as string)
    const newIdx = sortedIds.indexOf(over.id as string)
    if (oldIdx === -1 || newIdx === -1) return
    const next = [...sortedIds]
    next.splice(oldIdx, 1)
    next.splice(newIdx, 0, active.id as string)
    reorder(next)
  }

  // Convertit les children JSX en tableau indexé, puis mappe id → ReactElement
  const childArray = React.Children.toArray(children) as React.ReactElement<any>[]
  const widgetMap = new Map(ids.map((id, i) => [id, childArray[i]]))

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={sortedIds} strategy={rectSortingStrategy}>
        <div className="grid grid-cols-3 gap-4">
          {sortedIds.map((id) => {
            const child = widgetMap.get(id)
            if (!child) return null
            return (
              <SortableItem key={id} id={id}>
                {child}
              </SortableItem>
            )
          })}
        </div>
      </SortableContext>
    </DndContext>
  )
}
