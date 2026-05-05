'use client'

/**
 * CommandK — Recherche universelle / palette de commandes (Ctrl+K, Cmd+K sur Mac).
 *
 * Modal centrée style Spotlight / Linear / Raycast :
 *   - Input recherche en haut, focus auto
 *   - Resultats categorises : Pages, Questions recentes, Actions rapides
 *   - Nav clavier : Up/Down navigue, Enter selectionne, Esc ferme
 *   - Ctrl+K (Cmd+K sur Mac) toggle global (handler dans CommandKProvider)
 *
 * Indexe :
 *   - Toutes les routes du sidebar (Dashboard, Finances, Locations, etc.)
 *   - Les 10 dernieres questions du historique chat (localStorage hubchat_history_v1)
 *   - Actions rapides (poser une question, demarrer chat, voir insights, etc.)
 *
 * Selectionner :
 *   - Une page  -> router.push
 *   - Une question recente -> /search?q=<question>
 *   - Une action rapide -> action specifique (router push ou onSelect callback)
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Search,
  LayoutDashboard,
  Sparkles,
  Wallet,
  MapPin,
  Mail,
  Image as ImageIcon,
  Calendar,
  FileText,
  Heart,
  Settings,
  Activity,
  Users,
  CheckSquare,
  Youtube,
  Brain,
  History,
  Zap,
  ArrowRight,
  X,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Types ───────────────────────────────────────────────────────────────────

type CommandKind = 'page' | 'recent' | 'action' | 'ask'

interface CommandItem {
  id: string
  kind: CommandKind
  label: string
  description?: string
  icon: LucideIcon
  /** Mots-cles pour fuzzy search */
  keywords?: string[]
  /** Action a executer */
  onSelect: () => void
}

// ─── Pages indexees (mirror du sidebar) ──────────────────────────────────────

const PAGES: { href: string; label: string; icon: LucideIcon; kw: string[] }[] = [
  { href: '/',          label: 'Accueil',     icon: LayoutDashboard, kw: ['home', 'dashboard', 'chat', 'assistant'] },
  { href: '/search',    label: 'Recherche',   icon: Search,          kw: ['ai', 'sql', 'question'] },
  { href: '/insights',  label: 'Insights',    icon: Sparkles,        kw: ['anomalie', 'alerte', 'pattern'] },
  { href: '/finances',  label: 'Finances',    icon: Wallet,          kw: ['banque', 'argent', 'comptes', 'transactions', 'desjardins'] },
  { href: '/locations', label: 'Localisation',icon: MapPin,          kw: ['carte', 'voyages', 'maps', 'timeline', 'lieux'] },
  { href: '/emails',    label: 'Emails',      icon: Mail,            kw: ['gmail', 'inbox', 'mails', 'messages'] },
  { href: '/photos',    label: 'Photos',      icon: ImageIcon,       kw: ['google photos', 'images', 'galerie'] },
  { href: '/calendar',  label: 'Calendrier',  icon: Calendar,        kw: ['agenda', 'evenements', 'meetings'] },
  { href: '/documents', label: 'Documents',   icon: FileText,        kw: ['drive', 'pdfs', 'fichiers'] },
  { href: '/health',    label: 'Sante',       icon: Heart,           kw: ['fit', 'pas', 'sommeil', 'activite'] },
  { href: '/contacts',  label: 'Contacts',    icon: Users,           kw: ['gens', 'amis', 'famille'] },
  { href: '/tasks',     label: 'Taches',      icon: CheckSquare,     kw: ['todo', 'a faire', 'tasks'] },
  { href: '/youtube',   label: 'YouTube',     icon: Youtube,         kw: ['videos', 'historique'] },
  { href: '/system/health', label: 'Sante du hub', icon: Activity,   kw: ['health', 'monitoring', 'status'] },
  { href: '/settings',  label: 'Reglages',    icon: Settings,        kw: ['config', 'preferences', 'options'] },
]

// ─── Historique chat ─────────────────────────────────────────────────────────

interface HistoryEntry {
  role: 'user' | 'assistant'
  content: string
}

function loadRecentQuestions(limit = 8): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem('hubchat_history_v1')
    if (!raw) return []
    const all: HistoryEntry[] = JSON.parse(raw)
    if (!Array.isArray(all)) return []
    const questions = all
      .filter((m) => m.role === 'user' && typeof m.content === 'string')
      .map((m) => m.content.trim())
      .filter((q) => q.length > 0)
    // Dedupe + reverse (les plus recentes d'abord)
    const seen = new Set<string>()
    const unique: string[] = []
    for (let i = questions.length - 1; i >= 0 && unique.length < limit; i--) {
      const q = questions[i]
      if (!seen.has(q)) {
        seen.add(q)
        unique.push(q)
      }
    }
    return unique
  } catch {
    return []
  }
}

// ─── Fuzzy match simple (substring + score par position) ─────────────────────

