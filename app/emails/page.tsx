'use client'

/**
 * /emails - Gmail avec filtres avancés + tri + couleurs par label.
 */

import { Sidebar } from '@/components/sidebar'
import { HubStatus } from '@/components/hub-status'
import {
  Mail,
  RefreshCw,
  Search,
  Paperclip,
  Inbox,
  AlertCircle,
  Loader2,
  X,
  ChevronRight,
  ExternalLink,
  Star,
  Filter,
  Calendar,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import useSWR, { mutate as swrMutate } from 'swr'
import {
  api,
  ApiError,
  type EmailListItem,
  type EmailDetail,
  type EmailStatsResponse,
} from '@/lib/api'
import { toast } from '@/lib/toast'
import { cn, formatRelative } from '@/lib/utils'

const LABEL_COLORS: Record<string, { bg: string; fg: string; label: string }> = {
  INBOX: { bg: 'bg-info/15', fg: 'text-info', label: 'Inbox' },
  IMPORTANT: { bg: 'bg-warn/15', fg: 'text-warn', label: 'Important' },
  STARRED: { bg: 'bg-warn/15', fg: 'text-warn', label: 'Étoilé' },
  SENT: { bg: 'bg-data-positive/15', fg: 'text-data-positive', label: 'Envoyé' },
  DRAFT: { bg: 'bg-ink-700', fg: 'text-ink-300', label: 'Brouillon' },
  TRASH: { bg: 'bg-data-negative/15', fg: 'text-data-negative', label: 'Corbeille' },
  SPAM: { bg: 'bg-data-negative/15', fg: 'text-data-negative', label: 'Spam' },
  UNREAD: { bg: 'bg-accent/15', fg: 'text-accent', label: 'Non lu' },
  CATEGORY_PERSONAL: { bg: 'bg-accent/15', fg: 'text-accent', label: 'Perso' },
  CATEGORY_SOCIAL: { bg: 'bg-info/15', fg: 'text-info', label: 'Social' },
  CATEGORY_PROMOTIONS: { bg: 'bg-warn/15', fg: 'text-warn', label: 'Promo' },
  CATEGORY_UPDATES: { bg: 'bg-data-negative/15', fg: 'text-data-negative', label: 'Notifications' },
  CATEGORY_FORUMS: { bg: 'bg-purple-500/15', fg: 'text-purple-400', label: 'Forums' },
}

// Couleur déterministe par sender_email pour la colonne gauche
function senderColor(email: string): string {
  const COLORS = ['#5cdb95', '#5b8def', '#f0a050', '#a78bfa', '#06b6d4', '#ec4899', '#f06363', '#84cc16']
  let h = 0
  for (let i = 0; i < email.length; i++) h = (h * 31 + email.charCodeAt(i)) >>> 0
  return COLORS[h % COLORS.length]
}

type SortField = 'date_desc' | 'date_asc' | 'sender' | 'subject'

const PRIMARY_LABELS = [
  'INBOX',
  'IMPORTANT',
  'STARRED',
  'UNREAD',
  'SENT',
  'CATEGORY_PERSONAL',
  'CATEGORY_SOCIAL',
  'CATEGORY_PROMOTIONS',
  'CATEGORY_UPDATES',
]

export default function EmailsPage() {
  const [search, setSearch] = useState('')
  const [senderFilter, setSenderFilter] = useState<string | null>(null)
  const [labelFilter, setLabelFilter] = useState<string | null>(null)
  const [hasAttachment, setHasAttachment] = useState<boolean | null>(null)
  const [isUnread, setIsUnread] = useState<boolean | null>(null)
  const [since, setSince] = useState<string>('')
  const [until, setUntil] = useState<string>('')
  const [sort, setSort] = useState<SortField>('date_desc')
  const [showFilters, setShowFilters] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)

  const filters = useMemo(
    () => ({
      q: search.trim() || undefined,
      sender_email: senderFilter ?? undefined,
      label: labelFilter ?? undefined,
      is_unread: isUnread ?? undefined,
      since: since ? new Date(since).toISOString() : undefined,
      until: until ? new Date(until + 'T23:59:59').toISOString() : undefined,
      limit: 200,
    }),
    [search, senderFilter, labelFilter, isUnread, since, until]
  )

  const { data: emails } = useSWR(
    ['emails', filters],
    () => api.emails.list(filters),
    { refreshInterval: 0 }
  )

  const { data: stats } = useSWR<EmailStatsResponse>('emails-stats', () => api.emails.stats())

  // Filtre + sort cote front (has_attachment + sort)
  const visible = useMemo(() => {
    if (!emails) return []
    let list = emails
    if (hasAttachment !== null) {
      list = list.filter((e) => e.has_attachments === hasAttachment)
    }
    const sorted = [...list]
    switch (sort) {
      case 'date_asc':
        sorted.sort((a, b) => +new Date(a.sent_at) - +new Date(b.sent_at))
        break
      case 'sender':
        sorted.sort((a, b) => a.sender_email.localeCompare(b.sender_email))
        break
      case 'subject':
        sorted.sort((a, b) => (a.subject ?? '').localeCompare(b.subject ?? ''))
        break
      default:
        sorted.sort((a, b) => +new Date(b.sent_at) - +new Date(a.sent_at))
    }
    return sorted
  }, [emails, hasAttachment, sort])

  async function handleSync() {
    setSyncing(true)
    try {
      const res = await api.emails.sync({ max_results: 200, since_days: 30 })
      toast.success(
        `Sync OK · ${res.ingested} nouveaux, ${res.updated} màj, ${res.errors} erreurs`,
        { description: `Durée : ${res.duration_seconds}s` }
      )
      void swrMutate('emails-stats')
      void swrMutate(['emails', filters])
    } catch (err) {
      toast.apiError(err, 'Sync Gmail échoué')
    } finally {
      setSyncing(false)
    }
  }

  function clearAllFilters() {
    setSearch('')
    setSenderFilter(null)
    setLabelFilter(null)
    setHasAttachment(null)
    setIsUnread(null)
    setSince('')
    setUntil('')
  }

  const activeFiltersCount = [
    search,
    senderFilter,
    labelFilter,
    hasAttachment !== null,
    isUnread !== null,
    since,
    until,
  ].filter(Boolean).length

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 px-4 sm:px-6 lg:px-8 pt-16 lg:pt-6 pb-6 max-w-[1400px] flex flex-col">
        <header className="mb-3 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Emails</h1>
            <p className="text-xs text-ink-400">
              {stats
                ? `${stats.total} emails · ${stats.unread} non lus · ${stats.with_attachments} avec PJ`
                : '…'}
            </p>
          </div>
          <button
            type="button"
            onClick={handleSync}
            disabled={syncing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-accent text-ink-950 text-xs font-semibold hover:bg-accent-light disabled:opacity-50"
          >
            {syncing ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
            {syncing ? 'Sync…' : 'Sync Gmail'}
          </button>
        </header>

        {/* Top labels chips (filtre rapide) */}
        {stats && (
          <div className="flex flex-wrap gap-1 mb-2">
            {PRIMARY_LABELS.map((lbl) => {
              const meta = LABEL_COLORS[lbl]
              if (!meta) return null
              const active = labelFilter === lbl
              return (
                <button
                  key={lbl}
                  type="button"
                  onClick={() => setLabelFilter(active ? null : lbl)}
                  className={cn(
                    'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] border font-medium transition-colors',
                    active
                      ? `${meta.bg} ${meta.fg} border-current`
                      : 'bg-ink-800 border-ink-700 text-ink-400 hover:text-ink-200'
                  )}
                >
                  {meta.label}
                </button>
              )
            })}
          </div>
        )}

        {/* Search + sort + filter toggle */}
        <div className="flex items-center gap-2 mb-2">
          <div className="relative flex-1">
            <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-ink-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Recherche dans subject + snippet…"
              className="w-full bg-ink-800 border border-ink-700 rounded-md pl-7 pr-2 py-1.5 text-xs focus:outline-none focus:border-accent/60"
            />
          </div>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortField)}
            className="bg-ink-800 border border-ink-700 rounded-md px-2 py-1.5 text-xs"
          >
            <option value="date_desc">Date ↓</option>
            <option value="date_asc">Date ↑</option>
            <option value="sender">Expéditeur</option>
            <option value="subject">Sujet</option>
          </select>
          <button
            type="button"
            onClick={() => setShowFilters((v) => !v)}
            className={cn(
              'inline-flex items-center gap-1 px-2 py-1.5 rounded-md text-xs border',
              showFilters || activeFiltersCount > 0
                ? 'bg-accent/15 border-accent/30 text-accent'
                : 'bg-ink-800 border-ink-700 text-ink-300'
            )}
          >
            <Filter size={11} />
            Filtres {activeFiltersCount > 0 && `(${activeFiltersCount})`}
          </button>
        </div>

        {/* Filter panel */}
        {showFilters && (
          <div className="ga-card p-3 mb-3 space-y-2">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div>
                <label className="text-[10px] uppercase tracking-wider text-ink-500 mb-1 block">
                  Depuis
                </label>
                <input
                  type="date"
                  value={since}
                  onChange={(e) => setSince(e.target.value)}
                  className="w-full bg-ink-800 border border-ink-700 rounded px-1.5 py-1 text-xs"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-ink-500 mb-1 block">
                  Jusqu&apos;à
                </label>
                <input
                  type="date"
                  value={until}
                  onChange={(e) => setUntil(e.target.value)}
                  className="w-full bg-ink-800 border border-ink-700 rounded px-1.5 py-1 text-xs"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-ink-500 mb-1 block">
                  Sender
                </label>
                <input
                  type="text"
                  value={senderFilter ?? ''}
                  onChange={(e) => setSenderFilter(e.target.value || null)}
                  placeholder="exact email"
                  className="w-full bg-ink-800 border border-ink-700 rounded px-1.5 py-1 text-xs"
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              <ToggleChip
                label="Avec PJ"
                icon={Paperclip}
                value={hasAttachment === true}
                onClick={() => setHasAttachment(hasAttachment === true ? null : true)}
                colorClass="text-warn"
              />
              <ToggleChip
                label="Non lu"
                icon={Mail}
                value={isUnread === true}
                onClick={() => setIsUnread(isUnread === true ? null : true)}
                colorClass="text-accent"
              />
              <ToggleChip
                label="Lu"
                icon={Mail}
                value={isUnread === false}
                onClick={() => setIsUnread(isUnread === false ? null : false)}
                colorClass="text-ink-400"
              />
              {activeFiltersCount > 0 && (
                <button
                  type="button"
                  onClick={clearAllFilters}
                  className="ml-auto px-2 py-1 text-[11px] text-ink-400 hover:text-data-negative"
                >
                  Effacer tout
                </button>
              )}
            </div>
          </div>
        )}

        {/* Top senders chips si pas de filter sender actif */}
        {stats && stats.top_senders.length > 0 && !senderFilter && (
          <div className="ga-card p-2 mb-3">
            <div className="flex flex-wrap gap-1">
              {stats.top_senders.slice(0, 8).map((s) => (
                <button
                  key={s.sender_email}
                  type="button"
                  onClick={() => setSenderFilter(s.sender_email)}
                  className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] bg-ink-800 hover:bg-ink-700 border border-ink-700"
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ background: senderColor(s.sender_email) }}
                  />
                  <span className="text-ink-300 truncate max-w-[160px]">{s.sender_email}</span>
                  <span className="font-mono text-[10px] text-ink-500">{s.count}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        {senderFilter && (
          <div className="ga-card p-2 mb-3 flex items-center gap-2">
            <span className="text-xs text-ink-400">Filtrage par :</span>
            <span
              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] bg-accent/15 text-accent border border-accent/30"
            >
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: senderColor(senderFilter) }}
              />
              {senderFilter}
              <button onClick={() => setSenderFilter(null)} className="ml-1">
                <X size={10} />
              </button>
            </span>
          </div>
        )}

        {/* List */}
        <div className="flex-1 min-h-0">
          <div className="text-[10px] font-mono text-ink-500 mb-1">
            {visible.length} emails affichés
          </div>
          {visible.length === 0 ? (
            <div className="ga-card p-6 text-center">
              <Inbox size={24} className="text-ink-500 mx-auto mb-2" />
              <div className="text-sm text-ink-300">Aucun email</div>
              <p className="text-xs text-ink-500 mt-1">
                {activeFiltersCount > 0 ? 'Aucun match avec ces filtres' : 'Click "Sync Gmail"'}
              </p>
            </div>
          ) : (
            <div className="ga-card overflow-hidden">
              <div className="divide-y divide-ink-700/30 max-h-[60vh] overflow-y-auto">
                {visible.map((e) => (
                  <EmailRow key={e.id} email={e} onClick={() => setSelectedId(e.id)} />
                ))}
              </div>
            </div>
          )}
        </div>

        {selectedId && <EmailDetailModal id={selectedId} onClose={() => setSelectedId(null)} />}

        <div className="mt-3">
          <HubStatus />
        </div>
      </main>
    </div>
  )
}

