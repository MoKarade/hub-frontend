'use client'

// Composant client-only (chargé via dynamic({ ssr: false }) dans /locations/page.tsx)
// Leaflet touche window/document → ne peut pas tourner en SSR.

import { MapContainer, TileLayer, CircleMarker, Tooltip, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { useEffect } from 'react'
import type { LocationPoint } from '@/lib/api'

const ACTIVITY_COLORS: Record<string, string> = {
  walking: '#5cdb95',   // accent vert
  cycling: '#5fb3f4',   // info bleu
  driving: '#ffb84d',   // warn orange
  still: '#8b95a3',     // gris
  unknown: '#5a6572',
}

function FitBounds({ points }: { points: LocationPoint[] }) {
  const map = useMap()
  useEffect(() => {
    if (points.length === 0) return
    const lats = points.map((p) => parseFloat(p.latitude))
    const lngs = points.map((p) => parseFloat(p.longitude))
    const bounds: [[number, number], [number, number]] = [
      [Math.min(...lats), Math.min(...lngs)],
      [Math.max(...lats), Math.max(...lngs)],
    ]
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 })
  }, [points, map])
  return null
}

export function LocationMap({ points }: { points: LocationPoint[] }) {
  // Centre par défaut : Lévis (où vit Marc)
  const center: [number, number] = [46.7383, -71.2433]

  return (
    <MapContainer
      center={center}
      zoom={11}
      scrollWheelZoom
      style={{ height: '100%', width: '100%', background: '#0f1419' }}
    >
      <TileLayer
        attribution='&copy; OpenStreetMap'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitBounds points={points} />
      {points.map((p) => {
        const color = ACTIVITY_COLORS[p.activity_type ?? 'unknown'] ?? ACTIVITY_COLORS.unknown
        return (
          <CircleMarker
            key={p.id}
            center={[parseFloat(p.latitude), parseFloat(p.longitude)]}
            radius={4}
            pathOptions={{
              color,
              fillColor: color,
              fillOpacity: 0.6,
              weight: 1,
            }}
          >
            <Tooltip>
              <div className="text-xs">
                <div className="font-mono">{new Date(p.timestamp_utc).toLocaleString('fr-CA')}</div>
                <div>
                  {p.activity_type ?? '—'} · ±{p.accuracy_m ?? '?'} m
                </div>
              </div>
            </Tooltip>
          </CircleMarker>
        )
      })}
    </MapContainer>
  )
}

export default LocationMap
