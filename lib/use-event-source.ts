'use client'

/**
 * useEventSource — hook SSE pour le flux temps réel du hub.
 *
 * Se connecte à GET /v1/events/stream et écoute les events nommés :
 *   connected, new_transaction, new_location, stats_update
 *
 * Reconnexion automatique après 5s en cas d'erreur réseau.
 * Se déconnecte proprement quand le composant est démonté.
 *
 * Usage :
 *   const { lastEvent, status } = useEventSource(`${API_BASE}/v1/events/stream`)
 *   const pulseFinances = lastEvent?.type === 'new_transaction'
 */

import { useEffect, useRef, useState } from 'react'

// ── Types ─────────────────────────────────────────────────────────────────────

export type HubEventType = 'connected' | 'new_transaction' | 'new_location' | 'stats_update'

export interface HubEvent {
  type: HubEventType | string
  data: Record<string, any>
  receivedAt: number  // Date.now() — pour réinitialiser le pulse après X ms
}

export type SseStatus = 'connecting' | 'connected' | 'disconnected' | 'error'

export interface UseEventSourceReturn {
  lastEvent: HubEvent | null
  status: SseStatus
}

// ── Hook ──────────────────────────────────────────────────────────────────────

const EVENT_TYPES: HubEventType[] = ['connected', 'new_transaction', 'new_location', 'stats_update']
const RECONNECT_DELAY_MS = 5_000

export function useEventSource(url: string): UseEventSourceReturn {
  const [lastEvent, setLastEvent] = useState<HubEvent | null>(null)
  const [status, setStatus] = useState<SseStatus>('connecting')
  const esRef = useRef<EventSource | null>(null)
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cancelledRef = useRef(false)

  useEffect(() => {
    cancelledRef.current = false

    function connect() {
      if (cancelledRef.current) return
      setStatus('connecting')

      const es = new EventSource(url)
      esRef.current = es

      // Handler générique pour tous les types d'events connus
      function makeHandler(type: string) {
        return (e: MessageEvent) => {
          if (cancelledRef.current) return
          try {
            const data = JSON.parse(e.data as string) as Record<string, unknown>
            if (type === 'connected') {
              setStatus('connected')
            }
            setLastEvent({ type, data, receivedAt: Date.now() })
          } catch {
            // JSON invalide — ignore silencieusement
          }
        }
      }

      EVENT_TYPES.forEach((type) => {
        es.addEventListener(type, makeHandler(type))
      })

      es.onerror = () => {
        if (cancelledRef.current) return
        setStatus('error')
        es.close()
        retryRef.current = setTimeout(connect, RECONNECT_DELAY_MS)
      }
    }

    connect()

    return () => {
      cancelledRef.current = true
      esRef.current?.close()
      esRef.current = null
      if (retryRef.current) {
        clearTimeout(retryRef.current)
        retryRef.current = null
      }
      setStatus('disconnected')
    }
  }, [url])

  return { lastEvent, status }
}
