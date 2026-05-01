'use client'

/**
 * Page Recherche — style Claude :
 *  - Sidebar gauche : historique conversations (localStorage) + bouton "Nouvelle"
 *  - Zone centrale : conversation Q/R avec SQL visible
 *  - Footer : barre de recherche + dropdowns (mode, scope, modèle)
 *
 * URL state : ?conv=xxx pour ouvrir une conversation spécifique (bookmark-able).
 */

import { Sidebar } from '@/components/sidebar'
import {
  Sparkles,
  ArrowUp,
  Code2,
  Database,
  AlertCircle,
  Plus,
  Trash2,
  MessageSquare,
  Globe,
  HardDrive,
  Brain,
  ChevronDown,
  MessagesSquare,
} from 'lucide-react'
import { useState, useRef, useEffect, Suspense, useMemo } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { api, ApiError } from '@/lib/api'
import { toast } from '@/lib/toast'
import {
  loadHistory,
  saveHistory,
  newConversationId,
  newTurnId,
  makeTitle,
  type SearchConversation,
  type SearchTurn,
  type SearchScope,
  type SearchMode,
  type AIModel,
} from '@/lib/search-history'
import { cn } from '@/lib/utils'

const SCOPES: { id: SearchScope; label: string }[] = [
  { id: 'all', label: 'Tout' },
  { id: 'finances', label: 'Finances' },
  { id: 'locations', label: 'Localisation' },
  { id: 'emails', label: 'Emails' },
  { id: 'photos', label: 'Photos' },
  { id: 'calendar', label: 'Calendrier' },
  { id: 'documents', label: 'Documents' },
  { id: 'health', label: 'Santé' },
]

const MODES: { id: SearchMode; label: string; icon: typeof Globe; description: string }[] = [
  { id: 'data', label: 'Mes data', icon: HardDrive, description: 'Cherche dans Postgres local (génère SQL)' },
  { id: 'chat', label: 'Discussion', icon: MessagesSquare, description: 'Discussion libre avec l\'IA, sans toucher la DB' },
  { id: 'web', label: 'Web', icon: Globe, description: 'Recherche internet (Phase 4+)' },
  { id: 'memory', label: 'Mémoire IA', icon: Brain, description: 'Conversations passées (Phase 4+)' },
]

const MODELS: { id: AIModel; label: string; description: string }[] = [
  { id: 'qwen2.5:14b-instruct', label: 'Qwen 2.5 14B', description: 'Défaut, équilibré (~5-10s)' },
  { id: 'qwen2.5:7b', label: 'Qwen 2.5 7B', description: 'Plus rapide, moins précis' },
  { id: 'llama3.3', label: 'Llama 3.3', description: 'Alternative Meta' },
  { id: 'mistral', label: 'Mistral 7B', description: 'Léger, francophone' },
]

const SUGGESTIONS = [
  "Combien j'ai dépensé en restos en mars ?",
  "Mes plus grosses dépenses",
  "Solde courant fin mars",
  "Valeur du portefeuille",
  "Où étais-je le 12 mars ?",
]

export default function SearchPage() {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <Suspense fallback={<div className="flex-1 flex items-center justify-center text-ink-400">Chargement…</div>}>
        <SearchInner />
      </Suspense>
    </div>
  )
}

