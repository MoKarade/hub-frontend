'use client'

import { useEffect, useState, useCallback } from 'react'
import { Bell, BellOff, BellRing, RefreshCw, CheckCircle2, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getBaseUrl } from '@/lib/api'

type Status =
  | 'unsupported'   // SW + Push API non disponibles
  | 'denied'        // user a refuse les notifs
  | 'unsubscribed'  // pas encore subscribe
  | 'subscribed'    // OK, tout marche
  | 'loading'

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

export function EnableNotifications() {
  const [status, setStatus] = useState<Status>('loading')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Detection initiale + check subscription existante
  const refreshStatus = useCallback(async () => {
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setStatus('unsupported'); return
    }
    if (Notification.permission === 'denied') {
      setStatus('denied'); return
    }
    try {
      const reg = await navigator.serviceWorker.getRegistration('/sw.js')
      if (!reg) { setStatus('unsubscribed'); return }
      const sub = await reg.pushManager.getSubscription()
      setStatus(sub ? 'subscribed' : 'unsubscribed')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
      setStatus('unsubscribed')
    }
  }, [])

  useEffect(() => { refreshStatus() }, [refreshStatus])

  const handleSubscribe = useCallback(async () => {
    setBusy(true); setError(null)
    try {
      // 1. Register service worker
      const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' })
      await navigator.serviceWorker.ready

      // 2. Demande permission notification
      let perm = Notification.permission
      if (perm === 'default') {
        perm = await Notification.requestPermission()
      }
      if (perm !== 'granted') {
        setStatus('denied')
        setError('Permission notifications refusee')
        return
      }

      // 3. Recupere VAPID public key depuis le backend
      const r = await fetch(`${getBaseUrl()}/v1/notifications/vapid-public-key`)
      if (!r.ok) throw new Error(`VAPID key fetch failed: ${r.status}`)
      const { public_key } = await r.json()

      // 4. Subscribe via PushManager
      // Cast vers BufferSource (Uint8Array<ArrayBuffer> attendu par le DOM lib)
      const appKey = urlBase64ToUint8Array(public_key)
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: appKey.buffer as ArrayBuffer,
      })

      // 5. POST la subscription au backend
      const subJson = sub.toJSON()
      const label = navigator.userAgent.includes('Mobile') ? 'Mobile' : 'Desktop'
      const subResp = await fetch(`${getBaseUrl()}/v1/notifications/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          endpoint: subJson.endpoint,
          keys: subJson.keys,
          label,
        }),
      })
      if (!subResp.ok) throw new Error(`Subscribe POST failed: ${subResp.status}`)

      setStatus('subscribed')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    } finally { setBusy(false) }
  }, [])

  const handleUnsubscribe = useCallback(async () => {
    setBusy(true); setError(null)
    try {
      const reg = await navigator.serviceWorker.getRegistration('/sw.js')
      if (reg) {
        const sub = await reg.pushManager.getSubscription()
        if (sub) {
          await fetch(`${getBaseUrl()}/v1/notifications/unsubscribe`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ endpoint: sub.endpoint }),
          })
          await sub.unsubscribe()
        }
      }
      setStatus('unsubscribed')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    } finally { setBusy(false) }
  }, [])

  const handleTest = useCallback(async () => {
    setBusy(true); setError(null)
    try {
      const r = await fetch(`${getBaseUrl()}/v1/notifications/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          title: '🧪 Test Hub perso',
          body: 'Si tu vois cette notif, le Web Push marche parfaitement.',
          url: '/',
        }),
      })
      if (!r.ok) throw new Error(`Send failed: ${r.status}`)
      const data = await r.json()
      if (data.sent === 0) {
        setError(`Aucune notif envoyee (${data.failed} fail, ${data.revoked} revoked)`)
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    } finally { setBusy(false) }
  }, [])

  // ─── Render selon status ────────────────────────────────────────────

  if (status === 'loading') {
    return (
      <div className="panel p-3 flex items-center gap-2">
        <RefreshCw size={14} className="animate-spin text-ink-400" />
        <span className="text-xs text-ink-400">Vérification…</span>
      </div>
    )
  }

  if (status === 'unsupported') {
    return (
      <div className="panel p-3 flex items-center gap-2 border-amber-500/30">
        <AlertTriangle size={14} className="text-amber-400" />
        <span className="text-xs text-ink-300">
          Ton navigateur ne supporte pas les Web Push (Safari iOS &lt; 16.4).
        </span>
      </div>
    )
  }

  if (status === 'denied') {
    return (
      <div className="panel p-3 flex items-center gap-2 border-red-500/30">
        <BellOff size={14} className="text-red-400" />
        <div className="flex-1">
          <div className="text-xs text-ink-200 font-semibold">Notifications bloquées</div>
          <div className="text-[10px] text-ink-400">
            Va dans les réglages site → Notifications → Autoriser, puis recharge.
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={cn('panel p-3 flex items-center gap-3 transition-colors',
      status === 'subscribed' ? 'border-accent/40' : 'border-ink-700')}>
      {status === 'subscribed'
        ? <CheckCircle2 size={16} className="text-accent shrink-0" />
        : <Bell size={16} className="text-ink-400 shrink-0" />
      }
      <div className="flex-1 min-w-0">
        <div className="text-xs font-semibold text-ink-100">
          {status === 'subscribed'
            ? 'Notifications activées'
            : 'Activer les notifications natives'}
        </div>
        <div className="text-[10px] text-ink-400 mt-0.5">
          {status === 'subscribed'
            ? 'Tu recevras les insights quotidiens directement sur cet appareil.'
            : 'Plus besoin de ntfy.sh — l\'app envoie les notifs elle-même.'}
        </div>
        {error && (
          <div className="text-[10px] text-red-400 font-mono mt-1">{error}</div>
        )}
      </div>
      <div className="flex gap-1.5 shrink-0">
        {status === 'subscribed' ? (
          <>
            <button onClick={handleTest} disabled={busy}
              className="px-2.5 py-1 rounded text-[10px] font-semibold border border-accent/40 text-accent hover:bg-accent/10 disabled:opacity-40 flex items-center gap-1">
              <BellRing size={10} /> Tester
            </button>
            <button onClick={handleUnsubscribe} disabled={busy}
              className="px-2.5 py-1 rounded text-[10px] font-semibold border border-ink-700 text-ink-400 hover:border-red-500/40 hover:text-red-400 disabled:opacity-40">
              Désactiver
            </button>
          </>
        ) : (
          <button onClick={handleSubscribe} disabled={busy}
            className="px-2.5 py-1 rounded text-[10px] font-semibold border border-accent/50 text-accent hover:bg-accent/15 disabled:opacity-40 flex items-center gap-1">
            {busy ? <RefreshCw size={10} className="animate-spin" /> : <Bell size={10} />}
            Activer
          </button>
        )}
      </div>
    </div>
  )
}