function ToggleChip({
  label,
  icon: Icon,
  value,
  onClick,
  colorClass,
}: {
  label: string
  icon: typeof Mail
  value: boolean
  onClick: () => void
  colorClass: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] border transition-colors',
        value
          ? `bg-accent/15 border-accent/30 text-accent`
          : 'bg-ink-800 border-ink-700 text-ink-400 hover:text-ink-200'
      )}
    >
      <Icon size={10} className={value ? 'text-accent' : colorClass} />
      {label}
    </button>
  )
}

function EmailRow({ email, onClick }: { email: EmailListItem; onClick: () => void }) {
  const senderCol = senderColor(email.sender_email)
  // Show 1-2 primary labels with color
  const primaryLabels = email.labels
    .filter((l) => l in LABEL_COLORS && l !== 'UNREAD' && l !== 'INBOX')
    .slice(0, 2)
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-3 px-3 py-2 hover:bg-ink-800/40 text-left transition-colors',
        email.is_unread && 'bg-ink-800/20'
      )}
    >
      <div
        className="shrink-0 w-1 self-stretch rounded"
        style={{ background: senderCol }}
      />
      <div
        className="shrink-0 w-1.5 h-1.5 rounded-full bg-accent"
        style={{ visibility: email.is_unread ? 'visible' : 'hidden' }}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span
            className={cn(
              'text-sm truncate min-w-0',
              email.is_unread ? 'font-semibold text-ink-100' : 'text-ink-300'
            )}
          >
            {email.sender_email}
          </span>
          <span className="text-[10px] font-mono text-ink-500 shrink-0">
            {formatRelative(email.sent_at)}
          </span>
          {primaryLabels.map((l) => {
            const m = LABEL_COLORS[l]
            return (
              <span
                key={l}
                className={cn('inline-flex px-1 py-0 rounded text-[9px] font-mono', m.bg, m.fg)}
              >
                {m.label}
              </span>
            )
          })}
        </div>
        <div className="text-xs text-ink-400 truncate">
          {email.subject || <em className="text-ink-600">(sans sujet)</em>}
        </div>
        {email.snippet && (
          <div className="text-[11px] text-ink-500 truncate mt-0.5">{email.snippet}</div>
        )}
      </div>
      {email.has_attachments && <Paperclip size={11} className="text-warn shrink-0" />}
      {email.labels.includes('STARRED') && <Star size={10} className="text-warn shrink-0" />}
      <ChevronRight size={12} className="text-ink-500 shrink-0" />
    </button>
  )
}