function SearchInner() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const initialConvId = searchParams.get('conv')
  const initialQuery = searchParams.get('q')

  const [conversations, setConversations] = useState<SearchConversation[]>([])
  const [activeConvId, setActiveConvId] = useState<string | null>(initialConvId)
  const [question, setQuestion] = useState('')
  const [hydrated, setHydrated] = useState(false)
  const [showSettings, setShowSettings] = useState(false)

  // Settings (sticky via localStorage)
  const [scope, setScope] = useState<SearchScope>('all')
  const [mode, setMode] = useState<SearchMode>('data')
  const [model, setModel] = useState<AIModel>('qwen2.5:14b-instruct')

  const inputRef = useRef<HTMLTextAreaElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  // Hydrate history + settings from localStorage
  useEffect(() => {
    const loaded = loadHistory()
    setConversations(loaded)
    try {
      const savedScope = localStorage.getItem('hub-search-scope') as SearchScope
      const savedMode = localStorage.getItem('hub-search-mode') as SearchMode
      const savedModel = localStorage.getItem('hub-search-model') as AIModel
      if (savedScope && SCOPES.some((s) => s.id === savedScope)) setScope(savedScope)
      if (savedMode && MODES.some((m) => m.id === savedMode)) setMode(savedMode)
      if (savedModel && MODELS.some((m) => m.id === savedModel)) setModel(savedModel)
    } catch {
      // ignore
    }
    setHydrated(true)
  }, [])

  // Persist settings on change
  useEffect(() => {
    if (!hydrated) return
    try {
      localStorage.setItem('hub-search-scope', scope)
      localStorage.setItem('hub-search-mode', mode)
      localStorage.setItem('hub-search-model', model)
    } catch {
      // ignore
    }
  }, [scope, mode, model, hydrated])

  // Auto-submit ?q= once on first load
  useEffect(() => {
    if (!hydrated) return
    if (initialQuery && initialQuery.trim().length >= 3 && !activeConvId) {
      void ask(initialQuery)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, initialQuery])

  // Auto-scroll to bottom on new turn
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [activeConvId, conversations])

  const activeConv = useMemo(
    () => conversations.find((c) => c.id === activeConvId) ?? null,
    [conversations, activeConvId]
  )

  function persistAndSet(next: SearchConversation[]) {
    setConversations(next)
    saveHistory(next)
  }

  function startNewConversation() {
    setActiveConvId(null)
    setQuestion('')
    inputRef.current?.focus()
    router.push(pathname, { scroll: false })
  }

  function selectConversation(id: string) {
    setActiveConvId(id)
    const params = new URLSearchParams()
    params.set('conv', id)
    router.push(`${pathname}?${params.toString()}`, { scroll: false })
  }

  function deleteConversation(id: string, e?: React.MouseEvent) {
    e?.stopPropagation()
    const conv = conversations.find((c) => c.id === id)
    const next = conversations.filter((c) => c.id !== id)
    persistAndSet(next)
    if (activeConvId === id) {
      setActiveConvId(null)
      router.push(pathname, { scroll: false })
    }
    toast.success('Conversation supprimée', {
      description: conv?.title ? `« ${conv.title} »` : undefined,
    })
  }

  async function ask(q: string) {
    const trimmed = q.trim()
    if (!trimmed || trimmed.length < 3) return

    let convId = activeConvId
    let convs = conversations

    if (!convId) {
      convId = newConversationId()
      const newConv: SearchConversation = {
        id: convId,
        title: makeTitle(trimmed),
        turns: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      convs = [newConv, ...convs]
      setActiveConvId(convId)
      const params = new URLSearchParams()
      params.set('conv', convId)
      router.push(`${pathname}?${params.toString()}`, { scroll: false })
    }

    const turnId = newTurnId()
    const startedAt = Date.now()
    const pendingTurn: SearchTurn = {
      id: turnId,
      question: trimmed,
      answer: null,
      sql: null,
      rows: null,
      rowCount: null,
      error: null,
      timestamp: startedAt,
      durationMs: null,
      scope,
      mode,
      model,
    }

    convs = convs.map((c) =>
      c.id === convId ? { ...c, turns: [...c.turns, pendingTurn], updatedAt: Date.now() } : c
    )
    persistAndSet(convs)
    setQuestion('')

    try {
      let answer: string
      let sql: string | null = null
      let rows: Record<string, unknown>[] | null = null
      let rowCount: number | null = null

      if (mode === 'chat') {
        // Mode discussion libre : pas de SQL/DB, juste LLM. Reconstruit l'historique
        // depuis les turns precedents de la conversation active (10 dernier max).
        const history = (activeConv?.turns ?? [])
          .filter((t) => t.answer && !t.error)
          .flatMap((t) => [
            { role: 'user' as const, content: t.question },
            { role: 'assistant' as const, content: t.answer ?? '' },
          ])
          .slice(-20)
        const res = await api.ai.chat(trimmed, history)
        answer = res.answer
      } else {
        // Mode data (defaut) : LLM -> SQL -> exec -> LLM -> reponse
        const res = await api.ai.ask(trimmed)
        answer = res.answer
        sql = res.sql
        rows = res.rows
        rowCount = res.row_count
      }

      const durationMs = Date.now() - startedAt
      convs = convs.map((c) =>
        c.id === convId
          ? {
              ...c,
              turns: c.turns.map((t) =>
                t.id === turnId
                  ? {
                      ...t,
                      answer,
                      sql,
                      rows,
                      rowCount,
                      durationMs,
                    }
                  : t
              ),
              updatedAt: Date.now(),
            }
          : c
      )
      persistAndSet(convs)
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? `${err.status} — ${err.message}`
          : err instanceof Error
            ? err.message
            : String(err)
      const durationMs = Date.now() - startedAt
      convs = convs.map((c) =>
        c.id === convId
          ? {
              ...c,
              turns: c.turns.map((t) =>
                t.id === turnId ? { ...t, error: msg, durationMs } : t
              ),
              updatedAt: Date.now(),
            }
          : c
      )
      persistAndSet(convs)
      toast.apiError(err, 'Recherche IA en échec')
    }
  }

  function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault()
    if (question.trim().length >= 3) {
      void ask(question)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div className="flex-1 flex flex-col lg:flex-row min-h-0">
      <HistoryPanel
        conversations={conversations}
        activeConvId={activeConvId}
        onSelect={selectConversation}
        onNew={startNewConversation}
        onDelete={deleteConversation}
      />

      <main className="flex-1 flex flex-col min-h-0 px-4 sm:px-6 lg:px-8 pt-16 lg:pt-6 pb-4 max-w-[1100px] mx-auto w-full">
        <header className="mb-4 shrink-0">
          <h1 className="text-xl font-semibold tracking-tight">
            {activeConv?.title ?? 'Recherche IA'}
          </h1>
          <p className="text-xs text-ink-500 font-mono">
            Qwen 2.5 14B local · génère SQL → exécute → reformule
          </p>
        </header>

        <div className="flex-1 overflow-y-auto min-h-0 space-y-4 mb-4">
          {!activeConv && (
            <EmptyState onSuggestionClick={(s) => { setQuestion(s); inputRef.current?.focus() }} />
          )}

          {activeConv?.turns.map((turn) => (
            <TurnView key={turn.id} turn={turn} />
          ))}
          <div ref={bottomRef} />
        </div>

        <div className="shrink-0 space-y-2">
          {showSettings && (
            <SettingsPanel
              scope={scope}
              mode={mode}
              model={model}
              onScopeChange={setScope}
              onModeChange={setMode}
              onModelChange={setModel}
            />
          )}

          <form onSubmit={handleSubmit} className="ga-card p-3">
            <textarea
              ref={inputRef}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Pose ta question en français…"
              rows={2}
              className="w-full bg-transparent text-sm text-ink-100 placeholder:text-ink-500 focus:outline-none resize-none"
              minLength={3}
              maxLength={500}
            />
            <div className="flex items-center justify-between gap-2 mt-1 pt-2 border-t border-ink-800">
              <SettingsBar
                scope={scope}
                mode={mode}
                model={model}
                showSettings={showSettings}
                onToggleSettings={() => setShowSettings((s) => !s)}
              />
              <button
                type="submit"
                disabled={question.trim().length < 3}
                className="w-8 h-8 shrink-0 rounded-md bg-accent text-ink-950 flex items-center justify-center hover:bg-accent-light transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                aria-label="Envoyer"
              >
                <ArrowUp size={14} strokeWidth={2.5} />
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  )
}

