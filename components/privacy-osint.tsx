'use client'

/**
 * PrivacyOsint - vue ultra epuree.
 * Plutot que reinventer la roue (URLs qui changent, opt-outs introuvables),
 * on pointe vers 2 outils tiers maintenus :
 *  - yourdigitalrights.org : request RGPD/PIPEDA pour ANY company (100k+ requests)
 *  - justdeleteme.xyz : directory de suppression de compte pour 500+ services
 * Plus 6 quick-links opt-out verifies pour les data brokers majeurs.
 */

import { useState } from 'react'
import {
  ExternalLink,
  Mail,
  Camera,
  Search,
  ShieldOff,
  Globe,
  Github,
  Server,
  Copy,
  Check,
  X,
  Trash2,
  FileX,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ============================================================================
// Verified opt-out URLs (octobre 2026) - 6 plus gros brokers seulement
// ============================================================================

interface QuickOptOut {
  name: string
  url: string
}

const QUICK_OPTOUTS: QuickOptOut[] = [
  { name: 'Spokeo', url: 'https://www.spokeo.com/optout' },
  { name: 'PeopleConnect (Intelius/TruthFinder)', url: 'https://suppression.peopleconnect.us' },
  { name: 'Acxiom', url: 'https://isapps.acxiom.com/optout/optout.aspx' },
  { name: 'BeenVerified', url: 'https://www.beenverified.com/app/optout/search' },
  { name: 'Whitepages.com', url: 'https://www.whitepages.com/suppression-requests' },
  { name: 'TruePeopleSearch', url: 'https://www.truepeoplesearch.com/removal' },
]

// ============================================================================
// Main
// ============================================================================

type Panel = 'loi25' | 'osint' | null

export function PrivacyOsint() {
  const [panel, setPanel] = useState<Panel>(null)
  const toggle = (p: Panel) => setPanel((cur) => (cur === p ? null : p))

  return (
    <div className="space-y-3">
      {/* 4 tuiles iconiques principales */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <Tile icon={Mail} label="Email breach" color="info" href="https://monitor.mozilla.org/" />
        <Tile icon={Camera} label="Reverse photo" color="warn" href="https://pimeyes.com/en" />
        <Tile
          icon={ShieldOff}
          label="Loi 25"
          color="accent"
          active={panel === 'loi25'}
          onClick={() => toggle('loi25')}
        />
        <Tile
          icon={Server}
          label="OSINT"
          color="data-negative"
          active={panel === 'osint'}
          onClick={() => toggle('osint')}
        />
      </div>

      {panel === 'loi25' && <Loi25Panel onClose={() => setPanel(null)} />}
      {panel === 'osint' && <OsintPanel onClose={() => setPanel(null)} />}

      {/* 2 outils tiers + 6 quick opt-outs */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <ExternalToolCard
          icon={Trash2}
          title="Demander suppression"
          subtitle="yourdigitalrights.org"
          desc="Auto-génère email PIPEDA/RGPD pour n'importe quelle entreprise"
          color="accent"
          url="https://yourdigitalrights.org/"
        />
        <ExternalToolCard
          icon={FileX}
          title="Supprimer un compte"
          subtitle="justdeleteme.xyz"
          desc="Directory de suppression pour 500+ services en ligne"
          color="info"
          url="https://justdeleteme.xyz/"
        />
      </div>

      <QuickOptOutsList />
    </div>
  )
}

// ============================================================================
// Tuiles principales
// ============================================================================

const TILE_COLORS = {
  info: 'border-info/30 hover:border-info/60 bg-info/5 text-info',
  warn: 'border-warn/30 hover:border-warn/60 bg-warn/5 text-warn',
  accent: 'border-accent/30 hover:border-accent/60 bg-accent/5 text-accent',
  'data-negative':
    'border-data-negative/30 hover:border-data-negative/60 bg-data-negative/5 text-data-negative',
} as const

function Tile({
  icon: Icon,
  label,
  color,
  href,
  onClick,
  active,
}: {
  icon: LucideIcon
  label: string
  color: keyof typeof TILE_COLORS
  href?: string
  onClick?: () => void
  active?: boolean
}) {
  const cls = cn(
    'group flex flex-col items-center justify-center gap-1 p-3 rounded-lg border transition-all text-center',
    TILE_COLORS[color],
    active && 'ring-1 ring-accent/40'
  )
  const content = (
    <>
      <Icon size={18} />
      <span className="text-[11px] font-semibold text-ink-100">{label}</span>
    </>
  )
  return href ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>
      {content}
    </a>
  ) : (
    <button type="button" onClick={onClick} className={cls}>
      {content}
    </button>
  )
}

// ============================================================================
// Cartes outils externes (yourdigitalrights, justdeleteme)
// ============================================================================

function ExternalToolCard({
  icon: Icon,
  title,
  subtitle,
  desc,
  color,
  url,
}: {
  icon: LucideIcon
  title: string
  subtitle: string
  desc: string
  color: 'accent' | 'info'
  url: string
}) {
  const colors =
    color === 'accent'
      ? 'border-accent/30 hover:border-accent/60 bg-accent/5'
      : 'border-info/30 hover:border-info/60 bg-info/5'
  const iconColor = color === 'accent' ? 'text-accent' : 'text-info'
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'flex items-start gap-3 p-3 rounded-lg border transition-all',
        colors
      )}
    >
      <div
        className={cn(
          'w-9 h-9 rounded-lg border flex items-center justify-center shrink-0',
          color === 'accent'
            ? 'bg-accent/15 border-accent/40'
            : 'bg-info/15 border-info/40'
        )}
      >
        <Icon size={16} className={iconColor} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-sm font-semibold text-ink-100">{title}</span>
          <ExternalLink size={10} className="text-ink-500" />
        </div>
        <div className="text-[10px] font-mono text-ink-500 mb-1">{subtitle}</div>
        <p className="text-[11px] text-ink-400 leading-relaxed">{desc}</p>
      </div>
    </a>
  )
}

