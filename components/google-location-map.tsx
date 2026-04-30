'use client'

/**
 * GoogleLocationMap — Google Maps avec markers GPS pour les points Timeline.
 *
 * Setup requis (UNE FOIS):
 *   1. Aller sur https://console.cloud.google.com/google/maps-apis/api-list
 *   2. Activer "Maps JavaScript API" pour ton projet
 *   3. Si la clé est restreinte: ajouter http://localhost:3000/* dans les referrers
 *   4. Coller la clé dans .env.local : NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=AIzaSy...
 *   5. Quota gratuit: 28 000 chargements/mois
 *
 * Si Google Maps refuse de charger (API pas activée, clé invalide, etc.),
 * un message d'erreur clair s'affiche avec les liens pour résoudre.
 */

import { useEffect, useMemo, useState } from 'react'
import { APIProvider, Map, Marker } from '@vis.gl/react-google-maps'
import { ExternalLink, Key, AlertTriangle } from 'lucide-react'
import type { LocationPoint } from '@/lib/api'

const ACTIVITY_COLORS: Record<string, string> = {
  walking: '#5cdb95',
  cycling: '#5fb3f4',
  driving: '#ffb84d',
  still: '#8b95a3',
  unknown: '#5a6572',
}

interface Props {
  points: LocationPoint[]
}

export function GoogleLocationMap({ points }: Props) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  const [loadError, setLoadError] = useState<string | null>(null)

  // Centre par défaut : Lévis
  const center = useMemo(() => {
    if (points.length === 0) return { lat: 46.7383, lng: -71.2433 }
    const lats = points.map((p) => parseFloat(p.latitude))
    const lngs = points.map((p) => parseFloat(p.longitude))
    return {
      lat: lats.reduce((a, b) => a + b, 0) / lats.length,
      lng: lngs.reduce((a, b) => a + b, 0) / lngs.length,
    }
  }, [points])

  // Listen for Google Maps API errors via console.error monkey-patch
  useEffect(() => {
    if (!apiKey) return
    const original = console.error
    console.error = (...args: unknown[]) => {
      const msg = String(args[0] ?? '')
      if (msg.includes('Google Maps') || msg.includes('ApiNotActivatedMapError') ||
          msg.includes('InvalidKeyMapError') || msg.includes('RefererNotAllowedMapError')) {
        setLoadError(msg.split('\n')[0].slice(0, 200))
      }
      original.apply(console, args as Parameters<typeof console.error>)
    }
    return () => { console.error = original }
  }, [apiKey])

  if (!apiKey) {
    return <ApiKeyMissing />
  }

  if (loadError) {
    return <ApiError error={loadError} />
  }

  return (
    <div className="w-full h-full">
      <APIProvider apiKey={apiKey} onError={(e) => setLoadError(String(e))}>
        <Map
          defaultCenter={center}
          defaultZoom={11}
          gestureHandling="greedy"
          disableDefaultUI={false}
          style={{ width: '100%', height: '100%' }}
        >
          {points.map((p) => {
            const color = ACTIVITY_COLORS[p.activity_type ?? 'unknown'] ?? ACTIVITY_COLORS.unknown
            return (
              <Marker
                key={p.id}
                position={{
                  lat: parseFloat(p.latitude),
                  lng: parseFloat(p.longitude),
                }}
                title={`${p.activity_type ?? 'unknown'} · ±${p.accuracy_m ?? '?'}m`}
                icon={{
                  path: 0, // google.maps.SymbolPath.CIRCLE
                  fillColor: color,
                  fillOpacity: 0.7,
                  strokeColor: color,
                  strokeWeight: 1,
                  scale: 5,
                }}
              />
            )
          })}
        </Map>
      </APIProvider>
    </div>
  )
}

