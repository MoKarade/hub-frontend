'use client'

// Composant client-only (chargé via dynamic({ ssr: false }) dans /locations/page.tsx)
// Leaflet touche window/document → ne peut pas tourner en SSR.

import { MapContainer, TileLayer, CircleMarker, Tooltip, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { useEffect } from 'react'
import type { LocationPoint, LocationVisit } from '@/lib/api'

// ─── Couleurs par activité (points GPS) ─────────────────────────────────────

const ACTIVITY_COLORS: Record<string, string> = {
  WALKING:              '#5cdb95',  // vert
  CYCLING:              '#34d399',  // émeraude
  IN_PASSENGER_VEHICLE: '#ffb84d',  // orange
  IN_VEHICLE:           '#fb923c',  // orange foncé
  IN_TRAIN:             '#c084fc',  // violet
  IN_SUBWAY:            '#a78bfa',  // lavande
  IN_BUS:               '#f97316',  // orange
  FLYING:               '#5fb3f4',  // bleu ciel
  SKIING:               '#e0f2fe',  // bleu très clair
  RUNNING:              '#86efac',  // vert clair
  // Ancien format
  walking: '#5cdb95',
  cycling: '#34d399',
  driving: '#ffb84d',
  still:   '#8b95a3',
  unknown: '#5a6572',
}

// ─── Couleurs par type sémantique (visites) ──────────────────────────────────

const SEMANTIC_COLORS: Record<string, string> = {
  HOME:              '#5cdb95',
  INFERRED_HOME:     '#3db37a',
  WORK:              '#5fb3f4',
  INFERRED_WORK:     '#3a8fd6',
  SEARCHED_ADDRESS:  '#ffb84d',
  ALIASED_LOCATION:  '#c084fc',
  UNKNOWN:           '#6b7280',
}

function getActivityColor(type: string | null | undefined) {
  return ACTIVITY_COLORS[type ?? 'unknown'] ?? '#5a6572'
}

function getSemanticColor(type: string | null | undefined) {
  return SEMANTIC_COLORS[type ?? 'UNKNOWN'] ?? '#6b7280'
}

// ─── Helpers map ────────────────────────────────────────────────────────────

function FitBoundsPoints({ points }: { points: LocationPoint[] }) {
  const map = useMap()
  useEffect(() => {
    if (points.length === 0) return
    const lats = points.map((p) => parseFloat(p.latitude))
    const lngs = points.map((p) => parseFloat(p.longitude))
    map.fitBounds(
      [[Math.min(...lats), Math.min(...lngs)], [Math.max(...lats), Math.max(...lngs)]],
      { padding: [40, 40], maxZoom: 15 }
    )
  }, [points, map])
  return null
}

function FitBoundsVisits({ visits }: { visits: LocationVisit[] }) {
  const map = useMap()
  useEffect(() => {
    if (visits.length === 0) return
    const lats = visits.map((v) => parseFloat(v.lat))
    const lngs = visits.map((v) => parseFloat(v.lng))
    map.fitBounds(
      [[Math.min(...lats), Math.min(...lngs)], [Math.max(...lats), Math.max(...lngs)]],
      { padding: [40, 40], maxZoom: 14 }
    )
  }, [visits, map])
  return null
}

// ─── Composant principal ─────────────────────────────────────────────────────

interface LocationMapProps {
  points?: LocationPoint[]
  visits?: LocationVisit[]
}

export function LocationMap({ points = [], visits = [] }: LocationMapProps) {
  // Centre par défaut : Lévis QC (domicile de Marc)
  const center: [number, number] = [46.7383, -71.2433]

  return (
    <MapContainer
      center={center}
      zoom={11}
      scrollWheelZoom
      style={{ height: '100%', width: '100%', background: '#0d1117' }}
    >
      {/* Tuiles OSM dark-ish via CartoDB */}
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      />

      {/* Couche points GPS */}
      <FitBoundsPoints points={points} />
      {points.map((p) => {
        const color = getActivityColor(p.activity_type)
        return (
          <CircleMarker
            key={p.id}
            center={[parseFloat(p.latitude), parseFloat(p.longitude)]}
            radius={3}
            pathOptions={{ color, fillColor: color, fillOpacity: 0.7, weight: 0 }}
          >
            <Tooltip>
              <div style={{ fontSize: 11, fontFamily: 'monospace', lineHeight: 1.5 }}>
                <div>{new Date(p.timestamp_utc).toLocaleString('fr-CA')}</div>
                <div style={{ color: color }}>{p.activity_type ?? '—'}</div>
                <div style={{ color: '#8b95a3' }}>
                  {parseFloat(p.latitude).toFixed(5)}°, {parseFloat(p.longitude).toFixed(5)}°
                </div>
              </div>
            </Tooltip>
          </CircleMarker>
        )
      })}

      {/* Couche visites sémantiques */}
      <FitBoundsVisits visits={visits} />
      {visits.map((v) => {
        const color = getSemanticColor(v.semantic_type)
        const start = new Date(v.start_time)
        const end = new Date(v.end_time)
        const durationMin = Math.round((end.getTime() - start.getTime()) / 60000)
        const fmtDuration = durationMin < 60
          ? `${durationMin}min`
          : `${Math.floor(durationMin / 60)}h${String(durationMin % 60).padStart(2, '0')}`

        // Taille du cercle proportionnelle à la durée (15min→4px, 8h→12px)
        const radius = Math.max(4, Math.min(14, 4 + Math.log2(durationMin + 1)))

        return (
          <CircleMarker
            key={v.id}
            center={[parseFloat(v.lat), parseFloat(v.lng)]}
            radius={radius}
            pathOptions={{
              color,
              fillColor: color,
              fillOpacity: 0.55,
              weight: 1.5,
            }}
          >
            <Tooltip>
              <div style={{ fontSize: 11, fontFamily: 'monospace', lineHeight: 1.6 }}>
                <div style={{ color, fontWeight: 'bold' }}>
                  {v.semantic_type ?? 'LIEU INCONNU'}
                </div>
                <div>
                  {start.toLocaleDateString('fr-CA', { day: 'numeric', month: 'short' })}
                  {' '}{start.toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' })}
                  {' → '}
                  {end.toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' })}
                </div>
                <div style={{ color: '#5cdb95' }}>Durée : {fmtDuration}</div>
                <div style={{ color: '#8b95a3' }}>
                  {parseFloat(v.lat).toFixed(5)}°, {parseFloat(v.lng).toFixed(5)}°
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
