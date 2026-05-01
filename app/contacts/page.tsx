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
} from 'lucide-react'
import { useState } from 'react'
import useSWR, { mutate as swrMutate } from 'swr'
import { api, type ContactItem, type ContactsStatsResponse } from '@/lib/api'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'

export default function ContactsPage() {
  const [syncing, setSyncing] = useState(false)
  const [search, setSearch] = useState('')
  const { data: contacts } = useSWR<ContactItem[]>(
    ['contacts', search],
    () => api.contacts.list({ q: search.trim() || undefined, limit: 300 })
  )
  const { data: stats } = useSWR<ContactsStatsResponse>('contacts-stats', () =>
    api.contacts.stats()
  )

  async function handleSync() {
    setSyncing(true)
    try {
      const res = await api.contacts.sync()
      toast.success(`Sync OK · ${res.ingested} nouveaux, ${res.updated} màj`, {
        description: `${res.duration_seconds}s`,
      })
      void swrMutate(['contacts', search])
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
            <Kpi label="Avec org" value={stats.with_organization} icon={Building2} color="text-warn" />
          </div>
        )}

        <div className="relative mb-3">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Recherche par nom…"
            className="w-full bg-ink-800 border border-ink-700 rounded-md pl-7 pr-3 py-1.5 text-xs focus:outline-none focus:border-accent/60"
          />
        </div>

        <div className="flex-1 min-h-0">
          {contacts && contacts.length === 0 && (
            <div className="ga-card p-6 text-center">
              <Users size={24} className="text-ink-500 mx-auto mb-2" />
              <div className="text-sm text-ink-300">Aucun contact</div>
              <p className="text-xs text-ink-500 mt-1">
                Click &laquo;&nbsp;Sync Contacts&nbsp;&raquo; pour importer
              </p>
            </div>
          )}
          {contacts && contacts.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {contacts.map((c) => (
                <ContactCard key={c.id} contact={c} />
              ))}
            </div>
          )}
        </div>

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

function ContactCard({ contact }: { contact: ContactItem }) {
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
    <div className="ga-card p-3 flex items-start gap-3">
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
    </div>
  )
}
