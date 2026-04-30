'use client'

import { Sidebar } from '@/components/sidebar'
import { HubStatus } from '@/components/hub-status'
import { ComingSoon } from '@/components/coming-soon'
import { Tabs, useActiveTab, type TabItem } from '@/components/tabs'
import {
  MapPin,
  Footprints,
  Bike,
  Car,
  Pause,
  Map as MapIcon,
  LayoutDashboard,
} from 'lucide-react'
import dynamic from 'next/dynamic'
import { useMemo, useState, Suspense, type ComponentType } from 'react'
import useSWR from 'swr'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'

// Maps loaded client-only (touch window/document)
const LeafletLocationMap = dynamic(() => import('@/components/location-map'), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full flex items-center justify-center text-ink-400 text-sm">
      Chargement de la carte…
    </div>
  ),
})
const GoogleLocationMap = dynamic(() => import('@/components/google-location-map'), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full flex items-center justify-center text-ink-400 text-sm">
      Chargement de Google Maps…
    </div>
  ),
})

const ACTIVITIES: { id: string; label: string; icon: ComponentType<{ size?: number; className?: string }> }[] = [
  { id: '', label: 'Toutes', icon: MapPin },
  { id: 'walking', label: 'Marche', icon: Footprints },
  { id: 'cycling', label: 'Vélo', icon: Bike },
  { id: 'driving', label: 'Voiture', icon: Car },
  { id: 'still', label: 'Statique', icon: Pause },
]

const TABS: TabItem[] = [
  { id: 'map', label: 'Carte', icon: MapIcon },
  { id: 'app', label: 'App avancée', icon: LayoutDashboard },
]

export default function LocationsPage() {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 px-4 sm:px-6 lg:px-8 pt-16 lg:pt-6 pb-6 max-w-[1400px] flex flex-col">
        <header className="mb-4">
          <h1 className="text-2xl font-semibold tracking-tight">Localisation</h1>
          <p className="text-sm text-ink-400">
            Points GPS (Google Timeline) · filtrés à 100m de précision · sample 1 pt / 30 sec
          </p>
        </header>

        <Suspense fallback={<div className="text-sm text-ink-400">Chargement…</div>}>
          <LocationsContent />
        </Suspense>

        <div className="mt-4">
          <HubStatus />
        </div>
      </main>
    </div>
  )
}

function LocationsContent() {
  const activeTab = useActiveTab(TABS, 'tab', 'map')

  return (
    <>
      <Tabs items={TABS} defaultId="map" />

      {activeTab === 'map' && <MapTab />}
      {activeTab === 'app' && (
        <ComingSoon
          icon={LayoutDashboard}
          title="App Trajets avancée"
          subtitle="Heatmap · trajets reconstitués · stats détaillées"
          phase="Phase 2+"
          eta="après ingestion Google Timeline"
          description="Mini-app intégrée qui prolonge la carte avec : heatmap des zones les plus fréquentées (leaflet.heat ou google.maps.heatmap), reconstruction des trajets jour par jour, exports KML/GPX, stats de mobilité (km/jour, mode dominant)."
          sources={['/v1/locations/points (hub-core API)', 'leaflet.heat / google heatmap', 'Versionnage par sous-chemin']}
          capabilities={[
            "Heatmap des zones les plus fréquentées",
            "Trajet du jeudi 15 mars (GPS + activité)",
            "Distance totale parcourue ce mois-ci",
            "Exporter mes trajets en GPX pour Strava",
          ]}
        />
      )}
    </>
  )
}

