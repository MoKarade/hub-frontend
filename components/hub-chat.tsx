'use client'

/**
 * HubChat — Home conversationnel (vision Marc, evolutions 2026-05-05).
 *
 * Features :
 *  - 2 modes IA : `data` (genere SQL + interroge DB) ou `chat` (LLM seul, pas de DB)
 *  - Multi-conversation : historique en localStorage, switch entre conversations
 *  - Streaming SSE pour le mode data avec stage labels en francais lisible
 *    ("Je cherche dans tes emails...") au lieu du jargon technique
 *  - Suggestions contextuelles selon heure du jour
 *  - CTAs cliquables vers les pages source (cf. components MessageView ci-bas)
 *
 * Persistance : `localStorage[hubchat_conversations_v2]` = liste de conversations.
 * Migration auto depuis l'ancien `hubchat_history_v1` (1 conv) au 1er load.
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
  ArrowRight,
  ExternalLink,
  MessageSquare,
  Plus,
  HardDrive,
  MessagesSquare,
  Wallet,
  MapPin,
  Mail,
  Image as ImageIcon,
  Calendar,
  FileText,
  Heart,
  Users,
  CheckSquare,
  Youtube,
  Newspaper,
  Volume2,
  VolumeX,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { sourceForSql, rowLink } from '@/lib/source-mapping'
import { useVoice } from '@/lib/use-voice'

// ─── Types ───────────────────────────────────────────────────────────────────

type AIMode = 'data' | 'chat'

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
  mode?: AIMode
  ts: number
}

interface Conversation {
  id: string
  title: string         // ~40 chars derives du 1er message user
  mode: AIMode          // mode au moment de la creation
  messages: ChatMessage[]
  created_at: number
  updated_at: number
}

// ─── Suggestions contextuelles ──────────────────────────────────────────────

function getContextualSuggestions(): string[] {
  const now = new Date()
  const hour = now.getHours()
  const day = now.getDay()

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
    "Les actualités du jour ?",
  ]

  let prio: string[] = []
  if (hour < 11) {
    prio = ["Mes événements aujourd'hui ?", "Mes tâches en retard ?", "Combien d'emails non-lus ?"]
  } else if (hour < 17) {
    prio = ["Combien d'emails non-lus ?", "Combien j'ai dépensé ce mois-ci ?", "Les actualités du jour ?"]
  } else {
    prio = ["Où étais-je aujourd'hui ?", "Combien j'ai dépensé en restos cette semaine ?", "Mes événements demain ?"]
  }
  if (day === 0 || day === 6) prio.unshift("Mes voyages cette année ?")

  const seen = new Set(prio)
  const others = all.filter((q) => !seen.has(q)).sort(() => Math.random() - 0.5)
  return [...prio, ...others].slice(0, 5)
}

// ─── Mapping FROM <table> -> label francais (pour stage label) ──────────────

const TABLE_LABELS: Record<string, { label: string; icon: LucideIcon }> = {
  emails:                  { label: 'tes emails',           icon: Mail },
  calendar_events:         { label: 'ton calendrier',       icon: Calendar },
  photos:                  { label: 'tes photos',           icon: ImageIcon },
  drive_files:             { label: 'tes documents Drive',  icon: FileText },
  tasks:                   { label: 'tes tâches',           icon: CheckSquare },
  contacts:                { label: 'tes contacts',         icon: Users },
  health_metrics:          { label: 'tes données santé',    icon: Heart },
  youtube_activities:      { label: 'ton historique YouTube', icon: Youtube },
  news_articles:           { label: 'les actualités',       icon: Newspaper },
  transactions:            { label: 'tes transactions',     icon: Wallet },
  credit_card_transactions:{ label: 'ta carte de crédit',   icon: Wallet },
  investment_transactions: { label: 'tes investissements',  icon: Wallet },
  investment_positions:    { label: 'ton portefeuille',     icon: Wallet },
  accounts:                { label: 'tes comptes',          icon: Wallet },
  location_visits:         { label: 'tes lieux visités',    icon: MapPin },
  location_activities:     { label: 'tes trajets',          icon: MapPin },
  location_points:         { label: 'tes positions GPS',    icon: MapPin },
  named_places:            { label: 'tes lieux nommés',     icon: MapPin },
  trip_notes:              { label: 'tes notes de voyage',  icon: MapPin },
}

function parseSourceFromSql(sql: string): { label: string; icon: LucideIcon } | null {
  const m = sql.match(/\bFROM\s+([a-z_][a-z0-9_]*)/i)
  if (!m) return null
  return TABLE_LABELS[m[1].toLowerCase()] ?? null
}

// ─── Persistance multi-conversation ──────────────────────────────────────────

const CONVS_KEY = 'hubchat_conversations_v2'
const LEGACY_KEY = 'hubchat_history_v1'
const MAX_CONVS = 30
const MAX_MSGS_PER_CONV = 100

function makeTitle(question: string): string {
  const t = question.trim().replace(/\s+/g, ' ')
  return t.length <= 40 ? t : t.slice(0, 37) + '...'
}

function loadConversations(): Conversation[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(CONVS_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) return parsed
    }
    // Migration depuis ancien format (1 conversation lineaire)
    const legacy = localStorage.getItem(LEGACY_KEY)
    if (legacy) {
      const msgs = JSON.parse(legacy) as ChatMessage[]
      if (Array.isArray(msgs) && msgs.length > 0) {
        const firstUser = msgs.find((m) => m.role === 'user')
        const conv: Conversation = {
          id: `c_${Date.now()}`,
          title: firstUser ? makeTitle(firstUser.content) : 'Conversation initiale',
          mode: 'data',
          messages: msgs,
          created_at: msgs[0]?.ts ?? Date.now(),
          updated_at: msgs[msgs.length - 1]?.ts ?? Date.now(),
        }
        return [conv]
      }
    }
  } catch {
    /* ignore */
  }
  return []
}