function fuzzyScore(needle: string, haystack: string): number {
  if (!needle) return 1
  const n = needle.toLowerCase()
  const h = haystack.toLowerCase()
  if (h === n) return 1000
  if (h.startsWith(n)) return 500
  const idx = h.indexOf(n)
  if (idx >= 0) return 100 - idx
  // Caracteres dans l'ordre ?
  let i = 0
  for (const ch of h) {
    if (ch === n[i]) i++
    if (i === n.length) return 10
  }
  return 0
}

// ─── Composant principal ─────────────────────────────────────────────────────

export function CommandK({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [recentQs, setRecentQs] = useState<string[]>([])
  const [activeIdx, setActiveIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Reload recent questions when opened
  useEffect(() => {
    if (open) {
      setRecentQs(loadRecentQuestions(8))
      setQuery('')
      setActiveIdx(0)
      // Focus input apres render
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [open])

  // Lock body scroll quand modal ouverte
  useEffect(() => {
    if (typeof document === 'undefined') return
    if (open) {
      const prev = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = prev
      }
    }
  }, [open])

  // ─── Build commands list ──────────────────────────────────────────────────

  const items: CommandItem[] = useMemo(() => {
    const list: CommandItem[] = []

    // 1. Si query non-vide : "Demander a l'IA: <query>" en premier
    if (query.trim().length >= 3) {
      list.push({
        id: 'ask-ai',
        kind: 'ask',
        label: `Demander a l'IA : « ${query.trim()} »`,
        description: 'Genere SQL + reponse en francais',
        icon: Brain,
        onSelect: () => {
          router.push(`/search?q=${encodeURIComponent(query.trim())}`)
          onClose()
        },
      })
    }

    // 2. Pages
    for (const p of PAGES) {
      list.push({
        id: `page-${p.href}`,
        kind: 'page',
        label: p.label,
        description: p.href,
        icon: p.icon,
        keywords: p.kw,
        onSelect: () => {
          router.push(p.href)
          onClose()
        },
      })
    }

    // 3. Questions recentes
    for (const q of recentQs) {
      list.push({
        id: `recent-${q.slice(0, 30)}`,
        kind: 'recent',
        label: q,
        description: 'Question precedente',
        icon: History,
        onSelect: () => {
          router.push(`/search?q=${encodeURIComponent(q)}`)
          onClose()
        },
      })
    }

    // 4. Actions rapides
    list.push(
      {
        id: 'action-new-chat',
        kind: 'action',
        label: 'Nouvelle conversation',
        description: 'Reset le chat home',
        icon: Zap,
        keywords: ['clear', 'new', 'reset'],
        onSelect: () => {
          try {
            localStorage.removeItem('hubchat_history_v1')
          } catch {
            /* ignore */
          }
          router.push('/')
          onClose()
        },
      },
      {
        id: 'action-insights',
        kind: 'action',
        label: 'Voir tous les insights',
        icon: Sparkles,
        keywords: ['anomalies', 'alertes'],
        onSelect: () => {
          router.push('/insights')
          onClose()
        },
      },
      {
        id: 'action-health',
        kind: 'action',
        label: 'Sante du hub',
        description: 'Etat services + DB + Ollama',
        icon: Activity,
        keywords: ['status', 'monitoring'],
        onSelect: () => {
          router.push('/system/health')
          onClose()
        },
      },
    )

    return list
  }, [query, recentQs, router, onClose])

  // ─── Filter + sort ─────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    const q = query.trim()
    if (!q) return items
    const scored = items.map((item) => {
      const labelScore = fuzzyScore(q, item.label)
      const descScore = item.description ? fuzzyScore(q, item.description) * 0.5 : 0
      const kwScore = (item.keywords ?? []).reduce(
        (max, kw) => Math.max(max, fuzzyScore(q, kw) * 0.7),
        0,
      )
      // 'ask' command toujours en premier si query >= 3
      const askBoost = item.kind === 'ask' ? 10000 : 0
      return { item, score: askBoost + Math.max(labelScore, descScore, kwScore) }
    })
    return scored
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((s) => s.item)
  }, [items, query])

  // Reset activeIdx si filtered shrinks
  useEffect(() => {
    setActiveIdx((i) => Math.min(i, Math.max(0, filtered.length - 1)))
  }, [filtered.length])

  // Scroll active into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${activeIdx}"]`)
    if (el && 'scrollIntoView' in el) {
      ;(el as HTMLElement).scrollIntoView({ block: 'nearest' })
    }
  }, [activeIdx])

  // ─── Keyboard handlers ─────────────────────────────────────────────────────

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
        return
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActiveIdx((i) => Math.min(i + 1, filtered.length - 1))
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveIdx((i) => Math.max(i - 1, 0))
        return
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        const sel = filtered[activeIdx]
        if (sel) sel.onSelect()
        return
      }
    },
    [filtered, activeIdx, onClose],
  )

  if (!open) return null

  // Group by kind pour affichage
  const grouped: Record<CommandKind, CommandItem[]> = {
    ask: [],
    page: [],
    recent: [],
    action: [],
  }
  filtered.forEach((it) => grouped[it.kind].push(it))

  // Index global pour highlight + selection
  const globalIndex = new Map<string, number>()
  filtered.forEach((it, i) => globalIndex.set(it.id, i))

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[10vh] px-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Recherche universelle"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-ink-950/80 backdrop-blur-sm animate-fade-in" />

      {/* Modal */}
      <div
        className="relative w-full max-w-2xl ga-card border-ink-700 shadow-2xl shadow-ink-950/50 animate-fade-in overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header / input */}
        <div className="flex items-center gap-2 px-3 py-2.5 border-b border-ink-800">
          <Search size={14} className="text-ink-500 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Cherche une page, une question, ou demande a l'IA…"
            className="flex-1 bg-transparent border-0 outline-none text-sm text-ink-100 placeholder:text-ink-500"
            autoComplete="off"
            spellCheck={false}
          />
          <kbd className="text-[10px] font-mono text-ink-500 px-1.5 py-0.5 rounded border border-ink-700 hidden sm:inline-flex">
            Ctrl+K
          </kbd>
          <button
            type="button"
            onClick={onClose}
            className="text-ink-500 hover:text-ink-300 transition-colors p-1"
            aria-label="Fermer"
          >
            <X size={14} />
          </button>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[60vh] overflow-y-auto py-1">
          {filtered.length === 0 && (
            <div className="px-4 py-8 text-center text-xs text-ink-500">
              Aucun resultat. <span className="text-ink-400">Tape Entree pour demander a l&apos;IA.</span>
            </div>
          )}

          {(['ask', 'page', 'recent', 'action'] as CommandKind[]).map((kind) => {
            const arr = grouped[kind]
            if (arr.length === 0) return null
            return (
              <div key={kind} className="mb-1">
                <div className="px-3 pt-2 pb-1 text-[10px] font-mono uppercase tracking-wider text-ink-500">
                  {KIND_LABEL[kind]}
                </div>
                {arr.map((item) => {
                  const idx = globalIndex.get(item.id) ?? -1
                  const active = idx === activeIdx
                  const Icon = item.icon
                  return (
                    <button
                      key={item.id}
                      type="button"
                      data-idx={idx}
                      onMouseEnter={() => setActiveIdx(idx)}
                      onClick={() => item.onSelect()}
                      className={cn(
                        'w-full flex items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors',
                        active
                          ? 'bg-accent/10 text-ink-100'
                          : 'text-ink-300 hover:bg-ink-800/50',
                      )}
                    >
                      <div
                        className={cn(
                          'w-7 h-7 rounded-md flex items-center justify-center shrink-0 border',
                          active
                            ? 'bg-accent/15 border-accent/40 text-accent'
                            : 'bg-ink-800 border-ink-700 text-ink-400',
                        )}
                      >
                        <Icon size={13} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="truncate">{item.label}</div>
                        {item.description && (
                          <div className="text-[10px] text-ink-500 font-mono truncate">
                            {item.description}
                          </div>
                        )}
                      </div>
                      {active && (
                        <ArrowRight size={12} className="text-accent shrink-0" />
                      )}
                    </button>
                  )
                })}
              </div>
            )
          })}
        </div>

        {/* Footer hint */}
        <div className="border-t border-ink-800 px-3 py-1.5 flex items-center justify-between text-[10px] font-mono text-ink-500">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 rounded border border-ink-700">↑↓</kbd>
              naviguer
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 rounded border border-ink-700">↵</kbd>
              selectionner
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 rounded border border-ink-700">esc</kbd>
              fermer
            </span>
          </div>
          <span className="hidden sm:inline">{filtered.length} resultat(s)</span>
        </div>
      </div>
    </div>
  )
}

