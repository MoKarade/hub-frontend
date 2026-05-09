'use client'

import { Sidebar } from '@/components/sidebar'
import { HubStatus } from '@/components/hub-status'
import {
  Users,
  RefreshCw,
  Loader2,
  Search,
  Mail,
  Phone,
  Building2,
  Cake,
  X,
  MapPin,
  ArrowRight,
  ExternalLink,
} from 'lucide-react'
import Link from 'next/link'
import { useMemo, useState } from 'react'
import useSWR, { mutate as swrMutate } from 'swr'
import {
  api,
  type ContactItem,
  type ContactDetail,
  type ContactsStatsResponse,
  type EmailListItem,
} from '@/lib/api'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'

export default function ContactsPage() {
  const [syncing, setSyncing] = useState(false)
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<'name' | 'recent' | 'family'>('name')
  const [hasEmail, setHasEmail] = useState(false)
  const [hasPhone, setHasPhone] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const { data: contacts } = useSWR<ContactItem[]>(
    ['contacts', search, sort],
    () => api.contacts.list({ q: search.trim() || undefined, sort, limit: 1000 })
  )
  const { data: stats } = useSWR<ContactsStatsResponse>('contacts-stats', () =>
    api.contacts.stats()
  )

  const visible = useMemo(() => {
    if (!contacts) return []
    return contacts.filter((c) => {
      if (hasEmail && c.emails.length === 0) return false
      if (hasPhone && c.phones.length === 0) return false
      return true
    })
  }, [contacts, hasEmail, hasPhone])

  async function handleSync() {
    setSyncing(true)
    try {
      const res = await api.contacts.sync()
      toast.success(`Sync OK · ${res.ingested} nouveaux, ${res.updated} màj`, {
        description: `${res.duration_seconds}s`,
      })
      void swrMutate((key) => Array.isArray(key) && key[0] === 'contacts')
      void swrMutate('contacts-stats')
    } catch (err) {
      toast.apiError(err, 'Sync Contacts échoué')
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
            <h1 className="text-2xl font-semibold tracking-tight">Contacts</h1>
            <p className="text-sm text-ink-400">Google Contacts · synchronisé localement</p>
          </div>
          <button
            type="button"
            onClick={handleSync}
            disabled={syncing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-accent text-ink-950 text-xs font-semibold hover:bg-accent-light transition-colors disabled:opacity-50"
          >
            {syncing ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
            {syncing ? 'Sync…' : 'Sync Contacts'}
          </button>
        </header>

        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
            <Kpi label="Total" value={stats.total} icon={Users} color="text-ink-100" />
            <Kpi label="Avec email" value={stats.with_email} icon={Mail} color="text-info" />
            <Kpi label="Avec tél" value={stats.with_phone} icon={Phone} color="text-accent" />
            <Kpi
              label="Avec org"
              value={stats.with_organization}
              icon={Building2}
              color="text-warn"
            />
          </div>
        )}

        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Recherche : nom, email, tél, organisation, ID…"
              className="w-full bg-ink-800 border border-ink-700 rounded-md pl-7 pr-3 py-1.5 text-xs focus:outline-none focus:border-accent/60"
            />
          </div>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as 'name' | 'recent' | 'family')}
            className="bg-ink-800 border border-ink-700 rounded-md px-2 py-1.5 text-xs"
          >
            <option value="name">Trier : Prénom</option>
            <option value="family">Trier : Nom famille</option>
            <option value="recent">Trier : Récent</option>
          </select>
          <button
            type="button"
            onClick={() => setHasEmail((v) => !v)}
            className={cn(
              'px-2 py-1.5 rounded-md text-[11px] border',
              hasEmail
                ? 'bg-info/15 border-info/30 text-info'
                : 'bg-ink-800 border-ink-700 text-ink-400'
            )}
          >
            <Mail size={11} className="inline mr-1" /> Email
          </button>
          <button
            type="button"
            onClick={() => setHasPhone((v) => !v)}
            className={cn(
              'px-2 py-1.5 rounded-md text-[11px] border',
              hasPhone
                ? 'bg-accent/15 border-accent/30 text-accent'
                : 'bg-ink-800 border-ink-700 text-ink-400'
            )}
          >
            <Phone size={11} className="inline mr-1" /> Tél
          </button>
        </div>
        <div className="text-[10px] font-mono text-ink-500 mb-1">
          {visible.length} / {contacts?.length ?? 0} contacts
        </div>

        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[1fr_minmax(360px,420px)] gap-3">
          <div>
            {visible.length === 0 && (
              <div className="ga-card p-6 text-center">
                <Users size={24} className="text-ink-500 mx-auto mb-2" />
                <div className="text-sm text-ink-300">
                  {contacts && contacts.length === 0 ? 'Aucun contact' : 'Aucun match'}
                </div>
                {contacts && contacts.length === 0 && (
                  <p className="text-xs text-ink-500 mt-1">
                    Click &laquo;&nbsp;Sync Contacts&nbsp;&raquo; pour importer
                  </p>
                )}
              </div>
            )}
            {visible.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2 max-h-[calc(100vh-280px)] overflow-y-auto pr-1">
                {visible.map((c) => (
                  <ContactCard
                    key={c.id}
                    contact={c}
                    selected={c.id === selectedId}
                    onClick={() => setSelectedId(c.id)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Desktop side panel */}
          <aside className="hidden lg:block">
            {selectedId ? (
              <DetailPanel contactId={selectedId} onClose={() => setSelectedId(null)} />
            ) : (
              <div className="ga-card p-6 text-center text-xs text-ink-500">
                Sélectionne un contact pour voir le détail
              </div>
            )}
          </aside>
        </div>

        {/* Mobile fullscreen modal */}
        {selectedId && (
          <div className="lg:hidden fixed inset-0 z-40 bg-ink-950 overflow-y-auto">
            <DetailPanel
              contactId={selectedId}
              onClose={() => setSelectedId(null)}
              fullscreen
            />
          </div>
        )}

        <div className="mt-auto pt-4">
          <HubStatus />
        </div>
      </main>
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
  icon: typeof Users
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

function ContactCard({
  contact,
  selected,
  onClick,
}: {
  contact: ContactItem
  selected: boolean
  onClick: () => void
}) {
  const initials = contact.display_name
    ? contact.display_name
        .split(' ')
        .map((n) => n[0])
        .filter(Boolean)
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : '?'
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'ga-card p-3 flex items-start gap-3 text-left w-full transition-colors',
        selected && 'border-accent/60 bg-accent/5'
      )}
    >
      <div className="w-10 h-10 rounded-full bg-accent/15 border border-accent/30 flex items-center justify-center shrink-0 overflow-hidden">
        {contact.photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={contact.photo_url}
            alt=""
            className="w-full h-full object-cover"
            onError={(e) => {
              ;(e.target as HTMLImageElement).style.display = 'none'
            }}
          />
        ) : (
          <span className="text-xs font-semibold text-accent">{initials}</span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-ink-100 truncate">
          {contact.display_name || '(sans nom)'}
        </div>
        {contact.organizations.length > 0 && (
          <div className="text-[11px] text-ink-400 truncate">{contact.organizations[0]}</div>
        )}
        <div className="space-y-0.5 mt-1.5 text-[11px]">
          {contact.emails.slice(0, 1).map((e) => (
            <div key={e} className="text-ink-300 truncate flex items-center gap-1">
              <Mail size={10} className="text-ink-500 shrink-0" /> {e}
            </div>
          ))}
          {contact.phones.slice(0, 1).map((p) => (
            <div key={p} className="text-ink-300 truncate flex items-center gap-1">
              <Phone size={10} className="text-ink-500 shrink-0" /> {p}
            </div>
          ))}
          {contact.birthday && (
            <div className="text-ink-500 flex items-center gap-1">
              <Cake size={10} /> {contact.birthday}
            </div>
          )}
        </div>
      </div>
    </button>
  )
}

function daysUntilBirthday(iso: string): number | null {
  // Format ISO YYYY-MM-DD; on calcule prochain anniversaire
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return null
  const month = parseInt(m[2], 10)
  const day = parseInt(m[3], 10)
  if (!month || !day) return null
  const today = new Date()
  const year = today.getFullYear()
  let next = new Date(year, month - 1, day)
  if (next < new Date(today.getFullYear(), today.getMonth(), today.getDate())) {
    next = new Date(year + 1, month - 1, day)
  }
  const diff = Math.round(
    (next.getTime() - new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) /
      (1000 * 60 * 60 * 24)
  )
  return diff
}

function DetailPanel({
  contactId,
  onClose,
  fullscreen,
}: {
  contactId: string
  onClose: () => void
  fullscreen?: boolean
}) {
  const { data, error, isLoading } = useSWR<ContactDetail>(
    ['contact-detail', contactId],
    () => api.contacts.get(contactId)
  )

  const primaryEmail = data?.emails[0] ?? null

  const { data: recentEmails, isLoading: emailsLoading } = useSWR<EmailListItem[]>(
    primaryEmail ? ['contact-recent-emails', primaryEmail] : null,
    () => api.emails.list({ sender_email: primaryEmail!, limit: 5 })
  )

  const initials = data?.display_name
    ? data.display_name
        .split(' ')
        .map((n) => n[0])
        .filter(Boolean)
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : '?'

  const bDays = data?.birthday ? daysUntilBirthday(data.birthday) : null

  return (
    <div className={cn('ga-card p-4 space-y-3', fullscreen ? 'min-h-screen rounded-none' : 'sticky top-4')}>
      <div className="flex items-start justify-between gap-2">
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-md hover:bg-ink-800 text-ink-400 hover:text-ink-200"
          aria-label="Fermer"
        >
          <X size={14} />
        </button>
      </div>

      {isLoading && (
        <div className="text-xs text-ink-400 flex items-center gap-2">
          <Loader2 size={12} className="animate-spin" /> Chargement…
        </div>
      )}
      {error && (
        <div className="text-xs text-warn">Impossible de charger le contact.</div>
      )}

      {data && (
        <>
          <div className="flex items-start gap-3">
            <div className="w-14 h-14 rounded-full bg-accent/15 border border-accent/30 flex items-center justify-center shrink-0 overflow-hidden">
              {data.photo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={data.photo_url}
                  alt=""
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    ;(e.target as HTMLImageElement).style.display = 'none'
                  }}
                />
              ) : (
                <span className="text-base font-semibold text-accent">{initials}</span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-base font-semibold text-ink-100 truncate">
                {data.display_name || '(sans nom)'}
              </div>
              {data.organizations.length > 0 && (
                <div className="text-xs text-ink-400 mt-0.5">
                  {data.organizations.map((o) => (
                    <div key={o} className="truncate">{o}</div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {data.emails.length > 0 && (
            <DetailSection icon={Mail} label="Emails">
              {data.emails.map((e) => (
                <a
                  key={e}
                  href={`mailto:${e}`}
                  className="block text-xs text-ink-200 hover:text-accent break-all"
                >
                  {e}
                </a>
              ))}
            </DetailSection>
          )}

          {data.phones.length > 0 && (
            <DetailSection icon={Phone} label="Téléphones">
              {data.phones.map((p) => (
                <a
                  key={p}
                  href={`tel:${p.replace(/\s/g, '')}`}
                  className="block text-xs text-ink-200 hover:text-accent"
                >
                  {p}
                </a>
              ))}
            </DetailSection>
          )}

          {data.addresses.length > 0 && (
            <DetailSection icon={MapPin} label="Adresses">
              {data.addresses.map((a) => (
                <div key={a} className="text-xs text-ink-300 whitespace-pre-line">
                  {a}
                </div>
              ))}
            </DetailSection>
          )}

          {data.birthday && (
            <DetailSection icon={Cake} label="Anniversaire">
              <div className="text-xs text-ink-200">
                {data.birthday}
                {bDays !== null && (
                  <span className="text-ink-500 ml-2">
                    {bDays === 0
                      ? '· aujourd’hui'
                      : `· dans ${bDays} jour${bDays > 1 ? 's' : ''}`}
                  </span>
                )}
              </div>
            </DetailSection>
          )}

          {data.notes && (
            <DetailSection icon={Building2} label="Notes">
              <div className="text-xs text-ink-300 whitespace-pre-line">{data.notes}</div>
            </DetailSection>
          )}

          {primaryEmail && (
            <div className="border-t border-ink-800 pt-3">
              <div className="flex items-center justify-between mb-2">
                <div className="text-[10px] uppercase tracking-wide text-ink-500 font-semibold">
                  Échanges récents
                </div>
                <Link
                  href={`/emails?sender_email=${encodeURIComponent(primaryEmail)}`}
                  className="text-[11px] text-accent hover:underline inline-flex items-center gap-1"
                >
                  Tous les emails <ArrowRight size={10} />
                </Link>
              </div>
              {emailsLoading && (
                <div className="text-[11px] text-ink-500 flex items-center gap-1.5">
                  <Loader2 size={10} className="animate-spin" /> Chargement…
                </div>
              )}
              {!emailsLoading && recentEmails && recentEmails.length === 0 && (
                <div className="text-[11px] text-ink-500">
                  Aucun email reçu de cette adresse.
                </div>
              )}
              {recentEmails && recentEmails.length > 0 && (
                <div className="space-y-1.5">
                  {recentEmails.map((e) => (
                    <Link
                      key={e.id}
                      href={`/emails?id=${e.id}`}
                      className="block ga-card-hover p-2 rounded-md border border-ink-800 hover:border-ink-700"
                    >
                      <div className="text-[11px] font-semibold text-ink-200 truncate">
                        {e.subject || '(sans sujet)'}
                      </div>
                      <div className="text-[10px] text-ink-500 font-mono">
                        {new Date(e.sent_at).toLocaleDateString('fr-CA')}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}

          {data.last_modified && (
            <div className="text-[10px] text-ink-600 font-mono pt-2 border-t border-ink-800">
              Dernière màj Google : {new Date(data.last_modified).toLocaleString('fr-CA')}
            </div>
          )}

          <a
            href={`https://contacts.google.com/${data.person_id.replace('people/', '')}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[11px] text-ink-500 hover:text-accent"
          >
            <ExternalLink size={10} /> Ouvrir dans Google Contacts
          </a>
        </>
      )}
    </div>
  )
}

function DetailSection({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof Users
  label: string
  children: React.ReactNode
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1">
        <Icon size={10} className="text-ink-500" />
        <div className="text-[10px] uppercase tracking-wide text-ink-500 font-semibold">
          {label}
        </div>
      </div>
      <div className="space-y-0.5 pl-4">{children}</div>
    </div>
  )
}