function saveConversations(convs: Conversation[]) {
  if (typeof window === 'undefined') return
  try {
    // Limite : MAX_CONVS plus recentes, MAX_MSGS_PER_CONV par conv
    const trimmed = convs
      .slice()
      .sort((a, b) => b.updated_at - a.updated_at)
      .slice(0, MAX_CONVS)
      .map((c) => ({ ...c, messages: c.messages.slice(-MAX_MSGS_PER_CONV) }))
    localStorage.setItem(CONVS_KEY, JSON.stringify(trimmed))
  } catch {
    /* quota / privacy mode */
  }
}

// ─── Composant principal ─────────────────────────────────────────────────────

export function HubChat({
  onOpenCommandK,
  initialQuestion,
  onInitialConsumed,
}: {
  onOpenCommandK?: () => void
  initialQuestion?: string
  onInitialConsumed?: () => void
}) {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeConvId, setActiveConvId] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [mode, setMode] = useState<AIMode>('data')
  const [showConvList, setShowConvList] = useState(false)
  const [stage, setStage] = useState<StreamStage>('idle')
  const [stageLabel, setStageLabel] = useState<string>('')
  const [stageIcon, setStageIcon] = useState<LucideIcon | null>(null)
  const [streamingSql, setStreamingSql] = useState<string>('')
  const [streamingRows, setStreamingRows] = useState<{
    rows: Array<Record<string, unknown>>
    count: number
  } | null>(null)
  const [streamingAnswer, setStreamingAnswer] = useState<string>('')
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  // ── Voice : STT (input vocal) + TTS (lecture reponse) ──
  const [voiceTtsEnabled, setVoiceTtsEnabled] = useState(false)
  const voice = useVoice({
    lang: 'fr-CA',
    onTranscript: (text) => {
      // Auto-envoie le message vocal
      if (text.trim()) {
        sendMessage(text.trim())
      }
    },
  })

  // Persiste preference TTS
  useEffect(() => {
    try {
      const v = localStorage.getItem('hubchat_tts')
      if (v === '1') setVoiceTtsEnabled(true)
    } catch {
      /* ignore */
    }
  }, [])
  useEffect(() => {
    try {
      localStorage.setItem('hubchat_tts', voiceTtsEnabled ? '1' : '0')
    } catch {
      /* ignore */
    }
  }, [voiceTtsEnabled])

  // ─── Hydration localStorage (au mount) ────────────────────────────────────
  useEffect(() => {
    const convs = loadConversations()
    setConversations(convs)
    // Si on a des conversations, ouvre la plus recente
    if (convs.length > 0) setActiveConvId(convs[0].id)
    // Charge le mode preferred
    try {
      const m = localStorage.getItem('hubchat_mode')
      if (m === 'chat' || m === 'data') setMode(m)
    } catch {
      /* ignore */
    }
  }, [])

  // Persiste a chaque changement de conversations
  useEffect(() => {
    if (conversations.length > 0) saveConversations(conversations)
  }, [conversations])

  // Persiste le mode
  useEffect(() => {
    try { localStorage.setItem('hubchat_mode', mode) } catch { /* ignore */ }
  }, [mode])

  // Focus input + auto-scroll
  useEffect(() => { inputRef.current?.focus() }, [activeConvId])
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [conversations, streamingAnswer, streamingRows, stage, activeConvId])

  const suggestions = useMemo(() => getContextualSuggestions(), [])
  const isStreaming = stage !== 'idle' && stage !== 'done' && stage !== 'error'

  // Conversation active (ou null si rien -> empty state)
  const activeConv = useMemo(
    () => conversations.find((c) => c.id === activeConvId) ?? null,
    [conversations, activeConvId],
  )
  const messages = activeConv?.messages ?? []

  // ─── Helpers conversation management ─────────────────────────────────────

  const createNewConversation = useCallback(
    (firstUserMessage: ChatMessage): string => {
      const id = `c_${Date.now()}`
      const conv: Conversation = {
        id,
        title: makeTitle(firstUserMessage.content),
        mode,
        messages: [firstUserMessage],
        created_at: Date.now(),
        updated_at: Date.now(),
      }
      setConversations((prev) => [conv, ...prev])
      setActiveConvId(id)
      return id
    },
    [mode],
  )

  const appendToConv = useCallback((convId: string, msg: ChatMessage) => {
    setConversations((prev) =>
      prev.map((c) =>
        c.id === convId
          ? { ...c, messages: [...c.messages, msg], updated_at: Date.now() }
          : c,
      ),
    )
  }, [])

  const startNewConversation = () => {
    setActiveConvId(null)
    setShowConvList(false)
    setInput('')
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  const switchConversation = (id: string) => {
    setActiveConvId(id)
    setShowConvList(false)
  }

  const deleteConversation = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    if (!confirm('Supprimer cette conversation ?')) return
    setConversations((prev) => prev.filter((c) => c.id !== id))
    if (activeConvId === id) setActiveConvId(null)
  }

  const clearAllHistory = () => {
    if (!confirm('Effacer TOUT l\'historique de conversations ?')) return
    setConversations([])
    setActiveConvId(null)
    setShowConvList(false)
    try { localStorage.removeItem(CONVS_KEY); localStorage.removeItem(LEGACY_KEY) } catch { /* */ }
  }

  // ─── Send message ────────────────────────────────────────────────────────

  const sendMessage = useCallback(
    async (questionText: string) => {
      const text = questionText.trim()
      if (!text || isStreaming) return

      const userMsg: ChatMessage = {
        id: `u_${Date.now()}`,
        role: 'user',
        content: text,
        mode,
        ts: Date.now(),
      }

      // Cree ou continue conversation existante
      let convId = activeConvId
      if (!convId) {
        convId = createNewConversation(userMsg)
      } else {
        appendToConv(convId, userMsg)
      }

      setInput('')
      setStreamingSql('')
      setStreamingRows(null)
      setStreamingAnswer('')
      setStageIcon(null)
      setStage(mode === 'chat' ? 'answer_generation' : 'sql_generation')
      setStageLabel(mode === 'chat' ? 'Je réfléchis…' : "Je traduis ta question en SQL…")

      // Build history pour contexte LLM (10 derniers messages de la conv)
      const historyForLlm = (activeConv?.messages ?? [])
        .slice(-10)
        .map((m) => ({ role: m.role, content: m.content }))

      const ctrl = new AbortController()
      abortRef.current = ctrl

      try {
        // ── Mode chat (LLM seul, pas de DB) ──────────────────────────────
        if (mode === 'chat') {
          const r = await fetch('/api/v1/ai/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: text, history: historyForLlm }),
            signal: ctrl.signal,
          })
          if (!r.ok) throw new Error(`HTTP ${r.status}`)
          const data = await r.json()
          const assistantMsg: ChatMessage = {
            id: `a_${Date.now()}`,
            role: 'assistant',
            content: data.answer || data.response || '(pas de réponse)',
            mode: 'chat',
            ts: Date.now(),
          }
          appendToConv(convId, assistantMsg)
          return
        }

        // ── Mode data (SSE streaming SQL + DB + reformulation) ───────────
        const res = await fetch('/api/v1/ai/ask/stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question: text, history: historyForLlm }),
          signal: ctrl.signal,
        })
        if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`)

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
            try { parsed = JSON.parse(data) } catch { continue }

            switch (ev) {
              case 'stage': {
                const s = parsed.stage as StreamStage
                setStage(s)
                // Stage labels en francais lisible
                const friendly: Record<string, string> = {
                  sql_generation:    "Je traduis ta question en SQL…",
                  sql_validation:    "Je valide la requête…",
                  sql_execution:     "J'interroge la base de données…",
                  answer_generation: "Je rédige ta réponse…",
                  done:              "Terminé",
                }
                setStageLabel(friendly[s] ?? (parsed.label as string) ?? '')
                break
              }
              case 'sql': {
                finalSql = (parsed.sql as string) || ''
                setStreamingSql(finalSql)
                // Met a jour le label avec la table cherchee
                const src = parseSourceFromSql(finalSql)
                if (src) {
                  setStageLabel(`Je regarde dans ${src.label}…`)
                  setStageIcon(() => src.icon)
                }
                break
              }
              case 'rows': {
                finalRows = (parsed.rows as Array<Record<string, unknown>>) || []
                finalRowCount = (parsed.row_count as number) ?? finalRows.length
                setStreamingRows({ rows: finalRows, count: finalRowCount })
                setStageLabel(
                  finalRowCount === 0
                    ? "Aucun résultat trouvé"
                    : `${finalRowCount} résultat${finalRowCount > 1 ? 's' : ''} trouvé${finalRowCount > 1 ? 's' : ''} — je rédige…`,
                )
                break
              }
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
                finalRows = (parsed.rows as Array<Record<string, unknown>>) || finalRows
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
          mode: 'data',
          ts: Date.now(),
        }
        appendToConv(convId, assistantMsg)

        // TTS si active
        if (voiceTtsEnabled && finalAnswer && !finalError) {
          voice.speak(finalAnswer)
        }
      } catch (err) {
        if ((err as Error).name === 'AbortError') return
        appendToConv(convId, {
          id: `a_${Date.now()}`,
          role: 'assistant',
          content: `Erreur : ${(err as Error).message}`,
          error: (err as Error).message,
          mode,
          ts: Date.now(),
        })
      } finally {
        setStreamingSql('')
        setStreamingRows(null)
        setStreamingAnswer('')
        setStage('idle')
        setStageLabel('')
        setStageIcon(null)
        abortRef.current = null
        inputRef.current?.focus()
      }
    },
    [isStreaming, mode, activeConvId, activeConv, createNewConversation, appendToConv],
  )

  // Cleanup abort si unmount
  useEffect(() => () => abortRef.current?.abort(), [])

  // Auto-envoi de l'initialQuestion (vient de Cmd+K ou /search?q=)
  const initialSentRef = useRef(false)
  useEffect(() => {
    if (
      !initialSentRef.current &&
      initialQuestion &&
      initialQuestion.trim().length >= 3 &&
      !isStreaming
    ) {
      initialSentRef.current = true
      void sendMessage(initialQuestion)
      onInitialConsumed?.()
    }
  }, [initialQuestion, isStreaming, sendMessage, onInitialConsumed])

  // Ctrl+K shortcut
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
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

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full max-h-[calc(100vh-2rem)]">
      {/* Header avec mode selector + conversations dropdown + actions */}
      <header className="flex items-center justify-between mb-3 flex-shrink-0 gap-2 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <Brain size={16} className="text-accent shrink-0" />
          <h2 className="text-sm font-semibold text-ink-100 truncate">
            {activeConv?.title || 'Nouvelle conversation'}
          </h2>
          <span className="text-[10px] font-mono text-ink-500 hidden sm:inline">qwen 2.5 14b · local</span>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Mode selector data | chat */}
          <div className="flex items-center bg-ink-900 border border-ink-700 rounded-md p-0.5">
            <button
              type="button"
              onClick={() => setMode('data')}
              className={cn(
                'flex items-center gap-1 px-2 py-1 text-[10px] font-mono rounded transition-colors',
                mode === 'data'
                  ? 'bg-accent/15 text-accent'
                  : 'text-ink-400 hover:text-ink-200',
              )}
              title="Mode data : interroge ta DB (génère du SQL)"
            >
              <HardDrive size={10} /> data
            </button>
            <button
              type="button"
              onClick={() => setMode('chat')}
              className={cn(
                'flex items-center gap-1 px-2 py-1 text-[10px] font-mono rounded transition-colors',
                mode === 'chat'
                  ? 'bg-accent/15 text-accent'
                  : 'text-ink-400 hover:text-ink-200',
              )}
              title="Mode chat : discussion libre avec l'IA, sans toucher à ta DB"
            >
              <MessagesSquare size={10} /> chat
            </button>
          </div>

          {/* Conversations dropdown */}
          <button
            type="button"
            onClick={() => setShowConvList((v) => !v)}
            className={cn(
              'text-[10px] font-mono uppercase tracking-wider px-2 py-1 rounded border flex items-center gap-1 transition-colors',
              showConvList
                ? 'bg-ink-800 border-accent/40 text-accent'
                : 'border-ink-700 text-ink-400 hover:text-accent hover:border-accent',
            )}
            title="Historique des conversations"
          >
            <MessageSquare size={10} />
            <span className="hidden sm:inline">{conversations.length || 0}</span>
            {showConvList ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
          </button>

          {/* New conversation */}
          <button
            type="button"
            onClick={startNewConversation}
            className="text-[10px] font-mono uppercase tracking-wider text-ink-400 hover:text-accent transition-colors px-2 py-1 rounded border border-ink-700 hover:border-accent flex items-center gap-1"
            title="Nouvelle conversation"
          >
            <Plus size={10} /> new
          </button>

          {onOpenCommandK && (
            <button
              type="button"
              onClick={onOpenCommandK}
              className="text-[10px] font-mono uppercase tracking-wider text-ink-400 hover:text-accent transition-colors px-2 py-1 rounded border border-ink-700 hover:border-accent flex items-center gap-1"
              title="Recherche universelle (Ctrl+K)"
            >
              <Search size={10} /><span>Ctrl+K</span>
            </button>
          )}
        </div>
      </header>

      {/* Conversations list panel (toggle) */}
      {showConvList && (
        <div className="ga-card border-accent/20 mb-3 max-h-64 overflow-y-auto flex-shrink-0">
          {conversations.length === 0 ? (
            <div className="p-3 text-xs text-ink-500 italic text-center">
              Aucune conversation. Pose une question pour commencer.
            </div>
          ) : (
            <>
              <div className="px-3 py-1.5 flex items-center justify-between border-b border-ink-800">
                <span className="text-[10px] font-mono uppercase tracking-wider text-ink-500">
                  {conversations.length} conversation{conversations.length > 1 ? 's' : ''}
                </span>
                <button
                  type="button"
                  onClick={clearAllHistory}
                  className="text-[10px] font-mono text-ink-500 hover:text-data-negative flex items-center gap-1"
                >
                  <Trash2 size={10} /> tout effacer
                </button>
              </div>
              <div className="divide-y divide-ink-800">
                {conversations.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => switchConversation(c.id)}
                    className={cn(
                      'w-full flex items-center gap-2 px-3 py-2 text-left transition-colors group',
                      c.id === activeConvId
                        ? 'bg-accent/10 text-ink-100'
                        : 'hover:bg-ink-800/50 text-ink-300',
                    )}
                  >
                    {c.mode === 'data' ? (
                      <HardDrive size={11} className="text-ink-500 shrink-0" />
                    ) : (
                      <MessagesSquare size={11} className="text-ink-500 shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-[12px] truncate">{c.title}</div>
                      <div className="text-[10px] font-mono text-ink-500">
                        {c.messages.length} msg · {new Date(c.updated_at).toLocaleString('fr-CA', { dateStyle: 'short', timeStyle: 'short' })}
                      </div>
                    </div>
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => deleteConversation(c.id, e)}
                      onKeyDown={(e) => { if (e.key === 'Enter') deleteConversation(c.id) }}
                      className="opacity-0 group-hover:opacity-100 p-1 -mr-1 text-ink-500 hover:text-data-negative transition-all"
                      aria-label="Supprimer"
                    >
                      <Trash2 size={11} />
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Conversation scroll */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto pr-2 mb-3 min-h-0">
        {messages.length === 0 && !isStreaming && (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <Sparkles size={28} className="text-accent/60 mb-3" />
            <h3 className="text-base font-semibold text-ink-100 mb-1">
              Que veux-tu savoir ?
            </h3>
            <p className="text-xs text-ink-400 mb-1">
              Pose une question en français — toutes tes données sont à portée de prompt.
            </p>
            <p className="text-[11px] text-ink-500 mb-5 font-mono">
              mode actif : <span className="text-accent">{mode === 'data' ? 'data (interroge ta DB)' : 'chat (discussion libre)'}</span>
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

        {/* Streaming message en cours */}
        {isStreaming && (
          <div className="ga-card border-accent/30 bg-accent/5 p-3 mb-3">
            <div className="flex items-center gap-2 mb-2">
              {stageIcon ? (
                (() => {
                  const Icon = stageIcon
                  return <Icon size={13} className="text-accent" />
                })()
              ) : (
                <Loader2 size={12} className="text-accent animate-spin" />
              )}
              <span className="text-[11px] font-mono text-accent">{stageLabel}</span>
              {stageIcon && <Loader2 size={10} className="text-accent/60 animate-spin ml-auto" />}
            </div>
            {streamingSql && (
              <details className="mb-2">
                <summary className="cursor-pointer text-[10px] font-mono text-ink-500 hover:text-ink-300 flex items-center gap-1">
                  <FileCode size={10} /> SQL généré
                </summary>
                <pre className="mt-1 text-[10px] text-ink-300 bg-ink-950 p-2 rounded overflow-x-auto">
                  {streamingSql}
                </pre>
              </details>
            )}
            {streamingRows && streamingRows.count > 0 && (
              <div className="flex items-center gap-2 text-[10px] font-mono text-ink-400 mb-2">
                <Database size={10} />
                <span>{streamingRows.count} ligne(s) trouvée(s)</span>
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
        {/* Indicateur d'ecoute vocale */}
        {voice.status === 'listening' && (
          <div className="text-[11px] text-data-negative font-mono mb-1 px-2 flex items-center gap-2">
            <Mic size={11} className="animate-pulse" />
            J&apos;écoute… {voice.interimTranscript && <span className="text-ink-300 italic">«{voice.interimTranscript}»</span>}
          </div>
        )}
        <div className="ga-card focus-within:border-accent/50 transition-colors">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onTextareaKey}
            placeholder={
              isStreaming
                ? 'Génération en cours…'
                : voice.status === 'listening'
                  ? 'En écoute vocale…'
                  : mode === 'data'
                    ? 'Pose une question sur tes données…'
                    : 'Discute avec l\'IA…'
            }
            disabled={isStreaming}
            rows={2}
            className="w-full bg-transparent border-0 outline-none px-3 py-2 text-sm text-ink-100 placeholder:text-ink-500 resize-none disabled:opacity-50"
          />
          <div className="flex items-center justify-between px-3 py-1.5 border-t border-ink-800/50">
            <div className="flex items-center gap-3 text-[10px] text-ink-500">
              <span className="font-mono">↵ envoyer · ⇧↵ ligne</span>
              <span className="font-mono text-ink-600 hidden sm:inline">
                · mode <span className="text-ink-400">{mode}</span>
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              {/* TTS toggle (lecture vocale des reponses) */}
              {voice.isTtsSupported && (
                <button
                  type="button"
                  onClick={() => {
                    if (voice.status === 'speaking') voice.cancelSpeak()
                    setVoiceTtsEnabled((v) => !v)
                  }}
                  className={cn(
                    'px-2 py-1 rounded transition-colors flex items-center gap-1 text-[10px] font-mono',
                    voiceTtsEnabled
                      ? 'text-accent bg-accent/10 hover:bg-accent/20'
                      : 'text-ink-500 hover:text-ink-300',
                  )}
                  title={
                    voiceTtsEnabled
                      ? 'Lecture vocale active (cliquer pour arrêter)'
                      : 'Activer la lecture vocale des réponses'
                  }
                >
                  {voice.status === 'speaking' ? (
                    <Volume2 size={11} className="animate-pulse" />
                  ) : voiceTtsEnabled ? (
                    <Volume2 size={11} />
                  ) : (
                    <VolumeX size={11} />
                  )}
                </button>
              )}
              {/* STT (input vocal) */}
              <button
                type="button"
                onClick={() => {
                  if (voice.status === 'listening') voice.stopListening()
                  else voice.startListening()
                }}
                disabled={!voice.isSttSupported}
                className={cn(
                  'px-2 py-1 rounded transition-colors flex items-center gap-1 text-[10px] font-mono',
                  voice.status === 'listening'
                    ? 'text-data-negative bg-data-negative/10 animate-pulse'
                    : voice.isSttSupported
                      ? 'text-ink-400 hover:text-accent'
                      : 'text-ink-600 opacity-40 cursor-not-allowed',
                )}
                title={
                  voice.isSttSupported
                    ? voice.status === 'listening'
                      ? "J'écoute... (cliquer pour arrêter)"
                      : 'Dicter un message (Web Speech API)'
                    : 'Reconnaissance vocale non supportée par ce navigateur'
                }
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
  const [showRows, setShowRows] = useState(true)

  const isUser = message.role === 'user'
  const source = !isUser ? sourceForSql(message.sql) : null
  const SourceIcon = source?.icon
  const hasRows = !isUser && message.rows && message.rows.length > 0

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

        {!isUser && source && source.id !== 'data' && (
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <Link
              href={source.href}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-mono bg-accent/10 border border-accent/30 text-accent rounded-md hover:bg-accent/20 transition-colors"
            >
              {SourceIcon && <SourceIcon size={11} />}
              <span>Voir dans {source.label}</span>
              <ArrowRight size={10} />
            </Link>
            {hasRows && message.rows && message.rows.length === 1 && (() => {
              const link = rowLink(source, message.rows[0])
              return link ? (
                <Link
                  href={link}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-mono bg-ink-800 border border-ink-700 text-ink-300 rounded-md hover:border-accent/40 hover:text-ink-100 transition-colors"
                >
                  <ExternalLink size={10} /> Ouvrir
                </Link>
              ) : null
            })()}
          </div>
        )}

        {!isUser && (message.sql || (message.rows && message.rows.length > 0)) && (
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] font-mono text-ink-500">
            {typeof message.row_count === 'number' && message.row_count > 0 && (
              <button
                type="button"
                onClick={() => setShowRows((v) => !v)}
                className="hover:text-ink-300 transition-colors flex items-center gap-1"
              >
                <Database size={10} />
                {message.row_count} resultat{message.row_count > 1 ? 's' : ''}
                {showRows ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
              </button>
            )}
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
          </div>
        )}

        {showSql && message.sql && (
          <pre className="mt-2 text-[10px] text-ink-300 bg-ink-950 p-2 rounded overflow-x-auto">
            {message.sql}
          </pre>
        )}

        {showRows && hasRows && message.rows && (
          <div className="mt-2 max-h-80 overflow-auto rounded border border-ink-800">
            <table className="w-full text-[11px]">
              <thead className="bg-ink-900 sticky top-0 z-10">
                <tr>
                  {Object.keys(message.rows[0]).map((k) => (
                    <th
                      key={k}
                      className="text-left px-2 py-1.5 font-mono text-[10px] uppercase tracking-wider text-ink-500 border-b border-ink-800"
                    >
                      {k}
                    </th>
                  ))}
                  {source && source.id !== 'data' && (
                    <th className="w-8 border-b border-ink-800" />
                  )}
                </tr>
              </thead>
              <tbody>
                {message.rows.slice(0, 50).map((row, i) => {
                  const link = source ? rowLink(source, row) : null
                  return (
                    <tr
                      key={i}
                      className={cn(
                        'border-b border-ink-900/50 transition-colors',
                        link ? 'hover:bg-accent/5 cursor-pointer group' : 'hover:bg-ink-800/30',
                      )}
                      onClick={() => { if (link) window.location.href = link }}
                    >
                      {Object.values(row).map((v, j) => (
                        <td key={j} className="px-2 py-1.5 text-ink-200 whitespace-nowrap">
                          {formatCell(v)}
                        </td>
                      ))}
                      {source && source.id !== 'data' && (
                        <td className="px-1 text-ink-600 group-hover:text-accent">
                          {link && <ArrowRight size={11} />}
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {message.rows.length > 50 && (
              <div className="text-[10px] text-ink-500 italic px-2 py-1.5 bg-ink-900 border-t border-ink-800">
                + {message.rows.length - 50} autres lignes — affine ta question pour voir plus
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function formatCell(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—'
  if (typeof v === 'string') {
    if (/^\d{4}-\d{2}-\d{2}T/.test(v)) {
      try {
        return new Date(v).toLocaleString('fr-CA', { dateStyle: 'short', timeStyle: 'short' })
      } catch { return v }
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
      try {
        return new Date(v).toLocaleDateString('fr-CA', { year: 'numeric', month: 'short', day: 'numeric' })
      } catch { return v }
    }
    if (v.length > 80) return v.slice(0, 77) + '…'
    return v
  }
  if (typeof v === 'number') {
    if (Number.isInteger(v)) return v.toLocaleString('fr-CA')
    return v.toFixed(2)
  }
  if (typeof v === 'boolean') return v ? 'oui' : 'non'
  return String(v)
}