function HistoryPanel({
  conversations,
  activeConvId,
  onSelect,
  onNew,
  onDelete,
}: {
  conversations: SearchConversation[]
  activeConvId: string | null
  onSelect: (id: string) => void
  onNew: () => void
  onDelete: (id: string, e?: React.MouseEvent) => void
}) {
  return (
    <aside className="lg:w-64 shrink-0 lg:border-r lg:border-ink-800 lg:bg-ink-900/30 flex flex-col lg:h-screen lg:sticky lg:top-0 px-2 pt-16 lg:pt-3 pb-3 max-h-64 lg:max-h-none overflow-hidden border-b lg:border-b-0 border-ink-800">
      <button
        onClick={onNew}
        className="flex items-center justify-center gap-2 w-full px-3 py-2 mb-2 rounded-md bg-ink-800 border border-ink-700 hover:border-accent/40 hover:bg-ink-800/60 text-sm transition-colors shrink-0"
      >
        <Plus size={14} />
        Nouvelle conversation
      </button>

      <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-ink-500 shrink-0">
        Historique ({conversations.length})
      </div>

      <div className="flex-1 overflow-y-auto space-y-0.5 min-h-0">
        {conversations.length === 0 && (
          <div className="text-xs text-ink-500 italic px-2 py-4 text-center">
            Aucune conversation pour l&apos;instant.
          </div>
        )}
        {conversations.map((c) => (
          <button
            key={c.id}
            onClick={() => onSelect(c.id)}
            className={cn(
              'group w-full flex items-center gap-2 px-2 py-2 rounded-md text-left text-sm transition-colors',
              c.id === activeConvId
                ? 'bg-ink-800 text-ink-100'
                : 'text-ink-300 hover:bg-ink-800/50 hover:text-ink-100'
            )}
          >
            <MessageSquare size={13} className="shrink-0 text-ink-500" />
            <span className="flex-1 truncate text-[13px]">{c.title}</span>
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => onDelete(c.id, e)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onDelete(c.id)
                }
              }}
              aria-label="Supprimer"
              className="opacity-0 group-hover:opacity-100 p-1 -mr-1 text-ink-500 hover:text-danger transition-all"
            >
              <Trash2 size={11} />
            </span>
          </button>
        ))}
      </div>
    </aside>
  )
}