const KIND_LABEL: Record<CommandKind, string> = {
  ask: 'IA',
  page: 'Pages',
  recent: 'Questions recentes',
  action: 'Actions rapides',
}

// ─── Provider global ──────────────────────────────────────────────────────────

import { createContext, useContext } from 'react'

interface CommandKContext {
  open: () => void
  close: () => void
  isOpen: boolean
}

const Ctx = createContext<CommandKContext | null>(null)

/**
 * Provider : monte le CommandK overlay et expose un hook useCommandK()
 * pour ouvrir/fermer depuis n'importe ou.
 *
 * Place-le dans le layout root (sous Providers).
 */
export function CommandKProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)

  const open = useCallback(() => setIsOpen(true), [])
  const close = useCallback(() => setIsOpen(false), [])

  // Ctrl+K (Cmd+K sur Mac) global toggle
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        // Pas si focus dans un input qui doit traiter Ctrl+K (rare)
        e.preventDefault()
        setIsOpen((v) => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <Ctx.Provider value={{ open, close, isOpen }}>
      {children}
      <CommandK open={isOpen} onClose={close} />
    </Ctx.Provider>
  )
}

export function useCommandK(): CommandKContext {
  const ctx = useContext(Ctx)
  if (!ctx) {
    // Fallback no-op si non monté (evite crash dans tests / SSR)
    return {
      open: () => {},
      close: () => {},
      isOpen: false,
    }
  }
  return ctx
}