function MapTab() {
  const [startDate, setStartDate] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - 7)
    return d.toISOString().slice(0, 10)
  })
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [activity, setActivity] = useState('')
  const [provider, setProvider] = useState<'google' | 'leaflet'>(
    typeof window !== 'undefined' && process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
      ? 'google'
      : 'leaflet'
  )

  const { data: points, isLoading, error } = useSWR(
    ['/v1/locations/points', startDate, endDate, activity],
    () =>
      api.locations.points
        .list({
          start_date: startDate || undefined,
          end_date: endDate || undefined,
          activity_type: activity || undefined,
          limit: 5000,
        })
        .catch(() => [])
  )

  const stats = useMemo(() => {
    if (!points || points.length === 0)
      return { count: 0, byActivity: {} as Record<string, number>, days: 0 }
    const byActivity: Record<string, number> = {}
    const dayKeys = new Set<string>()
    for (const p of points) {
      const a = p.activity_type ?? 'unknown'
      byActivity[a] = (byActivity[a] ?? 0) + 1
      dayKeys.add(p.timestamp_utc.slice(0, 10))
    }
    return { count: points.length, byActivity, days: dayKeys.size }
  }, [points])

  return (
    <>
      {/* Filtres */}
      <div className="panel p-4 mb-4 grid grid-cols-1 md:grid-cols-4 gap-3">
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-wider text-ink-400 mb-1">
            Du
          </label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full bg-ink-800 border border-ink-700 rounded-md px-3 py-1.5 text-sm font-mono"
          />
        </div>
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-wider text-ink-400 mb-1">
            Au
          </label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full bg-ink-800 border border-ink-700 rounded-md px-3 py-1.5 text-sm font-mono"
          />
        </div>
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-wider text-ink-400 mb-1">
            Activité
          </label>
          <div className="flex gap-1 flex-wrap">
            {ACTIVITIES.map((a) => {
              const Icon = a.icon
              const active = activity === a.id
              return (
                <button
                  key={a.id}
                  onClick={() => setActivity(a.id)}
                  className={cn(
                    'flex items-center gap-1 px-2 py-1 rounded-md text-xs border transition-colors',
                    active
                      ? 'bg-accent/15 border-accent/40 text-accent'
                      : 'bg-ink-800 border-ink-700 text-ink-300 hover:border-ink-600'
                  )}
                >
                  <Icon size={12} />
                  {a.label}
                </button>
              )
            })}
          </div>
        </div>
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-wider text-ink-400 mb-1">
            Fournisseur carte
          </label>
          <div className="flex gap-1">
            <button
              onClick={() => setProvider('google')}
              className={cn(
                'flex-1 px-2 py-1 rounded-md text-xs border transition-colors',
                provider === 'google'
                  ? 'bg-accent/15 border-accent/40 text-accent'
                  : 'bg-ink-800 border-ink-700 text-ink-300 hover:border-ink-600'
              )}
            >
              Google Maps
            </button>
            <button
              onClick={() => setProvider('leaflet')}
              className={cn(
                'flex-1 px-2 py-1 rounded-md text-xs border transition-colors',
                provider === 'leaflet'
                  ? 'bg-accent/15 border-accent/40 text-accent'
                  : 'bg-ink-800 border-ink-700 text-ink-300 hover:border-ink-600'
              )}
            >
              OpenStreetMap
            </button>
          </div>
        </div>
      </div>

      {/* Stats — KPI strip GA-style */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <StatTile label="Points" value={String(stats.count)} />
        <StatTile label="Jours couverts" value={String(stats.days)} />
        <StatTile
          label="Marche"
          value={String(stats.byActivity.walking ?? 0)}
          color="data-positive"
        />
        <StatTile
          label="Voiture"
          value={String(stats.byActivity.driving ?? 0)}
          color="text-warn"
        />
      </div>

      {/* Carte */}
      <div className="panel overflow-hidden flex-1 min-h-[500px] relative">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-ink-950/50 z-10 text-sm text-ink-300">
            Chargement des points…
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-ink-950/50 z-10 text-sm text-danger">
            Erreur · le hub-core ne répond pas
          </div>
        )}
        {!isLoading && !error && stats.count === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-ink-400 text-sm gap-2 z-10 pointer-events-none">
            <MapPin size={32} className="text-ink-600" />
            <p>Aucun point pour ce filtre.</p>
            <p className="text-xs text-ink-500">
              Phase 2 : dépose ton Google Takeout dans <code className="font-mono">inbox/google-timeline/</code>
            </p>
          </div>
        )}
        {provider === 'google' ? (
          <GoogleLocationMap points={points ?? []} />
        ) : (
          <LeafletLocationMap points={points ?? []} />
        )}
      </div>
    </>
  )
}

function StatTile({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="ga-card ga-card-hover px-4 py-3">
      <div className="metric-label mb-1.5">{label}</div>
      <div className={cn('metric truncate', color)}>{value}</div>
    </div>
  )
}