function TurnView({ turn }: { turn: SearchTurn }) {
  const isPending = turn.answer === null && turn.error === null

  return (
    <div className="space-y-2 animate-fade-in">
      <div className="flex justify-end">
        <div className="max-w-[85%] panel px-4 py-2 bg-ink-800/60 border-ink-700">
          <div className="text-[10px] uppercase tracking-wider text-ink-400 mb-1 flex items-center gap-2">
            <span>Toi</span>
            <span className="text-ink-600">·</span>
            <span className="font-mono text-ink-500">{turn.scope} · {turn.mode}</span>
          </div>
          <div className="text-sm whitespace-pre-wrap">{turn.question}</div>
        </div>
      </div>

      <div className="flex">
        <div className="max-w-[90%] space-y-2 w-full">
          {isPending && (
            <div className="panel px-4 py-3 flex items-center gap-2 text-sm text-ink-400">
              <Sparkles size={14} className="text-accent animate-pulse" />
              {turn.model.replace(':', ' ')} réfléchit…
            </div>
          )}
          {turn.error && (
            <div className="panel px-4 py-3 border-danger/40 bg-danger/5">
              <div className="flex items-center gap-2 text-sm text-danger mb-1">
                <AlertCircle size={14} />
                <span className="font-semibold">Erreur</span>
              </div>
              <div className="text-xs font-mono text-ink-300 break-all">{turn.error}</div>
            </div>
          )}
          {turn.answer && (
            <>
              <div className="panel px-4 py-3">
                <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-accent mb-1">
                  <Sparkles size={12} />
                  <span>
                    Réponse
                    {turn.durationMs !== null && ` · ${(turn.durationMs / 1000).toFixed(1)}s`}
                  </span>
                </div>
                <div className="text-sm leading-relaxed whitespace-pre-wrap">{turn.answer}</div>
              </div>

              {turn.sql && (
                <div className="ga-card px-4 py-3">
                  <div className="flex items-center gap-2 metric-label mb-2">
                    <Code2 size={12} />
                    <span>SQL généré</span>
                  </div>
                  <pre className="p-2 bg-ink-950 border border-ink-800 rounded text-[11px] font-mono text-ink-200 overflow-x-auto whitespace-pre-wrap">
                    {turn.sql}
                  </pre>
                </div>
              )}

              {turn.rows && turn.rowCount !== null && (
                <details className="ga-card px-4 py-2 group">
                  <summary className="flex items-center gap-2 cursor-pointer metric-label hover:text-ink-200 transition-colors">
                    <Database size={12} />
                    <span>
                      Résultat brut · {turn.rowCount} ligne{turn.rowCount > 1 ? 's' : ''}
                    </span>
                    <span className="text-ink-500 ml-auto group-open:hidden">→</span>
                  </summary>
                  <pre className="mt-2 p-2 bg-ink-950 border border-ink-800 rounded text-[11px] font-mono text-ink-200 overflow-x-auto">
                    {JSON.stringify(turn.rows, null, 2)}
                  </pre>
                </details>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function EmptyState({ onSuggestionClick }: { onSuggestionClick: (s: string) => void }) {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center px-4 py-12">
      <div className="w-12 h-12 rounded-xl bg-accent/15 border border-accent/30 flex items-center justify-center mb-4">
        <Sparkles size={20} className="text-accent" />
      </div>
      <h2 className="text-lg font-semibold tracking-tight mb-1">Demande à ton hub</h2>
      <p className="text-sm text-ink-400 mb-5 max-w-sm">
        Pose une question en français. Le hub génère du SQL, l&apos;exécute sur tes data,
        et te répond en langage naturel.
      </p>
      <div className="flex flex-wrap gap-1.5 justify-center max-w-xl">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => onSuggestionClick(s)}
            className="text-[12px] px-3 py-1.5 rounded-full bg-ink-800/60 border border-ink-700 text-ink-300 hover:text-ink-100 hover:border-ink-600 transition-colors"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  )
}

function SettingsBar({
  scope,
  mode,
  model,
  showSettings,
  onToggleSettings,
}: {
  scope: SearchScope
  mode: SearchMode
  model: AIModel
  showSettings: boolean
  onToggleSettings: () => void
}) {
  const scopeLabel = SCOPES.find((s) => s.id === scope)?.label ?? scope
  const modeMeta = MODES.find((m) => m.id === mode)
  const modelLabel = MODELS.find((m) => m.id === model)?.label ?? model
  const ModeIcon = modeMeta?.icon ?? HardDrive

  return (
    <button
      type="button"
      onClick={onToggleSettings}
      className={cn(
        'flex items-center gap-2 px-2 py-1 rounded-md text-[11px] font-mono transition-colors',
        showSettings
          ? 'bg-ink-800 text-ink-100'
          : 'text-ink-400 hover:text-ink-200 hover:bg-ink-800/50'
      )}
    >
      <ModeIcon size={11} />
      <span>{modeMeta?.label}</span>
      <span className="text-ink-600">·</span>
      <span>{scopeLabel}</span>
      <span className="text-ink-600">·</span>
      <span>{modelLabel}</span>
      <ChevronDown size={11} className={cn('transition-transform', showSettings && 'rotate-180')} />
    </button>
  )
}

function SettingsPanel({
  scope,
  mode,
  model,
  onScopeChange,
  onModeChange,
  onModelChange,
}: {
  scope: SearchScope
  mode: SearchMode
  model: AIModel
  onScopeChange: (s: SearchScope) => void
  onModeChange: (m: SearchMode) => void
  onModelChange: (m: AIModel) => void
}) {
  return (
    <div className="ga-card p-3 grid grid-cols-1 md:grid-cols-3 gap-3 animate-fade-in">
      <div>
        <div className="metric-label mb-1.5">Source</div>
        <div className="flex gap-1">
          {MODES.map((m) => {
            const Icon = m.icon
            const active = mode === m.id
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => onModeChange(m.id)}
                title={m.description}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded text-xs border transition-colors',
                  active
                    ? 'bg-accent/15 border-accent/40 text-accent'
                    : 'bg-ink-800 border-ink-700 text-ink-300 hover:border-ink-600'
                )}
              >
                <Icon size={11} />
                <span>{m.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div>
        <div className="metric-label mb-1.5">Scope</div>
        <select
          value={scope}
          onChange={(e) => onScopeChange(e.target.value as SearchScope)}
          className="w-full bg-ink-800 border border-ink-700 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:border-accent/60"
        >
          {SCOPES.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <div className="metric-label mb-1.5">Modèle IA</div>
        <select
          value={model}
          onChange={(e) => onModelChange(e.target.value as AIModel)}
          className="w-full bg-ink-800 border border-ink-700 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:border-accent/60"
        >
          {MODELS.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