// ============================================================================
// Quick opt-outs liste compacte (6 brokers verifies)
// ============================================================================

const STORAGE_KEY = 'hub:databrokers:checked-v2'

function QuickOptOutsList() {
  const [checked, setChecked] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set()
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      return raw ? new Set(JSON.parse(raw) as string[]) : new Set()
    } catch {
      return new Set()
    }
  })

  function toggleOne(name: string) {
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(next)))
      } catch {
        /* ignore */
      }
      return next
    })
  }

  const done = checked.size
  const total = QUICK_OPTOUTS.length

  return (
    <div className="ga-card p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-ink-200">
          Opt-out direct · top 6 brokers
        </span>
        <span className="text-[10px] font-mono text-ink-500">
          {done}/{total}
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
        {QUICK_OPTOUTS.map((b) => {
          const isDone = checked.has(b.name)
          return (
            <div
              key={b.name}
              className={cn(
                'flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-ink-800/40 transition-colors',
                isDone && 'opacity-50'
              )}
            >
              <button
                type="button"
                onClick={() => toggleOne(b.name)}
                className={cn(
                  'w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition-colors',
                  isDone
                    ? 'bg-data-positive border-data-positive'
                    : 'border-ink-600 hover:border-ink-400'
                )}
                aria-label={isDone ? 'Décocher' : 'Cocher'}
              >
                {isDone && <Check size={9} className="text-ink-950" />}
              </button>
              <span
                className={cn(
                  'text-[11px] flex-1 truncate',
                  isDone ? 'line-through text-ink-500' : 'text-ink-300'
                )}
              >
                {b.name}
              </span>
              <a
                href={b.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-ink-500 hover:text-accent transition-colors shrink-0"
                aria-label={`Opt-out ${b.name}`}
              >
                <ExternalLink size={11} />
              </a>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ============================================================================
// Loi 25 panel (compact, modele copiable)
// ============================================================================

const LOI25_TEMPLATE = `Objet : Demande Loi 25 / PIPEDA

Bonjour,

En vertu de la Loi 25 (QC) et de la PIPEDA (CA), je demande :
1. Toutes mes infos personnelles que vous détenez.
2. À qui vous les avez communiquées.
3. Suppression définitive (sauf obligation légale).

Nom : [TON NOM]
Courriel : [TON@EMAIL.COM]

Réponse sous 30 jours.

Cordialement,`

function Loi25Panel({ onClose }: { onClose: () => void }) {
  const [copied, setCopied] = useState(false)
  async function copy() {
    try {
      await navigator.clipboard.writeText(LOI25_TEMPLATE)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* ignore */
    }
  }
  return (
    <PanelWrap icon={ShieldOff} title="Loi 25 / PIPEDA" color="accent" onClose={onClose}>
      <div className="flex items-center gap-2 mb-2">
        <p className="text-[11px] text-ink-400 flex-1">
          Toute entreprise CA doit supprimer sur demande
        </p>
        <button
          type="button"
          onClick={copy}
          className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] bg-ink-800 hover:bg-ink-700 text-ink-300 transition-colors shrink-0"
        >
          {copied ? <Check size={10} /> : <Copy size={10} />}
          {copied ? 'Copié' : 'Copier'}
        </button>
      </div>
      <pre className="text-[10px] font-mono bg-ink-900 border border-ink-700 rounded p-2 text-ink-300 whitespace-pre-wrap leading-relaxed max-h-44 overflow-y-auto">
        {LOI25_TEMPLATE}
      </pre>
    </PanelWrap>
  )
}

// ============================================================================
// OSINT panel (3 tools, lignes compactes)
// ============================================================================

interface OsintTool {
  name: string
  oneLiner: string
  cmd: string
  url: string
}

const OSINT_TOOLS: OsintTool[] = [
  {
    name: 'SpiderFoot',
    oneLiner: 'Scan OSINT 200+ modules',
    cmd: 'pip install spiderfoot && sf -l 127.0.0.1:5001',
    url: 'https://github.com/smicallef/spiderfoot',
  },
  {
    name: 'Holehe',
    oneLiner: 'Email sur 120+ services',
    cmd: 'pip install holehe && holehe ton@email.com',
    url: 'https://github.com/megadose/holehe',
  },
  {
    name: 'Sherlock',
    oneLiner: 'Username sur 400+ réseaux',
    cmd: 'pip install sherlock-project && sherlock username',
    url: 'https://github.com/sherlock-project/sherlock',
  },
]

function OsintPanel({ onClose }: { onClose: () => void }) {
  return (
    <PanelWrap icon={Server} title="Outils OSINT" color="data-negative" onClose={onClose}>
      <div className="space-y-1">
        {OSINT_TOOLS.map((t) => (
          <OsintRow key={t.name} tool={t} />
        ))}
      </div>
    </PanelWrap>
  )
}

function OsintRow({ tool }: { tool: OsintTool }) {
  const [copied, setCopied] = useState(false)
  async function copy() {
    try {
      await navigator.clipboard.writeText(tool.cmd)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* ignore */
    }
  }
  return (
    <div className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-ink-800/40">
      <div className="flex-1 min-w-0">
        <div className="text-xs font-semibold text-ink-100">{tool.name}</div>
        <div className="text-[10px] text-ink-500 truncate">{tool.oneLiner}</div>
      </div>
      <button
        type="button"
        onClick={copy}
        title="Copier commande"
        className="inline-flex items-center justify-center w-6 h-6 rounded text-ink-400 hover:text-accent transition-colors"
      >
        {copied ? <Check size={11} /> : <Copy size={11} />}
      </button>
      <a
        href={tool.url}
        target="_blank"
        rel="noopener noreferrer"
        title="GitHub"
        className="inline-flex items-center justify-center w-6 h-6 rounded text-ink-400 hover:text-ink-100 transition-colors"
      >
        <Github size={11} />
      </a>
    </div>
  )
}

// ============================================================================
// Helper - Panel wrapper
// ============================================================================

function PanelWrap({
  icon: Icon,
  title,
  color,
  children,
  onClose,
}: {
  icon: LucideIcon
  title: string
  color: 'accent' | 'data-negative' | 'info' | 'warn'
  children: React.ReactNode
  onClose: () => void
}) {
  const colorMap = {
    accent: 'border-accent/30 bg-accent/5',
    'data-negative': 'border-data-negative/30 bg-data-negative/5',
    info: 'border-info/30 bg-info/5',
    warn: 'border-warn/30 bg-warn/5',
  }
  const iconMap = {
    accent: 'text-accent',
    'data-negative': 'text-data-negative',
    info: 'text-info',
    warn: 'text-warn',
  }
  return (
    <div className={cn('rounded-lg border p-3', colorMap[color])}>
      <div className="flex items-center gap-2 mb-2">
        <Icon size={13} className={iconMap[color]} />
        <span className="text-xs font-semibold text-ink-100 flex-1">{title}</span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer"
          className="inline-flex items-center justify-center w-5 h-5 rounded text-ink-400 hover:text-ink-100 transition-colors"
        >
          <X size={11} />
        </button>
      </div>
      {children}
    </div>
  )
}