function ApiKeyMissing() {
  return (
    <div className="h-full w-full flex items-center justify-center p-6">
      <div className="ga-card p-6 max-w-md text-center">
        <div className="w-12 h-12 mx-auto mb-3 rounded-lg bg-warn/15 border border-warn/30 flex items-center justify-center">
          <Key size={20} className="text-warn" />
        </div>
        <div className="metric-label mb-1">Google Maps API key manquante</div>
        <p className="text-sm text-ink-300 leading-relaxed mb-4">
          Ajoute dans <code className="text-xs bg-ink-800 px-1.5 py-0.5 rounded">.env.local</code> :
        </p>
        <pre className="text-[11px] font-mono bg-ink-950 border border-ink-800 rounded p-2 text-left mb-3 overflow-x-auto">
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=AIzaSy...
        </pre>
        <a
          href="https://console.cloud.google.com/google/maps-apis"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-accent hover:text-accent-light transition-colors"
        >
          Obtenir une clé
          <ExternalLink size={11} />
        </a>
      </div>
    </div>
  )
}

function ApiError({ error }: { error: string }) {
  // Detect specific errors
  const isApiNotActivated = error.includes('ApiNotActivatedMapError') ||
                             error.toLowerCase().includes('not activated') ||
                             error.toLowerCase().includes('didn&apos;t load')
  const isInvalidKey = error.includes('InvalidKeyMapError') || error.toLowerCase().includes('invalid key')
  const isRefererBlocked = error.includes('RefererNotAllowedMapError')

  return (
    <div className="h-full w-full flex items-center justify-center p-6">
      <div className="ga-card p-6 max-w-lg text-center border-danger/30">
        <div className="w-12 h-12 mx-auto mb-3 rounded-lg bg-danger/15 border border-danger/30 flex items-center justify-center">
          <AlertTriangle size={20} className="text-danger" />
        </div>
        <div className="metric-label mb-1">Google Maps refuse de charger</div>

        {isApiNotActivated && (
          <div className="text-sm text-ink-300 leading-relaxed mb-4 text-left">
            <p className="mb-2"><strong className="text-ink-100">Maps JavaScript API n&apos;est pas activée</strong> sur ton projet Google Cloud.</p>
            <p className="mb-2">Pour résoudre :</p>
            <ol className="list-decimal list-inside space-y-1 text-xs text-ink-400">
              <li>Va sur Google Cloud Console (lien ci-dessous)</li>
              <li>Sélectionne ton projet</li>
              <li>Active <code className="text-xs bg-ink-800 px-1 rounded">Maps JavaScript API</code></li>
              <li>Recharge la page (~30 sec après activation)</li>
            </ol>
          </div>
        )}

        {isInvalidKey && (
          <p className="text-sm text-ink-300 leading-relaxed mb-4">
            La clé API n&apos;est pas valide. Vérifie qu&apos;elle est bien copiée dans <code className="text-xs bg-ink-800 px-1.5 py-0.5 rounded">.env.local</code>.
          </p>
        )}

        {isRefererBlocked && (
          <p className="text-sm text-ink-300 leading-relaxed mb-4">
            La clé est restreinte à d&apos;autres domaines. Ajoute <code className="text-xs bg-ink-800 px-1.5 py-0.5 rounded">http://localhost:3000/*</code> dans les referrers HTTP autorisés.
          </p>
        )}

        {!isApiNotActivated && !isInvalidKey && !isRefererBlocked && (
          <p className="text-sm text-ink-300 leading-relaxed mb-4">
            En attendant, utilise <strong className="text-accent">OpenStreetMap</strong> (sélecteur ci-dessus). Ça marche tout de suite, sans config.
          </p>
        )}

        <div className="flex flex-col gap-2 items-center">
          <a
            href="https://console.cloud.google.com/google/maps-apis/api-list"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-accent hover:text-accent-light transition-colors"
          >
            Activer Maps JavaScript API
            <ExternalLink size={11} />
          </a>
          <p className="text-[10px] text-ink-500 font-mono">
            En attendant : bascule sur <strong className="text-ink-300">OpenStreetMap</strong> (sélecteur ci-dessus).
          </p>
        </div>
      </div>
    </div>
  )
}

export default GoogleLocationMap
