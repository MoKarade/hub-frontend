'use client'

import { Sidebar } from '@/components/sidebar'
import { HubStatus } from '@/components/hub-status'
import { Sparkles, ArrowUp, Code2, Database, AlertCircle } from 'lucide-react'
import { useState, useRef, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { api, ApiError, type AskResponse } from '@/lib/api'

const SUGGESTIONS = [
  "Combien j'ai dépensé en restos en mars 2026 ?",
  'Mes plus grosses dépenses du dernier mois',
  'Quel est mon solde courant à fin mars ?',
  "Combien j'ai reçu en paie en février 2026 ?",
  'Valeur de mon portefeuille au 31 mars 2026',
  'Mes positions en USD',
  'Ai-je des doublons de paiements ?',
]

type HistoryEntry = {
  id: string
  question: string
  response: AskResponse | null
  error: string | null
  loading: boolean
  startedAt: number
}

// Next.js 15 exige que useSearchParams soit dans un Suspense boundary.
// On wrappe SearchPageInner pour respecter ça.
export default function SearchPage() {
  return (
    <Suspense fallback={<SearchFallback />}>
      <SearchPageInner />
    </Suspense>
  )
}

function SearchFallback() {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 px-4 sm:px-6 lg:px-8 pt-16 lg:pt-6 pb-6 max-w-[1100px]">
        <div className="text-sm text-ink-400">Chargement…</div>
      </main>
    </div>
  )
}

function SearchPageInner() {
  const searchParams = useSearchParams()
  const initialQuery = searchParams.get('q') ?? ''
  const [question, setQuestion] = useState('')
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [history.length])

  // Auto-submit si la page est ouverte avec ?q=...
  useEffect(() => {
    if (initialQuery && initialQuery.trim().length >= 3 && history.length === 0) {
      ask(initialQuery)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuery])

  async function ask(q: string) {
    const trimmed = q.trim()
    if (!trimmed || trimmed.length < 3) return

    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    const entry: HistoryEntry = {
      id,
      question: trimmed,
      response: null,
      error: null,
      loading: true,
      startedAt: Date.now(),
    }
    setHistory((h) => [...h, entry])
    setQuestion('')

    try {
      const res = await api.ai.ask(trimmed)
      setHistory((h) =>
        h.map((e) => (e.id === id ? { ...e, response: res, loading: false } : e))
      )
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? `${err.status} — ${err.message}`
          : err instanceof Error
            ? err.message
            : String(err)
      setHistory((h) =>
        h.map((e) => (e.id === id ? { ...e, error: msg, loading: false } : e))
      )
    }
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />

      <main className="flex-1 px-4 sm:px-6 lg:px-8 pt-16 lg:pt-6 pb-6 max-w-[1100px]">
        <header className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">Recherche IA</h1>
          <p className="text-sm text-ink-400">
            Pose une question en français · Qwen 2.5 14B local · génère SQL → exécute → reformule
          </p>
        </header>

        {/* Input */}
        <div className="ga-card p-5 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-lg bg-accent/15 flex items-center justify-center">
              <Sparkles size={14} className="text-accent" />
            </div>
            <div>
              <div className="section-title">
                Demande à ton hub
              </div>
              <div className="text-[10px] text-ink-400 font-mono">qwen 2.5 14b · local</div>
            </div>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault()
              ask(question)
            }}
            className="relative"
          >
            <input
              ref={inputRef}
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ex : Combien j'ai dépensé en restos en mars 2026 ?"
              className="w-full bg-ink-800/60 border border-ink-700 rounded-lg px-4 py-3 text-base text-ink-100 placeholder:text-ink-400 focus:outline-none focus:border-accent/60 focus:ring-1 focus:ring-accent/30 transition-colors pr-12"
              minLength={3}
              maxLength={500}
            />
            <button
              type="submit"
              disabled={!question.trim()}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-md bg-accent text-ink-950 flex items-center justify-center hover:bg-accent-light transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              aria-label="Demander"
            >
              <ArrowUp size={16} strokeWidth={2.5} />
            </button>
          </form>

          {history.length === 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => ask(s)}
                  className="text-[11px] px-2.5 py-1 rounded-full bg-ink-800/60 border border-ink-700 text-ink-300 hover:text-ink-100 hover:border-ink-600 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* History */}
        <div className="space-y-4 mb-6">
          {history.map((entry) => (
            <Conversation key={entry.id} entry={entry} />
          ))}
          <div ref={bottomRef} />
        </div>

        <HubStatus />
      </main>
    </div>
  )
}

function Conversation({ entry }: { entry: HistoryEntry }) {
  return (
    <div className="space-y-2 animate-fade-in">
      {/* Question */}
      <div className="flex justify-end">
        <div className="max-w-[80%] panel px-4 py-2 bg-ink-800/60 border-ink-700">
          <div className="text-[10px] uppercase tracking-wider text-ink-400 mb-1">Marc</div>
          <div className="text-sm">{entry.question}</div>
        </div>
      </div>

      {/* Response */}
      <div className="flex">
        <div className="max-w-[85%] space-y-2">
          {entry.loading && (
            <div className="panel px-4 py-3 flex items-center gap-2 text-sm text-ink-400">
              <Sparkles size={14} className="text-accent animate-pulse" />
              Qwen réfléchit · ~5-10 sec…
            </div>
          )}
          {entry.error && (
            <div className="panel px-4 py-3 border-danger/40 bg-danger/5">
              <div className="flex items-center gap-2 text-sm text-danger mb-1">
                <AlertCircle size={14} />
                <span className="font-semibold">Erreur</span>
              </div>
              <div className="text-xs font-mono text-ink-300 break-all">{entry.error}</div>
            </div>
          )}
          {entry.response && (
            <>
              <div className="panel px-4 py-3">
                <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-accent mb-1">
                  <Sparkles size={12} />
                  <span>Réponse · {((Date.now() - entry.startedAt) / 1000).toFixed(1)}s</span>
                </div>
                <div className="text-sm leading-relaxed">{entry.response.answer}</div>
              </div>

              {/* SQL toujours visible par défaut (Sprint C : Marc l'a explicitement demandé). */}
              <div className="ga-card px-4 py-3">
                <div className="flex items-center gap-2 metric-label mb-2">
                  <Code2 size={12} />
                  <span>SQL généré</span>
                </div>
                <pre className="p-2 bg-ink-950 border border-ink-800 rounded text-[11px] font-mono text-ink-200 overflow-x-auto whitespace-pre-wrap">
                  {entry.response.sql}
                </pre>
              </div>

              {/* Résultat brut reste collapsable — verbeux, optionnel. */}
              <details className="ga-card px-4 py-2 group">
                <summary className="flex items-center gap-2 cursor-pointer metric-label hover:text-ink-200 transition-colors">
                  <Database size={12} />
                  <span>Résultat brut · {entry.response.row_count} ligne{entry.response.row_count > 1 ? 's' : ''}</span>
                  <span className="text-ink-500 ml-auto group-open:hidden">→</span>
                </summary>
                <pre className="mt-2 p-2 bg-ink-950 border border-ink-800 rounded text-[11px] font-mono text-ink-200 overflow-x-auto">
                  {JSON.stringify(entry.response.rows, null, 2)}
                </pre>
              </details>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