function EmailDetailModal({ id, onClose }: { id: string; onClose: () => void }) {
  const [email, setEmail] = useState<EmailDetail | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    api.emails
      .get(id)
      .then((e) => {
        if (!cancelled) setEmail(e)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : String(err))
      })
    return () => {
      cancelled = true
    }
  }, [id])

  return (
    <div
      className="fixed inset-0 z-50 bg-ink-950/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="ga-card max-w-3xl w-full max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 p-4 border-b border-ink-700/50 sticky top-0 bg-ink-900/95 backdrop-blur">
          <div className="flex-1 min-w-0">
            {email ? (
              <>
                <h2 className="text-base font-semibold text-ink-100 truncate">
                  {email.subject || '(sans sujet)'}
                </h2>
                <div className="text-xs text-ink-400 mt-0.5 truncate">
                  De : <span className="text-ink-200">{email.sender}</span>
                </div>
                <div className="text-[11px] text-ink-500 font-mono mt-0.5 flex items-center gap-2">
                  <Calendar size={10} />
                  {new Date(email.sent_at).toLocaleString('fr-CA')}
                </div>
              </>
            ) : (
              <div className="text-sm text-ink-400">Chargement…</div>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center w-8 h-8 rounded-md text-ink-400 hover:text-ink-100 hover:bg-ink-800"
          >
            <X size={14} />
          </button>
        </div>
        <div className="p-4">
          {error && <div className="text-sm text-data-negative">{error}</div>}
          {email && (
            <>
              {email.recipients.length > 0 && (
                <div className="text-[11px] text-ink-500 mb-3">
                  À : {email.recipients.join(', ')}
                </div>
              )}
              {email.labels.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-3">
                  {email.labels.slice(0, 8).map((l) => {
                    const m = LABEL_COLORS[l]
                    if (m) {
                      return (
                        <span
                          key={l}
                          className={cn(
                            'text-[10px] font-mono px-1.5 py-0.5 rounded',
                            m.bg,
                            m.fg
                          )}
                        >
                          {m.label}
                        </span>
                      )
                    }
                    return (
                      <span
                        key={l}
                        className="text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-ink-800 text-ink-400 border border-ink-700"
                      >
                        {l}
                      </span>
                    )
                  })}
                </div>
              )}
              {email.body_text ? (
                <pre className="text-xs text-ink-300 whitespace-pre-wrap font-sans leading-relaxed">
                  {email.body_text}
                </pre>
              ) : email.body_html ? (
                <div className="text-xs text-ink-400 italic">
                  (Contenu HTML uniquement, voir{' '}
                  <a
                    href={`https://mail.google.com/mail/u/0/#inbox/${email.gmail_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent hover:text-accent-light inline-flex items-center gap-1"
                  >
                    sur Gmail
                    <ExternalLink size={10} />
                  </a>
                  )
                </div>
              ) : (
                <div className="text-xs text-ink-500 italic">{email.snippet}</div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
