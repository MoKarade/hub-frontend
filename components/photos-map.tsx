'use client'

/**
 * PhotosMap - vue carte des photos geolocalisees.
 * Utilise react-leaflet (deja en deps). Lazy-loaded car leaflet a besoin de window.
 */

import { useEffect, useRef } from 'react'
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { PhotoItem } from '@/lib/api'

// Fix marker icon path (Next.js casse l'import des icons par defaut)
const ICON = L.icon({
  iconUrl:
    'data:image/svg+xml;base64,' +
    btoa(
      `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="36" viewBox="0 0 24 36">
        <path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 24 12 24s12-15 12-24c0-6.6-5.4-12-12-12z" fill="#5cdb95"/>
        <circle cx="12" cy="12" r="6" fill="#0a0e14"/>
      </svg>`
    ),
  iconSize: [24, 36],
  iconAnchor: [12, 36],
  popupAnchor: [0, -36],
})

function FitBounds({ photos }: { photos: PhotoItem[] }) {
  const map = useMap()
  useEffect(() => {
    const geo = photos.filter((p) => p.latitude != null && p.longitude != null)
    if (geo.length === 0) return
    const lats = geo.map((p) => p.latitude!)
    const lngs = geo.map((p) => p.longitude!)
    const bounds = L.latLngBounds(
      [Math.min(...lats), Math.min(...lngs)],
      [Math.max(...lats), Math.max(...lngs)]
    )
    map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 })
  }, [photos, map])
  return null
}

interface PhotosMapProps {
  photos: PhotoItem[]
  thumbUrl: (mediaId: string, size?: number) => string
}

export function PhotosMap({ photos, thumbUrl }: PhotosMapProps) {
  const geo = photos.filter((p) => p.latitude != null && p.longitude != null)
  const containerRef = useRef<HTMLDivElement>(null)

  if (geo.length === 0) {
    return (
      <div className="ga-card p-8 text-center">
        <div className="text-sm text-ink-300 mb-2">Aucune photo géolocalisée</div>
        <p className="text-xs text-ink-500">
          Click &laquo;&nbsp;Enrichir GPS&nbsp;&raquo; pour extraire les coordonnées EXIF de tes photos
        </p>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="ga-card overflow-hidden h-[60vh]">
      <MapContainer
        center={[geo[0].latitude!, geo[0].longitude!]}
        zoom={5}
        style={{ height: '100%', width: '100%' }}
        className="rounded-lg"
      >
        <TileLayer
          attribution='&copy; OpenStreetMap'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds photos={geo} />
        {geo.map((p) => (
          <Marker key={p.id} position={[p.latitude!, p.longitude!]} icon={ICON}>
            <Popup>
              <div style={{ fontSize: 11 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={thumbUrl(p.media_id, 200)}
                  alt=""
                  style={{
                    width: 180,
                    height: 120,
                    objectFit: 'cover',
                    borderRadius: 4,
                    marginBottom: 6,
                  }}
                />
                <div style={{ fontWeight: 600 }}>{p.filename ?? '(sans nom)'}</div>
                {p.location_name && <div style={{ color: '#666' }}>{p.location_name}</div>}
                <div style={{ color: '#999', fontFamily: 'monospace' }}>
                  {new Date(p.creation_time).toLocaleDateString('fr-CA')}
                </div>
                <div style={{ color: '#999', fontFamily: 'monospace', fontSize: 10 }}>
                  {p.latitude!.toFixed(5)}, {p.longitude!.toFixed(5)}
                </div>
                {p.product_url && (
                  <a
                    href={p.product_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: '#5cdb95' }}
                  >
                    Ouvrir →
                  </a>
                )}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  )
}
