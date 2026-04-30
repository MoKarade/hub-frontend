/**
 * search-history.ts — gestion de l'historique de recherche en localStorage.
 *
 * Stocke jusqu'à 50 conversations. Chaque conversation a un titre (1ère question)
 * et une liste de Q/R. Schéma versionné pour future migration.
 */

export type SearchScope = 'all' | 'finances' | 'locations' | 'emails' | 'photos' | 'calendar' | 'documents' | 'health'
export type SearchMode = 'data' | 'web' | 'memory'
export type AIModel = 'qwen2.5:14b-instruct' | 'qwen2.5:7b' | 'llama3.3' | 'mistral'

export interface SearchTurn {
  id: string
  question: string
  answer: string | null
  sql: string | null
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
    const trimmed = conversations.slice(0, MAX_CONVERSATIONS)
    const data: StoredHistory = { version: 1, conversations: trimmed }
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
