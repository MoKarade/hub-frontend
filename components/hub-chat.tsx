'use client'

/**
 * HubChat — Home conversationnel (vision Marc 2026-05-05).
 *
 * Remplace le dashboard widgets par un chat central :
 *   - Saisie principale focus auto
 *   - Suggestions contextuelles selon heure/jour
 *   - Historique conversation persistante (localStorage)
 *   - Streaming via /api/v1/ai/ask/stream (SSE)
 *   - Affichage progressif : stage -> sql -> rows -> tokens
 *   - Cards de resultats riches (table inline pour rows, sql collapsible)
 *
 * Backup : `Cmd+K` ouvre l'overlay UniversalSearch pour deep-dive.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import {
  Send,
  Mic,
  Sparkles,
  Loader2,
  Database,
  Search,
  FileCode,
  Trash2,
  Brain,
  ChevronDown,
  ChevronUp,
  Command,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Types ───────────────────────────────────────────────────────────────────

type StreamStage =
  | 'idle'
  | 'sql_generation'
  | 'sql_validation'
  | 'sql_execution'
  | 'answer_generation'
  | 'done'
  | 'error'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  sql?: string
  rows?: Array<Record<string, unknown>>
  row_count?: number
  error?: string
  ts: number
}

// ─── Suggestions contextuelles ──────────────────────────────────────────────

function getContextualSuggestions(): string[] {
  const now = new Date()
  const hour = now.getHours()
  const day = now.getDay() // 0=dim, 6=sam

  const all: string[] = [
    "Combien j'ai dépensé ce mois-ci ?",
    "Mes événements aujourd'hui ?",
    "Où étais-je le 15 mars 2026 ?",
    "Mes 5 dernières transactions ?",
    "Combien d'emails non-lus ?",
    "Mes tâches en retard ?",
    "Combien j'ai dépensé en restos en mars ?",
    "Quel est mon top 5 lieux visités ?",
    "Quels sont mes abonnements récurrents ?",
    "Valeur de mon portefeuille au 31 mars ?",
    "Combien de pas hier ?",
    "Combien j'ai gagné en paie ce mois ?",
  ]

  // Filtre par moment de la journée
  let prio: string[] = []
  if (hour < 11) {
    prio = [
      "Mes événements aujourd'hui ?",
      "Mes tâches en retard ?",
      "Combien j'ai dépensé hier ?",
    ]
  } else if (hour < 17) {
    prio = [
      "Combien d'emails non-lus ?",
      "Combien j'ai dépensé ce mois-ci ?",
      "Mes 5 dernières transactions ?",
    ]
  } else {
    prio = [
      "Où étais-je aujourd'hui ?",
      "Combien j'ai dépensé en restos cette semaine ?",
      "Mes événements demain ?",
    ]
  }

  if (day === 0 || day === 6) {
    prio.unshift("Mes voyages cette année ?")
  }

  // Mélange : prio + 2-3 random du reste
  const seen = new Set(prio)
  const others = all.filter((q) => !seen.has(q)).sort(() => Math.random() - 0.5)
  return [...prio, ...others].slice(0, 5)
}

// ─── Persistance ─────────────────────────────────────────────────────────────

const STORAGE_KEY = 'hubchat_history_v1'
const MAX_HISTORY = 50

function loadHistory(): ChatMessage[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function saveHistory(msgs: ChatMessage[]) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(msgs.slice(-MAX_HISTORY)))
  } catch {
    /* quota / privacy mode */
  }
}

// ─── Composant principal ─────────────────────────────────────────────────────

