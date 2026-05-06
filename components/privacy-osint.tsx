'use client'

/**
 * PrivacyOsint - vue ultra epuree.
 * Plutot que reinventer la roue (URLs qui changent, opt-outs introuvables),
 * on pointe vers 2 outils tiers maintenus :
 *  - yourdigitalrights.org : request RGPD/PIPEDA pour ANY company (100k+ requests)
 *  - justdeleteme.xyz : directory de suppression de compte pour 500+ services
 * Plus 6 quick-links opt-out verifies pour les data brokers majeurs.
 */

import { useState, useEffect } from 'react'
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
  Loader2,
  Play,
  AlertTriangle,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { api, ApiError, getBaseUrl, type OsintScanResponse } from '@/lib/api'

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

interface RemovalReq {
  id: string
  company_name: string
  company_email: string | null
  company_url: string | null
  request_type: string
  legal_basis: string
  status: string
  subject: string | null
  body: string | null
  notes: string | null
  created_at: string
  sent_at: string | null
  deadline_at: string | null
  resolved_at: string | null
  days_until_deadline: number | null
}

interface RemovalSummary {
  total: number
  draft: number
  sent: number
  overdue: number
  resolved: number
  refused: number
}

function Loi25Panel({ onClose }: { onClose: () => void }) {
  const [requests, setRequests] = useState<RemovalReq[]>([])
  const [summary, setSummary] = useState<RemovalSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  async function refresh() {
    try {
      const base = getBaseUrl()
      const [r1, r2] = await Promise.all([
        fetch(`${base}/v1/privacy/requests`).then((r) => r.json()),
        fetch(`${base}/v1/privacy/summary`).then((r) => r.json()),
      ])
      setRequests(r1)
      setSummary(r2)
    } catch {
      /* ignore */
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  const selected = requests.find((r) => r.id === selectedId) ?? null

  return (
    <PanelWrap icon={ShieldOff} title="Loi 25 / PIPEDA — Tracker" color="accent" onClose={onClose}>
      {/* Summary strip */}
      {summary && (
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5 mb-3 text-[10px] font-mono">
          <SummaryDot label="Brouillons" value={summary.draft} color="text-ink-400" />
          <SummaryDot label="Envoyées" value={summary.sent} color="text-info" />
          <SummaryDot label="En retard" value={summary.overdue} color="text-data-negative" />
          <SummaryDot label="Résolues" value={summary.resolved} color="text-data-positive" />
          <SummaryDot label="Refusées" value={summary.refused} color="text-warn" />
        </div>
      )}

      <div className="flex items-center justify-between mb-2">
        <p className="text-[11px] text-ink-400">
          Toute entreprise CA doit répondre sous 30 jours.
        </p>
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] bg-accent/15 border border-accent/40 hover:bg-accent/25 text-accent transition-colors shrink-0"
        >
          + Nouvelle demande
        </button>
      </div>

      {showForm && (
        <NewRequestForm
          onClose={() => setShowForm(false)}
          onCreated={(req) => {
            setShowForm(false)
            setSelectedId(req.id)
            refresh()
          }}
        />
      )}

      {/* Liste */}
      {loading ? (
        <div className="text-center text-[10px] text-ink-500 py-3">Chargement…</div>
      ) : requests.length === 0 ? (
        <div className="text-center text-[10px] text-ink-500 py-3 border border-dashed border-ink-700 rounded">
          Aucune demande. Crée la première.
        </div>
      ) : (
        <div className="space-y-1.5 max-h-72 overflow-y-auto">
          {requests.map((r) => (
            <RequestRow
              key={r.id}
              req={r}
              expanded={selectedId === r.id}
              onToggle={() => setSelectedId(selectedId === r.id ? null : r.id)}
              onUpdate={refresh}
            />
          ))}
        </div>
      )}

      {selected && selectedId === selected.id && selected.body && (
        <RequestEmailPreview req={selected} />
      )}
    </PanelWrap>
  )
}

function SummaryDot({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex flex-col items-center bg-ink-900 border border-ink-700/60 rounded px-1.5 py-1">
      <span className={cn('font-bold text-sm tabular-nums', color)}>{value}</span>
      <span className="text-[9px] text-ink-500 truncate">{label}</span>
    </div>
  )
}

function NewRequestForm({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: (req: RemovalReq) => void
}) {
  const [companyName, setCompanyName] = useState('')
  const [companyEmail, setCompanyEmail] = useState('')
  const [requestType, setRequestType] = useState('deletion')
  const [legalBasis, setLegalBasis] = useState('loi25')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    if (!companyName.trim()) return
    setBusy(true)
    setError(null)
    try {
      const resp = await fetch(`${getBaseUrl()}/v1/privacy/requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_name: companyName.trim(),
          company_email: companyEmail.trim() || undefined,
          request_type: requestType,
          legal_basis: legalBasis,
        }),
      })
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      const r: RemovalReq = await resp.json()
      onCreated(r)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="bg-ink-900 border border-accent/30 rounded p-2 mb-2 space-y-1.5">
      <input
        type="text"
        placeholder="Entreprise (ex: Spokeo, Acxiom)"
        value={companyName}
        onChange={(e) => setCompanyName(e.target.value)}
        className="w-full bg-ink-800 border border-ink-700 rounded px-2 py-1 text-xs"
      />
      <input
        type="email"
        placeholder="Email contact (optionnel)"
        value={companyEmail}
        onChange={(e) => setCompanyEmail(e.target.value)}
        className="w-full bg-ink-800 border border-ink-700 rounded px-2 py-1 text-xs"
      />
      <div className="grid grid-cols-2 gap-1.5">
        <select
          value={requestType}
          onChange={(e) => setRequestType(e.target.value)}
          className="bg-ink-800 border border-ink-700 rounded px-2 py-1 text-xs"
        >
          <option value="deletion">Suppression</option>
          <option value="access">Accès</option>
          <option value="rectification">Rectification</option>
        </select>
        <select
          value={legalBasis}
          onChange={(e) => setLegalBasis(e.target.value)}
          className="bg-ink-800 border border-ink-700 rounded px-2 py-1 text-xs"
        >
          <option value="loi25">Loi 25 (QC)</option>
          <option value="pipeda">PIPEDA (CA)</option>
          <option value="gdpr">RGPD (UE)</option>
          <option value="other">Autre</option>
        </select>
      </div>
      {error && <div className="text-[10px] text-red-400">{error}</div>}
      <div className="flex gap-1.5">
        <button
          type="button"
          onClick={submit}
          disabled={busy || !companyName.trim()}
          className="flex-1 px-2 py-1 rounded text-[10px] bg-accent/20 border border-accent/40 text-accent hover:bg-accent/30 disabled:opacity-40"
        >
          {busy ? 'Création…' : 'Créer la demande'}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="px-2 py-1 rounded text-[10px] bg-ink-800 border border-ink-700 text-ink-400 hover:text-ink-200"
        >
          Annuler
        </button>
      </div>
    </div>
  )
}

function RequestRow({
  req,
  expanded,
  onToggle,
  onUpdate,
}: {
  req: RemovalReq
  expanded: boolean
  onToggle: () => void
  onUpdate: () => void
}) {
  const [busy, setBusy] = useState(false)

  async function changeStatus(status: string) {
    setBusy(true)
    try {
      const resp = await fetch(`${getBaseUrl()}/v1/privacy/requests/${req.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      onUpdate()
    } catch {
      /* ignore */
    } finally {
      setBusy(false)
    }
  }

  async function deleteReq() {
    if (!confirm(`Supprimer la demande ${req.company_name} ?`)) return
    setBusy(true)
    try {
      const resp = await fetch(`${getBaseUrl()}/v1/privacy/requests/${req.id}`, { method: 'DELETE' })
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      onUpdate()
    } catch {
      /* ignore */
    } finally {
      setBusy(false)
    }
  }

  const statusStyles: Record<string, string> = {
    draft: 'border-ink-700 text-ink-400',
    sent: 'border-info/40 text-info',
    acknowledged: 'border-warn/40 text-warn',
    data_deleted: 'border-data-positive/40 text-data-positive',
    refused: 'border-data-negative/40 text-data-negative',
    expired: 'border-data-negative/60 text-data-negative',
  }

  const overdue =
    req.status === 'sent' &&
    req.days_until_deadline !== null &&
    req.days_until_deadline < 0

  return (
    <div
      className={cn(
        'border rounded text-[11px] transition-colors',
        statusStyles[req.status] ?? 'border-ink-700 text-ink-400',
        overdue && 'ring-1 ring-data-negative/50',
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-2 py-1.5 text-left hover:bg-ink-800/40 transition-colors"
      >
        <span className="font-mono text-[9px] uppercase tracking-wider shrink-0 w-16 truncate">
          {req.status}
        </span>
        <span className="font-semibold text-ink-200 truncate flex-1">{req.company_name}</span>
        {overdue && (
          <span className="font-mono text-[9px] text-data-negative shrink-0">
            +{Math.abs(req.days_until_deadline!)}j retard
          </span>
        )}
        {!overdue && req.days_until_deadline !== null && req.status === 'sent' && (
          <span className="font-mono text-[9px] text-ink-500 shrink-0">
            J-{req.days_until_deadline}
          </span>
        )}
      </button>

      {expanded && (
        <div className="border-t border-ink-700/40 p-2 space-y-1.5 bg-ink-900/40">
          <div className="grid grid-cols-2 gap-2 text-[10px]">
            <div>
              <span className="text-ink-500">Type :</span>{' '}
              <span className="text-ink-300">{req.request_type}</span>
            </div>
            <div>
              <span className="text-ink-500">Loi :</span>{' '}
              <span className="text-ink-300">{req.legal_basis}</span>
            </div>
            <div>
              <span className="text-ink-500">Créée :</span>{' '}
              <span className="text-ink-300 font-mono">
                {new Date(req.created_at).toLocaleDateString('fr-CA')}
              </span>
            </div>
            {req.sent_at && (
              <div>
                <span className="text-ink-500">Envoyée :</span>{' '}
                <span className="text-ink-300 font-mono">
                  {new Date(req.sent_at).toLocaleDateString('fr-CA')}
                </span>
              </div>
            )}
            {req.deadline_at && (
              <div className="col-span-2">
                <span className="text-ink-500">Échéance :</span>{' '}
                <span className="text-ink-300 font-mono">
                  {new Date(req.deadline_at).toLocaleDateString('fr-CA')}
                </span>
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-1 pt-1">
            {req.status === 'draft' && (
              <button
                type="button"
                onClick={() => changeStatus('sent')}
                disabled={busy}
                className="px-2 py-0.5 rounded text-[10px] bg-info/15 border border-info/40 text-info hover:bg-info/25 disabled:opacity-40"
              >
                Marquer envoyée
              </button>
            )}
            {req.status === 'sent' && (
              <>
                <button
                  type="button"
                  onClick={() => changeStatus('acknowledged')}
                  disabled={busy}
                  className="px-2 py-0.5 rounded text-[10px] bg-warn/15 border border-warn/40 text-warn hover:bg-warn/25 disabled:opacity-40"
                >
                  Accusé reçu
                </button>
                <button
                  type="button"
                  onClick={() => changeStatus('data_deleted')}
                  disabled={busy}
                  className="px-2 py-0.5 rounded text-[10px] bg-data-positive/15 border border-data-positive/40 text-data-positive hover:bg-data-positive/25 disabled:opacity-40"
                >
                  Données supprimées
                </button>
                <button
                  type="button"
                  onClick={() => changeStatus('refused')}
                  disabled={busy}
                  className="px-2 py-0.5 rounded text-[10px] bg-data-negative/15 border border-data-negative/40 text-data-negative hover:bg-data-negative/25 disabled:opacity-40"
                >
                  Refusée
                </button>
              </>
            )}
            <button
              type="button"
              onClick={deleteReq}
              disabled={busy}
              className="ml-auto px-2 py-0.5 rounded text-[10px] bg-ink-800 border border-ink-700 text-ink-500 hover:text-data-negative hover:border-data-negative/40 disabled:opacity-40"
            >
              <Trash2 size={10} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function RequestEmailPreview({ req }: { req: RemovalReq }) {
  const [copied, setCopied] = useState(false)
  async function copy() {
    try {
      await navigator.clipboard.writeText(`${req.subject ?? ''}\n\n${req.body ?? ''}`)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* ignore */
    }
  }
  return (
    <div className="mt-2 border border-ink-700/40 rounded bg-ink-900/40 p-2">
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-[10px] text-ink-400 font-mono flex-1 truncate">
          Email pour {req.company_name}
        </span>
        <button
          type="button"
          onClick={copy}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-ink-800 hover:bg-ink-700 text-ink-300 transition-colors shrink-0"
        >
          {copied ? <Check size={10} /> : <Copy size={10} />}
          {copied ? 'Copié' : 'Copier'}
        </button>
      </div>
      <pre className="text-[10px] font-mono bg-ink-950 border border-ink-700 rounded p-2 text-ink-300 whitespace-pre-wrap leading-relaxed max-h-44 overflow-y-auto">
        {req.subject}{'\n\n'}{req.body}
      </pre>
    </div>
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
      <LiveOsintScanner />
      <div className="mt-3 pt-3 border-t border-ink-700/50">
        <div className="text-[10px] font-mono text-ink-500 uppercase tracking-wider mb-2">
          Aussi en CLI
        </div>
        <div className="space-y-1">
          {OSINT_TOOLS.map((t) => (
            <OsintRow key={t.name} tool={t} />
          ))}
        </div>
      </div>
    </PanelWrap>
  )
}

function LiveOsintScanner() {
  const [status, setStatus] = useState<{ holehe: boolean; sherlock: boolean } | null>(null)
  const [tool, setTool] = useState<'holehe' | 'sherlock'>('holehe')
  const [input, setInput] = useState('')
  const [scanning, setScanning] = useState(false)
  const [result, setResult] = useState<OsintScanResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    api.osint
      .status()
      .then((s) => {
        if (!cancelled) setStatus({ holehe: s.holehe_installed, sherlock: s.sherlock_installed })
      })
      .catch(() => {
        if (!cancelled) setStatus({ holehe: false, sherlock: false })
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function runScan() {
    if (!input.trim()) return
    setScanning(true)
    setError(null)
    setResult(null)
    try {
      const res =
        tool === 'holehe'
          ? await api.osint.holehe(input.trim())
          : await api.osint.sherlock(input.trim())
      setResult(res)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err))
    } finally {
      setScanning(false)
    }
  }

  if (!status) {
    return (
      <div className="flex items-center gap-2 text-xs text-ink-400">
        <Loader2 size={11} className="animate-spin" />
        Vérif des outils installés…
      </div>
    )
  }

  if (!status.holehe && !status.sherlock) {
    return (
      <div className="text-[11px] text-ink-400 leading-relaxed flex items-start gap-2 p-2 rounded-md border border-warn/20 bg-warn/5">
        <AlertTriangle size={11} className="text-warn shrink-0 mt-0.5" />
        <div>
          Pour scan auto, installe Holehe ou Sherlock (commandes ci-dessous).
          Une fois installés, recharge cette page.
        </div>
      </div>
    )
  }

  const placeholder = tool === 'holehe' ? 'ton@email.com' : 'ton_username'

  return (
    <div className="space-y-2">
      <div className="flex gap-1">
        <button
          type="button"
          onClick={() => {
            setTool('holehe')
            setResult(null)
            setError(null)
          }}
          disabled={!status.holehe}
          className={cn(
            'flex-1 px-2.5 py-1.5 rounded-md text-[11px] font-medium border transition-colors',
            tool === 'holehe'
              ? 'bg-accent/15 border-accent/30 text-accent'
              : 'bg-ink-800 border-ink-700 text-ink-400 hover:text-ink-200',
            !status.holehe && 'opacity-30 cursor-not-allowed'
          )}
        >
          <Mail size={10} className="inline mr-1" />
          Holehe (email)
        </button>
        <button
          type="button"
          onClick={() => {
            setTool('sherlock')
            setResult(null)
            setError(null)
          }}
          disabled={!status.sherlock}
          className={cn(
            'flex-1 px-2.5 py-1.5 rounded-md text-[11px] font-medium border transition-colors',
            tool === 'sherlock'
              ? 'bg-accent/15 border-accent/30 text-accent'
              : 'bg-ink-800 border-ink-700 text-ink-400 hover:text-ink-200',
            !status.sherlock && 'opacity-30 cursor-not-allowed'
          )}
        >
          <Globe size={10} className="inline mr-1" />
          Sherlock (username)
        </button>
      </div>

      <div className="flex gap-1">
        <input
          type={tool === 'holehe' ? 'email' : 'text'}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !scanning) {
              e.preventDefault()
              void runScan()
            }
          }}
          placeholder={placeholder}
          disabled={scanning}
          className="flex-1 bg-ink-800 border border-ink-700 rounded-md px-2 py-1.5 text-xs focus:outline-none focus:border-accent/60 disabled:opacity-50"
        />
        <button
          type="button"
          onClick={() => void runScan()}
          disabled={scanning || !input.trim()}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-accent text-ink-950 text-xs font-semibold hover:bg-accent-light transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          {scanning ? <Loader2 size={11} className="animate-spin" /> : <Play size={11} />}
          {scanning ? 'Scan…' : 'Scan'}
        </button>
      </div>

      {error && (
        <div className="text-[11px] text-data-negative bg-data-negative/5 border border-data-negative/30 rounded p-2">
          {error}
        </div>
      )}

      {result && <OsintResults result={result} />}
    </div>
  )
}

function OsintResults({ result }: { result: OsintScanResponse }) {
  const found = result.hits.filter((h) => h.status === 'found')
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-1.5 text-center">
        <Stat label="Vérifiés" value={result.total_checked} color="text-ink-300" />
        <Stat label="Trouvés" value={found.length} color="text-data-negative" />
        <Stat label="Durée" value={`${result.duration_seconds}s`} color="text-ink-400" />
      </div>
      {found.length > 0 ? (
        <div className="max-h-48 overflow-y-auto space-y-0.5 -mx-1 px-1">
          {found.map((h) => (
            <div
              key={h.service}
              className="flex items-center gap-2 px-2 py-1 rounded bg-data-negative/5 border border-data-negative/20 text-[11px]"
            >
              <span className="flex-1 truncate text-ink-200">{h.service}</span>
              {h.url && (
                <a
                  href={h.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-ink-500 hover:text-accent shrink-0"
                  title={h.url}
                >
                  <ExternalLink size={10} />
                </a>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-[11px] text-ink-500 text-center py-2">
          Aucun service trouvé pour <code className="text-ink-300">{result.target}</code>
        </div>
      )}
    </div>
  )
}

function Stat({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className="px-2 py-1 rounded bg-ink-800/40">
      <div className={cn('text-sm font-mono font-semibold', color)}>{value}</div>
      <div className="text-[9px] uppercase tracking-wider text-ink-500">{label}</div>
    </div>
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
