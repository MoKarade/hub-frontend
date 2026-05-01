'use client'

/**
 * Page /emails - liste + recherche + sync des emails Gmail.
 *
 * Workflow :
 * - Affiche stats (total, non lus, top senders, courbe par mois)
 * - Bouton "Sync" qui pull les emails recents via /v1/emails/sync
 * - Liste filtrable (sender, date, recherche texte)
 * - Click sur un email = detail (subject, body)
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

export default function EmailsPage() {
  const [search, setSearch] = useState('')
  const [senderFilter, setSenderFilter] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)

  const filters = useMemo(
    () => ({
      q: search.trim() || undefined,
      sender_email: senderFilter ?? undefined,
      limit: 100,
    }),
    [search, senderFilter]
  )

  const { data: emails, error: listError, isLoading: listLoading } = useSWR(
    ['emails', filters],
    () => api.emails.list(filters),
    { refreshInterval: 0 }
  )

  const { data: stats } = useSWR<EmailStatsResponse>('emails-stats', () => api.emails.stats())

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

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 px-4 sm:px-6 lg:px-8 pt-16 lg:pt-6 pb-6 max-w-[1400px] flex flex-col">
        <header className="mb-4 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Emails</h1>
            <p className="text-sm text-ink-400">
              Gmail synchronisé localement · indexation full-text
            </p>
          </div>
          <button
            type="button"
            onClick={handleSync}
            disabled={syncing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-accent text-ink-950 text-xs font-semibold hover:bg-accent-light transition-colors disabled:opacity-50"
          >
            {syncing ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
            {syncing ? 'Sync…' : 'Sync Gmail'}
          </button>
        </header>

        {stats && <StatsRow stats={stats} />}

        {stats && stats.top_senders.length > 0 && (
          <TopSenders
            stats={stats}
            activeFilter={senderFilter}
            onSelect={(s) => setSenderFilter(s === senderFilter ? null : s)}
          />
        )}

        <div className="mt-4 flex items-center gap-2">
          <div className="relative flex-1">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Recherche dans subject + snippet…"
              className="w-full bg-ink-800 border border-ink-700 rounded-md pl-7 pr-3 py-1.5 text-xs focus:outline-none focus:border-accent/60"
            />
          </div>
          {senderFilter && (
            <button
              type="button"
              onClick={() => setSenderFilter(null)}
              className="inline-flex items-center gap-1 px-2 py-1.5 text-[11px] rounded-md bg-accent/15 border border-accent/30 text-accent hover:bg-accent/25"
            >
              <span className="truncate max-w-[180px]">{senderFilter}</span>
              <X size={10} />
            </button>
          )}
        </div>

        <div className="mt-3 flex-1 min-h-0">
          {listError && (
            <div className="ga-card p-4 border-warn/30 bg-warn/5 flex items-start gap-3">
              <AlertCircle size={16} className="text-warn shrink-0 mt-0.5" />
              <div className="text-xs text-ink-300">
                {listError instanceof ApiError ? listError.message : String(listError)}
              </div>
            </div>
          )}
          {listLoading && (
            <div className="text-xs text-ink-500 text-center py-8">
              <Loader2 size={14} className="inline animate-spin mr-1.5" />
              Chargement…
            </div>
          )}
          {!listLoading && emails && emails.length === 0 && (
            <div className="ga-card p-6 text-center">
              <Inbox size={24} className="text-ink-500 mx-auto mb-2" />
              <div className="text-sm text-ink-300 mb-1">Aucun email</div>
              <p className="text-xs text-ink-500">
                Click sur &laquo;&nbsp;Sync Gmail&nbsp;&raquo; pour importer tes emails récents
              </p>
            </div>
          )}
          {emails && emails.length > 0 && (
            <div className="ga-card overflow-hidden">
              <div className="divide-y divide-ink-700/30 max-h-[60vh] overflow-y-auto">
                {emails.map((e) => (
                  <EmailRow key={e.id} email={e} onClick={() => setSelectedId(e.id)} />
                ))}
              </div>
            </div>
          )}
        </div>

        {selectedId && (
          <EmailDetailModal id={selectedId} onClose={() => setSelectedId(null)} />
        )}

        <div className="mt-auto pt-4">
          <HubStatus />
        </div>
      </main>
    </div>
  )
}

function StatsRow({ stats }: { stats: EmailStatsResponse }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      <Kpi label="Total" value={stats.total} icon={Mail} color="text-ink-100" />
      <Kpi label="Non lus" value={stats.unread} icon={Inbox} color="text-info" />
      <Kpi label="Avec PJ" value={stats.with_attachments} icon={Paperclip} color="text-warn" />
    </div>
  )
}

function Kpi({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string
  value: number
  icon: typeof Mail
  color: string
}) {
  return (
    <div className="ga-card p-3">
      <div className="flex items-center gap-1.5 mb-1">
        <Icon size={11} className={color} />
        <div className="metric-label">{label}</div>
      </div>
      <div className={cn('metric truncate', color)}>{value.toLocaleString('fr-CA')}</div>
    </div>
  )
}

function TopSenders({
  stats,
  activeFilter,
  onSelect,
}: {
  stats: EmailStatsResponse
  activeFilter: string | null
  onSelect: (sender: string) => void
}) {
  const top = stats.top_senders.slice(0, 8)
  return (
    <div className="ga-card p-3 mt-3">
      <div className="text-xs font-semibold text-ink-200 mb-2">Top expéditeurs</div>
      <div className="flex flex-wrap gap-1.5">
        {top.map((s) => (
          <button
            key={s.sender_email}
            type="button"
            onClick={() => onSelect(s.sender_email)}
            className={cn(
              'inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] border transition-colors',
              activeFilter === s.sender_email
                ? 'bg-accent/15 border-accent/30 text-accent'
                : 'bg-ink-800 border-ink-700 text-ink-300 hover:text-ink-100'
            )}
          >
            <span className="truncate max-w-[200px]">{s.sender_email}</span>
            <span className="font-mono text-[10px] text-ink-500">{s.count}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

function EmailRow({ email, onClick }: { email: EmailListItem; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-3 px-3 py-2 hover:bg-ink-800/40 text-left transition-colors"
    >
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
        </div>
        <div className="text-xs text-ink-400 truncate">
          {email.subject || <em className="text-ink-600">(sans sujet)</em>}
        </div>
        {email.snippet && (
          <div className="text-[11px] text-ink-500 truncate mt-0.5">{email.snippet}</div>
        )}
      </div>
      {email.has_attachments && <Paperclip size={11} className="text-ink-500 shrink-0" />}
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
                <div className="text-[11px] text-ink-500 font-mono mt-0.5">
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
                  {email.labels.slice(0, 6).map((l) => (
                    <span
                      key={l}
                      className="text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-ink-800 text-ink-400 border border-ink-700"
                    >
                      {l}
                    </span>
                  ))}
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
