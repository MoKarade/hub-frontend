/**
 * search-history.ts — gestion de l'historique de recherche en localStorage.
 *
 * Stocke jusqu'à 50 conversations. Chaque conversation a un titre (1ère question)
 * et une liste de Q/R. Schéma versionné pour future migration.
 *
 * SÉCURITÉ : on persiste UNIQUEMENT (question, answer, sql, rowCount, settings).
 * Les `rows` (data brutes — transactions, GPS, etc.) ne sont JAMAIS écrites
 * dans localStorage car elles contiennent des montants, lieux, dates sensibles.
 * Si l'user veut revoir le détail brut, il doit re-poser la question.
 * → Cohérent avec règle projet "data ne quittent jamais le PC en clair".
 */

export type SearchScope = 'all' | 'finances' | 'locations' | 'emails' | 'photos' | 'calendar' | 'documents' | 'health'
export type SearchMode = 'data' | 'chat' | 'web' | 'memory'
export type AIModel = 'qwen2.5:14b-instruct' | 'qwen2.5:7b' | 'llama3.3' | 'mistral'

export interface SearchTurn {
  id: string
  question: string
  answer: string | null
  sql: string | null
  /**
   * Volatile : les rows brutes ne sont JAMAIS persistées en localStorage.
   * Elles vivent uniquement le temps de la session (in-memory state React).
   * Après reload, ce champ est null même pour les conversations passées.
   */
  rows: Record<string, unknown>[] | null
  rowCount: number | null
  error: string | null
  timestamp: number
  durationMs: number | null
  // Settings used for this turn
  scope: SearchScope
  mode: SearchMode
  model: AIModel
}

export interface SearchConversation {
  id: string
  title: string
  turns: SearchTurn[]
  createdAt: number
  updatedAt: number
}

const STORAGE_KEY = 'hub-search-history-v1'
const MAX_CONVERSATIONS = 50

interface StoredHistory {
  version: 1
  conversations: SearchConversation[]
}

export function loadHistory(): SearchConversation[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as StoredHistory
    if (parsed.version !== 1) return []
    return parsed.conversations || []
  } catch {
    return []
  }
}

export function saveHistory(conversations: SearchConversation[]): void {
  if (typeof window === 'undefined') return
  try {
    // Strip les rows (data brutes sensibles) avant persistance.
    // Elles restent dans le state React in-memory pour la session courante.
    const sanitized: SearchConversation[] = conversations.slice(0, MAX_CONVERSATIONS).map((conv) => ({
      ...conv,
      turns: conv.turns.map((t) => ({ ...t, rows: null })),
    }))
    const data: StoredHistory = { version: 1, conversations: sanitized }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    // ignore (quota exceeded, etc.)
  }
}

export function newConversationId(): string {
  return `conv-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

export function newTurnId(): string {
  return `turn-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

/** Truncate question to make a conversation title. */
export function makeTitle(question: string, max = 40): string {
  const trimmed = question.trim()
  if (trimmed.length <= max) return trimmed
  return trimmed.slice(0, max - 1) + '…'
}
