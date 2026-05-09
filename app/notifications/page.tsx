'use client'

/**
 * /notifications — gestion des Web Push notifications.
 *
 * - Status sur ce browser (subscribed / unsubscribed / denied / unsupported)
 * - Bouton activer / desactiver / tester
 * - Liste des subscriptions actives sur tous les devices (label + UA + last_used)
 *
 * Reutilise le composant <EnableNotifications/> existant pour le toggle local,
 * et liste les subs via api.notifications.listSubscriptions().
 */

import { useEffect, useState, useCallback } from 'react'
import {
  Bell,
  Loader2,
  Smartphone,
  Monitor,
  Trash2,
  RefreshCw,
} from 'lucide-react'
import { Sidebar } from '@/components/sidebar'
import { HubStatus } from '@/components/hub-status'
import { EnableNotifications } from '@/components/enable-notifications'
import { EmptyState } from '@/components/empty-state'
import { ErrorState } from '@/components/error-state'
import { api, type PushSubscriptionItem } from '@/lib/api'
import { toast } from '@/lib/toast'

function formatRelative(iso: string | null): string {
  if (!iso) return 'jamais'
  const d = new Date(iso)
  const now = Date.now()
  const diffMin = Math.floor((now - d.getTime()) / 60000)
  if (diffMin < 1) return "a l'instant"
  if (diffMin < 60) return `il y a ${diffMin} min`
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24) return `il y a ${diffH} h`
  const diffJ = Math.floor(diffH / 24)
  if (diffJ < 30) return `il y a ${diffJ} j`
  return d.toLocaleDateString('fr-CA')
}

function deviceIcon(userAgent: string | null) {
  if (userAgent && /Mobile|Android|iPhone/i.test(userAgent)) {
    return <Smartphone size={14} className="text-accent" />
  }
  return <Monitor size={14} className="text-accent" />
}

function shortUserAgent(ua: string | null): string {
  if (!ua) return 'Inconnu'
  // Extraction grossiere browser + OS
  const browserMatch =
    ua.match(/(Firefox|Chrome|Safari|Edge|Opera)\/[\d.]+/i)?.[1] ?? '?'
  const osMatch =
    ua.match(/(Windows NT|Mac OS X|Android|iPhone OS|Linux)/i)?.[1] ?? '?'
  return `${browserMatch} sur ${osMatch.replace('NT', '').trim()}`
}

export default function NotificationsPage() {
  const [subs, setSubs] = useState<PushSubscriptionItem[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<unknown>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.notifications.listSubscriptions()
      setSubs(data)
    } catch (e) {
      setError(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const handleSendTest = async () => {
    try {
      const r = await api.notifications.sendTest('Test depuis la page /notifications')
      if (r.sent > 0) {
        toast.success(`Notif envoyee a ${r.sent} device(s)`)
      } else {
        toast.error('Aucune notif envoyee', {
          description: `${r.failed} echec(s), ${r.revoked} revoque(s)`,
        })
      }
      void refresh()
    } catch (e) {
      toast.apiError(e instanceof Error ? e.message : String(e), 'Envoi echoue')
    }
  }

  const active = subs?.filter((s) => s.revoked_at === null) ?? []
  const revoked = subs?.filter((s) => s.revoked_at !== null) ?? []

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 px-4 sm:px-6 lg:px-8 pt-16 lg:pt-6 pb-6 max-w-[1100px] space-y-5">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Bell size={20} className="text-accent" />
            Notifications push
          </h1>
          <p className="text-sm text-ink-400 mt-1">
            Web Push natif via VAPID — recois insights et alertes directement,
            sans ntfy.sh ni service externe.
          </p>
        </header>

        <section>
          <h2 className="text-sm font-semibold text-ink-200 mb-2 flex items-center gap-2">
            <span className="w-1 h-4 bg-accent/60 rounded" />
            Ce navigateur
          </h2>
          <EnableNotifications />
        </section>

        <section>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-ink-200 flex items-center gap-2">
              <span className="w-1 h-4 bg-accent/60 rounded" />
              Devices abonnes ({active.length})
            </h2>
            <div className="flex gap-2">
              <button
                onClick={handleSendTest}
                disabled={active.length === 0}
                className="px-2.5 py-1 rounded-md text-[11px] font-semibold border border-accent/40 text-accent hover:bg-accent/10 disabled:opacity-40 inline-flex items-center gap-1.5"
              >
                <Bell size={11} />
                Envoyer un test global
              </button>
              <button
                onClick={() => void refresh()}
                disabled={loading}
                className="px-2.5 py-1 rounded-md text-[11px] font-semibold border border-ink-700 text-ink-300 hover:border-ink-600 disabled:opacity-40 inline-flex items-center gap-1.5"
              >
                <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
                Rafraichir
              </button>
            </div>
          </div>

          {loading && !subs && (
            <div className="panel p-6 text-center text-ink-400 text-sm">
              <Loader2 size={16} className="inline animate-spin mr-2" />
              Chargement...
            </div>
          )}

          {error != null && !loading && (
            <ErrorState error={error} onRetry={refresh} />
          )}

          {subs && active.length === 0 && (
            <EmptyState
              icon={Bell}
              title="Aucun device abonne"
              description="Active les notifications ci-dessus pour t'inscrire sur ce navigateur."
            />
          )}

          {active.length > 0 && (
            <div className="space-y-2">
              {active.map((sub) => (
                <SubRow key={sub.id} sub={sub} />
              ))}
            </div>
          )}
        </section>

        {revoked.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-ink-500 mb-2 flex items-center gap-2">
              <span className="w-1 h-4 bg-ink-700 rounded" />
              Devices revokes ({revoked.length})
            </h2>
            <div className="space-y-2 opacity-60">
              {revoked.map((sub) => (
                <SubRow key={sub.id} sub={sub} />
              ))}
            </div>
          </section>
        )}

        <HubStatus />
      </main>
    </div>
  )
}

function SubRow({ sub }: { sub: PushSubscriptionItem }) {
  const isRevoked = sub.revoked_at !== null
  return (
    <div
      className={`panel p-3 flex items-center gap-3 ${
        isRevoked ? 'border-ink-800' : 'border-accent/20'
      }`}
    >
      <div className="w-8 h-8 rounded-md bg-ink-800/60 border border-ink-700 flex items-center justify-center shrink-0">
        {deviceIcon(sub.user_agent)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-ink-100 truncate">
          {sub.label ?? shortUserAgent(sub.user_agent)}
        </div>
        <div className="text-[11px] text-ink-500 font-mono truncate">
          {sub.label ? shortUserAgent(sub.user_agent) : sub.user_agent ?? ''}
        </div>
        <div className="text-[10px] text-ink-500 mt-0.5">
          Cree {formatRelative(sub.created_at)} · derniere notif{' '}
          {formatRelative(sub.last_used_at)}
          {isRevoked && (
            <span className="text-data-negative ml-2">
              · revoque {formatRelative(sub.revoked_at)}
            </span>
          )}
        </div>
      </div>
      {isRevoked && <Trash2 size={13} className="text-ink-600 shrink-0" />}
    </div>
  )
}
