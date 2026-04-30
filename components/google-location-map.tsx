'use client'

/**
 * GoogleLocationMap — Google Maps avec markers GPS pour les points Timeline.
 *
 * Nécessite NEXT_PUBLIC_GOOGLE_MAPS_API_KEY dans .env.local.
 * Sans clé, le composant retourne un état vide avec lien doc.
 *
 * Pour obtenir une clé gratuite :
 *   1. https://console.cloud.google.com/google/maps-apis
 *   2. Créer un projet → activer Maps JavaScript API
 *   3. Créer une clé API → restreindre à localhost:3000
 *   4. Coller dans .env.local: NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=AIzaSy...
 *   5. Quota gratuit: 28 000 chargements/mois (largement suffisant)
 */

import { useMemo } from 'react'
import { APIProvider, Map, AdvancedMarker, Pin } from '@vis.gl/react-google-maps'
import { ExternalLink, Key } from 'lucide-react'
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

  // Centre par défaut : Lévis (où vit Marc)
  const center = useMemo(() => {
    if (points.length === 0) return { lat: 46.7383, lng: -71.2433 }
    const lats = points.map((p) => parseFloat(p.latitude))
    const lngs = points.map((p) => parseFloat(p.longitude))
    return {
      lat: lats.reduce((a, b) => a + b, 0) / lats.length,
      lng: lngs.reduce((a, b) => a + b, 0) / lngs.length,
    }
  }, [points])

  // No API key → friendly empty state
  if (!apiKey) {
    return (
      <div className="h-full w-full flex items-center justify-center p-6">
        <div className="ga-card p-6 max-w-md text-center">
          <div className="w-12 h-12 mx-auto mb-3 rounded-lg bg-warn/15 border border-warn/30 flex items-center justify-center">
            <Key size={20} className="text-warn" />
          </div>
          <div className="metric-label mb-1">Google Maps API key manquante</div>
          <p className="text-sm text-ink-300 leading-relaxed mb-4">
            Pour afficher la carte Google, obtiens une clé API gratuite (28k loads/mois)
            et ajoute-la dans <code className="text-xs bg-ink-800 px-1.5 py-0.5 rounded">.env.local</code> :
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
            Obtenir une clé sur Google Cloud Console
            <ExternalLink size={11} />
          </a>
        </div>
      </div>
    )
  }

  return (
    <APIProvider apiKey={apiKey}>
      <Map
        defaultCenter={center}
        defaultZoom={11}
        mapId="hub-perso-map"
        gestureHandling="greedy"
        disableDefaultUI={false}
        colorScheme="DARK"
        style={{ width: '100%', height: '100%', borderRadius: '0.5rem' }}
      >
        {points.map((p) => {
          const color = ACTIVITY_COLORS[p.activity_type ?? 'unknown'] ?? ACTIVITY_COLORS.unknown
          return (
            <AdvancedMarker
              key={p.id}
              position={{
                lat: parseFloat(p.latitude),
                lng: parseFloat(p.longitude),
              }}
              title={`${p.activity_type ?? 'unknown'} · ±${p.accuracy_m ?? '?'}m`}
            >
              <Pin
                background={color}
                borderColor={color}
                glyphColor="#0a0e14"
                scale={0.6}
              />
            </AdvancedMarker>
          )
        })}
      </Map>
    </APIProvider>
  )
}

export default GoogleLocationMap
