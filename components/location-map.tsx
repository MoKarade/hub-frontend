'use client'

// Composant client-only (chargé via dynamic({ ssr: false }) dans /locations/page.tsx)
// Leaflet touche window/document → ne peut pas tourner en SSR.

import {
  MapContainer, TileLayer, CircleMarker, Tooltip, Polyline, useMap, useMapEvents,
} from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import 'leaflet.heat'  // attache L.heatLayer
import { useEffect, useMemo, useRef } from 'react'
import type { LocationPoint, LocationVisit } from '@/lib/api'

// ─── Couleurs par activité (points GPS) ─────────────────────────────────────

const ACTIVITY_COLORS: Record<string, string> = {
  WALKING:              '#5cdb95', CYCLING: '#34d399', RUNNING: '#86efac',
  IN_PASSENGER_VEHICLE: '#ffb84d', IN_VEHICLE: '#fb923c', IN_BUS: '#f97316',
  IN_TRAIN:             '#c084fc', IN_SUBWAY: '#a78bfa',
  FLYING:               '#5fb3f4', SKIING: '#e0f2fe',
  walking: '#5cdb95',  cycling: '#34d399', driving: '#ffb84d',
  still:   '#8b95a3',  unknown: '#5a6572',
}

const SEMANTIC_COLORS: Record<string, string> = {
  HOME:              '#5cdb95', INFERRED_HOME:    '#3db37a',
  WORK:              '#5fb3f4', INFERRED_WORK:    '#3a8fd6',
  SEARCHED_ADDRESS:  '#ffb84d', ALIASED_LOCATION: '#c084fc',
  UNKNOWN:           '#6b7280',
}

const getActivityColor = (t?: string | null) => ACTIVITY_COLORS[t ?? 'unknown'] ?? '#5a6572'
const getSemanticColor = (t?: string | null) => SEMANTIC_COLORS[t ?? 'UNKNOWN'] ?? '#6b7280'

// ─── Helpers ────────────────────────────────────────────────────────────────

function FitBounds({ bounds }: { bounds: [number, number][] }) {
  const map = useMap()
  useEffect(() => {
    if (bounds.length === 0) return
    const lats = bounds.map((b) => b[0])
    const lngs = bounds.map((b) => b[1])
    const minLat = Math.min(...lats), maxLat = Math.max(...lats)
    const minLng = Math.min(...lngs), maxLng = Math.max(...lngs)
    if (Math.abs(minLat - maxLat) < 0.0001 && Math.abs(minLng - maxLng) < 0.0001) {
      map.setView([minLat, minLng], 14)
    } else {
      map.fitBounds([[minLat, minLng], [maxLat, maxLng]], { padding: [40, 40], maxZoom: 15 })
    }
  }, [bounds, map])
  return null
}

function ClickHandler({ onMapClick }: { onMapClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng.lat, e.latlng.lng)
    },
  })
  return null
}

function HeatLayerComponent({ points }: { points: LocationPoint[] }) {
  const map = useMap()
  const layerRef = useRef<L.HeatLayer | null>(null)

  useEffect(() => {
    if (points.length === 0) return
    const data = points.map((p) =>
      [parseFloat(p.latitude), parseFloat(p.longitude), 1] as [number, number, number]
    )
    const layer = L.heatLayer(data, {
      radius: 18, blur: 22, maxZoom: 14, minOpacity: 0.35,
      gradient: {
        0.0: '#0d1117', 0.2: '#1e3a8a', 0.4: '#5fb3f4',
        0.6: '#5cdb95', 0.8: '#ffb84d', 1.0: '#fbbf24',
      },
    })
    layer.addTo(map)
    layerRef.current = layer
    return () => {
      if (layerRef.current) {
        layerRef.current.remove()
        layerRef.current = null
      }
    }
  }, [points, map])

  return null
}

function TrajectoryLayer({ points }: { points: LocationPoint[] }) {
  // Connecte les points consécutifs par ordre temporel.
  // Couleur dégradée selon l'heure (matin = jaune, midi = vert, soir = bleu).
  const segments = useMemo(() => {
    if (points.length < 2) return []
    const sorted = [...points].sort(
      (a, b) => new Date(a.timestamp_utc).getTime() - new Date(b.timestamp_utc).getTime()
    )
    const segs: { positions: [number, number][]; color: string; key: string }[] = []
    for (let i = 0; i < sorted.length - 1; i++) {
      const a = sorted[i], b = sorted[i + 1]
      // Brise la polyline si gap >30 min
      const dtMin = (new Date(b.timestamp_utc).getTime() - new Date(a.timestamp_utc).getTime()) / 60000
      if (dtMin > 30) continue
      const hour = new Date(a.timestamp_utc).getHours()
      const color = hour < 6 ? '#7c3aed'
                  : hour < 11 ? '#fbbf24'
                  : hour < 16 ? '#5cdb95'
                  : hour < 20 ? '#5fb3f4'
                  : '#a78bfa'
      segs.push({
        positions: [
          [parseFloat(a.latitude), parseFloat(a.longitude)],
          [parseFloat(b.latitude), parseFloat(b.longitude)],
        ],
        color,
        key: `${a.id}-${b.id}`,
      })
    }
    return segs
  }, [points])

  return (
    <>
      {segments.map((s) => (
        <Polyline
          key={s.key}
          positions={s.positions}
          pathOptions={{ color: s.color, weight: 3, opacity: 0.75, lineJoin: 'round', lineCap: 'round' }}
        />
      ))}
    </>
  )
}