export function HubChat({ onOpenCommandK }: { onOpenCommandK?: () => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [stage, setStage] = useState<StreamStage>('idle')
  const [stageLabel, setStageLabel] = useState<string>('')
  const [streamingSql, setStreamingSql] = useState<string>('')
  const [streamingRows, setStreamingRows] = useState<{
    rows: Array<Record<string, unknown>>
    count: number
  } | null>(null)
  const [streamingAnswer, setStreamingAnswer] = useState<string>('')
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  // Charge l'historique au mount
  useEffect(() => {
    setMessages(loadHistory())
  }, [])

  // Persiste à chaque changement
  useEffect(() => {
    if (messages.length > 0) saveHistory(messages)
  }, [messages])

  // Focus auto sur l'input + scroll bottom
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, streamingAnswer, streamingRows, stage])

  // Suggestions calculées une fois (par mount)
  const suggestions = useMemo(() => getContextualSuggestions(), [])

  const isStreaming = stage !== 'idle' && stage !== 'done' && stage !== 'error'

  // ─── Send message via SSE ────────────────────────────────────────────────

  const sendMessage = useCallback(
    async (questionText: string) => {
      const text = questionText.trim()
      if (!text || isStreaming) return

      const userMsg: ChatMessage = {
        id: `u_${Date.now()}`,
        role: 'user',
        content: text,
        ts: Date.now(),
      }
      setMessages((m) => [...m, userMsg])
      setInput('')
      setStreamingSql('')
      setStreamingRows(null)
      setStreamingAnswer('')
      setStage('sql_generation')
      setStageLabel('Génération SQL…')

      // Build history pour AI ask
      const history = messages.slice(-6).map((m) => ({
        role: m.role,
        content: m.content,
      }))

      // AbortController pour annuler si user navigue ailleurs
      const ctrl = new AbortController()
      abortRef.current = ctrl

      try {
        const res = await fetch('/api/v1/ai/ask/stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question: text, history }),
          signal: ctrl.signal,
        })
        if (!res.ok || !res.body) {
          throw new Error(`HTTP ${res.status}`)
        }
        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        let finalAnswer = ''
        let finalSql = ''
        let finalRows: Array<Record<string, unknown>> = []
        let finalRowCount = 0
        let finalError: string | undefined

        while (true) {
          const { value, done } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })

          // Parse SSE : delim = double newline
          const events = buffer.split('\n\n')
          buffer = events.pop() ?? ''
          for (const block of events) {
            const lines = block.split('\n')
            let ev = 'message'
            let data = ''
            for (const ln of lines) {
              if (ln.startsWith('event:')) ev = ln.slice(6).trim()
              else if (ln.startsWith('data:')) data = ln.slice(5).trim()
            }
            if (!data) continue
            let parsed: Record<string, unknown> = {}
            try {
              parsed = JSON.parse(data)
            } catch {
              continue
            }
            switch (ev) {
              case 'stage':
                setStage(parsed.stage as StreamStage)
                setStageLabel((parsed.label as string) || '')
                break
              case 'sql':
                finalSql = (parsed.sql as string) || ''
                setStreamingSql(finalSql)
                break
              case 'rows':
                finalRows = (parsed.rows as Array<Record<string, unknown>>) || []
                finalRowCount = (parsed.row_count as number) ?? finalRows.length
                setStreamingRows({ rows: finalRows, count: finalRowCount })
                break
              case 'token':
                finalAnswer += (parsed.token as string) || ''
                setStreamingAnswer(finalAnswer)
                break
              case 'error':
                finalError = (parsed.error as string) || 'erreur inconnue'
                setStage('error')
                break
              case 'done':
                finalAnswer = (parsed.answer as string) || finalAnswer
                finalSql = (parsed.sql as string) || finalSql
                finalRows =
                  (parsed.rows as Array<Record<string, unknown>>) || finalRows
                finalRowCount = (parsed.row_count as number) ?? finalRowCount
                setStage('done')
                break
            }
          }
        }

        const assistantMsg: ChatMessage = {
          id: `a_${Date.now()}`,
          role: 'assistant',
          content: finalAnswer || '(pas de réponse)',
          sql: finalSql || undefined,
          rows: finalRows,
          row_count: finalRowCount,
          error: finalError,
          ts: Date.now(),
        }
        setMessages((m) => [...m, assistantMsg])
      } catch (err) {
        if ((err as Error).name === 'AbortError') return
        setMessages((m) => [
          ...m,
          {
            id: `a_${Date.now()}`,
            role: 'assistant',
            content: `Erreur : ${(err as Error).message}`,
            error: (err as Error).message,
            ts: Date.now(),
          },
        ])
      } finally {
        setStreamingSql('')
        setStreamingRows(null)
        setStreamingAnswer('')
        setStage('idle')
        setStageLabel('')
        abortRef.current = null
        inputRef.current?.focus()
      }
    },
    [isStreaming, messages],
  )

  // Cleanup abort si unmount
  useEffect(() => {
    return () => abortRef.current?.abort()
  }, [])

  // Cmd+K shortcut + Enter to send
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        onOpenCommandK?.()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onOpenCommandK])

  const onTextareaKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  const clearHistory = () => {
    if (confirm('Effacer toute la conversation ?')) {
      setMessages([])
      try {
        localStorage.removeItem(STORAGE_KEY)
      } catch {
        /* ignore */
      }
    }
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full max-h-[calc(100vh-2rem)]">
      {/* Header */}
      <header className="flex items-center justify-between mb-3 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Brain size={16} className="text-accent" />
          <h2 className="text-sm font-semibold text-ink-100">Assistant</h2>
          <span className="text-[10px] font-mono text-ink-500">qwen 2.5 14b · local</span>
        </div>
        <div className="flex items-center gap-2">
          {onOpenCommandK && (
            <button
              type="button"
              onClick={onOpenCommandK}
              className="text-[10px] font-mono uppercase tracking-wider text-ink-400 hover:text-accent transition-colors px-2 py-1 rounded border border-ink-700 hover:border-accent flex items-center gap-1.5"
              title="Recherche universelle (Cmd+K)"
            >
              <Command size={10} />
              <Search size={10} />
              <span>K</span>
            </button>
          )}
          {messages.length > 0 && (
            <button
              type="button"
              onClick={clearHistory}
              className="text-[10px] font-mono uppercase tracking-wider text-ink-500 hover:text-data-negative transition-colors px-2 py-1 rounded border border-ink-700 hover:border-data-negative/50 flex items-center gap-1.5"
              title="Effacer la conversation"
            >
              <Trash2 size={10} />
              clear
            </button>
          )}
        </div>
      </header>

      {/* Conversation scroll */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto pr-2 mb-3 min-h-0">
        {messages.length === 0 && !isStreaming && (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <Sparkles size={28} className="text-accent/60 mb-3" />
            <h3 className="text-base font-semibold text-ink-100 mb-1">
              Que veux-tu savoir ?
            </h3>
            <p className="text-xs text-ink-400 mb-5">
              Pose une question en français — toutes tes données sont à portée de prompt.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-2xl">
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => sendMessage(s)}
                  className="ga-card ga-card-hover text-left px-3 py-2.5 text-xs text-ink-300 hover:text-ink-100 hover:border-accent/40 transition-colors flex items-center gap-2"
                >
                  <Search size={11} className="text-ink-500 shrink-0" />
                  <span>{s}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m) => (
          <MessageView key={m.id} message={m} />
        ))}

        {/* Streaming message */}
        {isStreaming && (
          <div className="ga-card border-accent/30 bg-accent/5 p-3 mb-3">
            <div className="flex items-center gap-2 mb-2">
              <Loader2 size={12} className="text-accent animate-spin" />
              <span className="text-[11px] font-mono text-accent">{stageLabel}</span>
            </div>
            {streamingSql && (
              <details className="mb-2">
                <summary className="cursor-pointer text-[10px] font-mono text-ink-500 hover:text-ink-300 flex items-center gap-1">
                  <FileCode size={10} />
                  SQL généré
                </summary>
                <pre className="mt-1 text-[10px] text-ink-300 bg-ink-950 p-2 rounded overflow-x-auto">
                  {streamingSql}
                </pre>
              </details>
            )}
            {streamingRows && (
              <div className="flex items-center gap-2 text-[10px] font-mono text-ink-400 mb-2">
                <Database size={10} />
                <span>{streamingRows.count} ligne(s)</span>
              </div>
            )}
            {streamingAnswer && (
              <p className="text-sm text-ink-100 leading-relaxed whitespace-pre-wrap">
                {streamingAnswer}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Input bar */}
      <div className="flex-shrink-0">
        <div className="ga-card focus-within:border-accent/50 transition-colors">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onTextareaKey}
            placeholder={
              isStreaming
                ? 'Génération en cours…'
                : 'Pose une question, Entrée pour envoyer…'
            }
            disabled={isStreaming}
            rows={2}
            className="w-full bg-transparent border-0 outline-none px-3 py-2 text-sm text-ink-100 placeholder:text-ink-500 resize-none disabled:opacity-50"
          />
          <div className="flex items-center justify-between px-3 py-1.5 border-t border-ink-800/50">
            <div className="flex items-center gap-3 text-[10px] text-ink-500">
              <span className="font-mono">Entrée envoyer · Shift+Entrée nouvelle ligne</span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled
                className="text-ink-600 px-2 py-1 rounded hover:text-ink-400 transition-colors flex items-center gap-1 text-[10px] font-mono opacity-50"
                title="Voix (à venir)"
              >
                <Mic size={11} />
              </button>
              <button
                type="button"
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || isStreaming}
                className="bg-accent/20 text-accent border border-accent/40 hover:bg-accent/30 disabled:opacity-30 disabled:cursor-not-allowed px-3 py-1 rounded text-[11px] font-mono uppercase flex items-center gap-1.5 transition-colors"
              >
                {isStreaming ? <Loader2 size={11} className="animate-spin" /> : <Send size={11} />}
                envoyer
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Message bubble ───────────────────────────────────────────────────────────

function MessageView({ message }: { message: ChatMessage }) {
  const [showSql, setShowSql] = useState(false)
  const [showRows, setShowRows] = useState(false)

  const isUser = message.role === 'user'

  return (
    <div className={cn('mb-3', isUser ? 'flex justify-end' : '')}>
      <div
        className={cn(
          'rounded-lg px-3 py-2 max-w-[90%]',
          isUser
            ? 'bg-accent/15 border border-accent/30 text-ink-100'
            : 'ga-card border-ink-700/50',
          message.error && 'border-data-negative/40 bg-data-negative/5',
        )}
      >
        <p className={cn('text-sm leading-relaxed whitespace-pre-wrap', isUser && 'font-medium')}>
          {message.content}
        </p>
        {!isUser && (message.sql || (message.rows && message.rows.length > 0)) && (
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] font-mono text-ink-500">
            {message.sql && (
              <button
                type="button"
                onClick={() => setShowSql((v) => !v)}
                className="hover:text-ink-300 transition-colors flex items-center gap-1"
              >
                <FileCode size={10} />
                SQL {showSql ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
              </button>
            )}
            {typeof message.row_count === 'number' && (
              <button
                type="button"
                onClick={() => setShowRows((v) => !v)}
                className="hover:text-ink-300 transition-colors flex items-center gap-1"
              >
                <Database size={10} />
                {message.row_count} ligne(s) {showRows ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
              </button>
            )}
          </div>
        )}
        {showSql && message.sql && (
          <pre className="mt-2 text-[10px] text-ink-300 bg-ink-950 p-2 rounded overflow-x-auto">
            {message.sql}
          </pre>
        )}
        {showRows && message.rows && message.rows.length > 0 && (
          <div className="mt-2 max-h-64 overflow-auto">
            <table className="w-full text-[10px] font-mono">
              <thead className="bg-ink-950 sticky top-0">
                <tr>
                  {Object.keys(message.rows[0]).map((k) => (
                    <th key={k} className="text-left px-2 py-1 text-ink-500 border-b border-ink-800">
                      {k}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {message.rows.slice(0, 50).map((row, i) => (
                  <tr key={i} className="border-b border-ink-900/50">
                    {Object.values(row).map((v, j) => (
                      <td key={j} className="px-2 py-1 text-ink-300">
                        {String(v ?? '')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {message.rows.length > 50 && (
              <div className="text-[10px] text-ink-500 italic px-2 py-1">
                {message.rows.length - 50} autres lignes…
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
