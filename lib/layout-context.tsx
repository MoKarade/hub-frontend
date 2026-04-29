'use client'

/**
 * LayoutProvider + useLayout hook.
 * Gère la configuration de chaque widget (taille, épingle, visibilité, ordre).
 * Persiste en localStorage sous la clé hub-layout-v1.
 *
 * Sprint A : taille, épingleur, visibilité, reset.
 * Sprint B : ajout de la fonction reorder() couplée à dnd-kit.
 */

import {
  createContext,
  useContext,
  useEffect,
  useReducer,
  type ReactNode,
} from 'react'

// ── Types ────────────────────────────────────────────────────────────────────

export type WidgetSize = 'sm' | 'md' | 'lg' | 'xl' | 'full'

export interface WidgetConfig {
  id: string
  size: WidgetSize
  pinned: boolean
  visible: boolean
  order: number
}

type WidgetMap = Record<string, WidgetConfig>

interface LayoutContextValue {
  /**
   * Retourne la config d'un widget.
   * Si le widget n'existe pas encore (localStorage vide), retourne les defaults fournis.
   */
  getWidget(id: string, defaults?: Partial<Omit<WidgetConfig, 'id'>>): WidgetConfig
  setSize(id: string, size: WidgetSize): void
  togglePin(id: string): void
  toggleVisible(id: string): void
  /** Remet tous les widgets à leur configuration par défaut. */
  reset(): void
}

// ── Context ───────────────────────────────────────────────────────────────────

const LayoutContext = createContext<LayoutContextValue | null>(null)

// ── Reducer ───────────────────────────────────────────────────────────────────

type Action =
  | { type: 'HYDRATE'; payload: WidgetMap }
  | { type: 'SET_SIZE'; id: string; size: WidgetSize }
  | { type: 'TOGGLE_PIN'; id: string }
  | { type: 'TOGGLE_VISIBLE'; id: string }
  | { type: 'RESET' }

function makeDefault(id: string, defaults?: Partial<Omit<WidgetConfig, 'id'>>): WidgetConfig {
  return {
    id,
    size: defaults?.size ?? 'md',
    pinned: defaults?.pinned ?? false,
    visible: defaults?.visible ?? true,
    order: defaults?.order ?? 999,
  }
}

function reducer(state: WidgetMap, action: Action): WidgetMap {
  switch (action.type) {
    case 'HYDRATE':
      return action.payload
    case 'SET_SIZE': {
      const existing = state[action.id] ?? makeDefault(action.id)
      return { ...state, [action.id]: { ...existing, size: action.size } }
    }
    case 'TOGGLE_PIN': {
      const existing = state[action.id] ?? makeDefault(action.id)
      return { ...state, [action.id]: { ...existing, pinned: !existing.pinned } }
    }
    case 'TOGGLE_VISIBLE': {
      const existing = state[action.id] ?? makeDefault(action.id)
      return { ...state, [action.id]: { ...existing, visible: !existing.visible } }
    }
    case 'RESET':
      return {}
    default:
      return state
  }
}

// ── Storage ───────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'hub-layout-v1'

function loadFromStorage(): WidgetMap {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as WidgetMap) : {}
  } catch {
    return {}
  }
}

function saveToStorage(map: WidgetMap): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
  } catch {
    // quota exceeded — ignore
  }
}

// ── Provider ──────────────────────────────────────────────────────────────────

export function LayoutProvider({ children }: { children: ReactNode }) {
  const [widgets, dispatch] = useReducer(reducer, {})

  // Hydration depuis localStorage (après mount, évite mismatch SSR)
  useEffect(() => {
    dispatch({ type: 'HYDRATE', payload: loadFromStorage() })
  }, [])

  // Persiste à chaque changement
  useEffect(() => {
    saveToStorage(widgets)
  }, [widgets])

  function getWidget(id: string, defaults?: Partial<Omit<WidgetConfig, 'id'>>): WidgetConfig {
    return widgets[id] ?? makeDefault(id, defaults)
  }

  function setSize(id: string, size: WidgetSize) {
    dispatch({ type: 'SET_SIZE', id, size })
  }

  function togglePin(id: string) {
    dispatch({ type: 'TOGGLE_PIN', id })
  }

  function toggleVisible(id: string) {
    dispatch({ type: 'TOGGLE_VISIBLE', id })
  }

  function reset() {
    dispatch({ type: 'RESET' })
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY)
    }
  }

  return (
    <LayoutContext.Provider value={{ getWidget, setSize, togglePin, toggleVisible, reset }}>
      {children}
    </LayoutContext.Provider>
  )
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useLayout(): LayoutContextValue {
  const ctx = useContext(LayoutContext)
  if (!ctx) {
    throw new Error('useLayout() must be used inside <LayoutProvider>.')
  }
  return ctx
}