// ─── Composant principal ─────────────────────────────────────────────────────

export type MapMode = 'visits' | 'points' | 'trajectory' | 'heatmap'

interface LocationMapProps {
  points?: LocationPoint[]
  visits?: LocationVisit[]
  mode?: MapMode
  onMapClick?: (lat: number, lng: number) => void
  highlightLat?: number
  highlightLng?: number
  highlightRadius?: number  // mètres
  defaultCenter?: [number, number]
  defaultZoom?: number
}

export function LocationMap({
  points = [],
  visits = [],
  mode = 'visits',
  onMapClick,
  highlightLat,
  highlightLng,
  highlightRadius,
  defaultCenter = [46.7383, -71.2433],  // Lévis QC
  defaultZoom = 11,
}: LocationMapProps) {
  // Bounds pour fit-bounds — selon le mode
  const bounds = useMemo<[number, number][]>(() => {
    if (mode === 'visits' && visits.length > 0) {
      return visits.map((v) => [parseFloat(v.lat), parseFloat(v.lng)] as [number, number])
    }
    if ((mode === 'points' || mode === 'trajectory' || mode === 'heatmap') && points.length > 0) {
      return points.map((p) => [parseFloat(p.latitude), parseFloat(p.longitude)] as [number, number])
    }
    return []
  }, [mode, points, visits])

  return (
    <MapContainer
      center={defaultCenter}
      zoom={defaultZoom}
      scrollWheelZoom
      style={{ height: '100%', width: '100%', background: '#0d1117' }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      />

      <FitBounds bounds={bounds} />
      {onMapClick && <ClickHandler onMapClick={onMapClick} />}

      {/* ── Mode "visits" ──────────────────────────────────────────────── */}
      {mode === 'visits' && visits.map((v) => {
        const color = getSemanticColor(v.semantic_type)
        const start = new Date(v.start_time)
        const end = new Date(v.end_time)
        const durationMin = Math.round((end.getTime() - start.getTime()) / 60000)
        const fmtDur = durationMin < 60
          ? `${durationMin}min`
          : `${Math.floor(durationMin / 60)}h${String(durationMin % 60).padStart(2, '0')}`
        const radius = Math.max(4, Math.min(14, 4 + Math.log2(durationMin + 1)))
        return (
          <CircleMarker
            key={v.id}
            center={[parseFloat(v.lat), parseFloat(v.lng)]}
            radius={radius}
            pathOptions={{ color, fillColor: color, fillOpacity: 0.55, weight: 1.5 }}
          >
            <Tooltip>
              <div style={{ fontSize: 11, fontFamily: 'monospace', lineHeight: 1.5 }}>
                <div style={{ color, fontWeight: 'bold' }}>{v.semantic_type ?? 'LIEU INCONNU'}</div>
                <div>
                  {start.toLocaleDateString('fr-CA', { day: 'numeric', month: 'short' })}{' '}
                  {start.toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' })}
                  {' → '}
                  {end.toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' })}
                </div>
                <div style={{ color: '#5cdb95' }}>Durée : {fmtDur}</div>
                <div style={{ color: '#8b95a3' }}>
                  {parseFloat(v.lat).toFixed(5)}°, {parseFloat(v.lng).toFixed(5)}°
                </div>
              </div>
            </Tooltip>
          </CircleMarker>
        )
      })}

      {/* ── Mode "points" ──────────────────────────────────────────────── */}
      {mode === 'points' && points.map((p) => {
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
                <div style={{ color }}>{p.activity_type ?? '—'}</div>
                <div style={{ color: '#8b95a3' }}>
                  {parseFloat(p.latitude).toFixed(5)}°, {parseFloat(p.longitude).toFixed(5)}°
                </div>
              </div>
            </Tooltip>
          </CircleMarker>
        )
      })}

      {/* ── Mode "trajectory" ──────────────────────────────────────────── */}
      {mode === 'trajectory' && <TrajectoryLayer points={points} />}

      {/* ── Mode "heatmap" ─────────────────────────────────────────────── */}
      {mode === 'heatmap' && <HeatLayerComponent points={points} />}

      {/* ── Highlight (cercle de rayon) ─────────────────────────────────── */}
      {typeof highlightLat === 'number' && typeof highlightLng === 'number' && (
        <CircleMarker
          center={[highlightLat, highlightLng]}
          radius={highlightRadius ? Math.max(8, Math.log2(highlightRadius)) * 2 : 14}
          pathOptions={{
            color: '#5cdb95', fillColor: '#5cdb95',
            fillOpacity: 0.15, weight: 2, dashArray: '4 4',
          }}
        />
      )}
    </MapContainer>
  )
}

export default LocationMap
