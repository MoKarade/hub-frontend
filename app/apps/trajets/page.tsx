'use client'

import { Sidebar } from '@/components/sidebar'
import { HubStatus } from '@/components/hub-status'
import { ComingSoon } from '@/components/coming-soon'
import { MapPin } from 'lucide-react'

export default function TrajetsAppPage() {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 px-4 sm:px-6 lg:px-8 pt-16 lg:pt-6 pb-6 max-w-[1400px] flex flex-col">
        <ComingSoon
          icon={MapPin}
          title="App Trajets"
          subtitle="Carte interactive de tes déplacements · iframe versionnée"
          phase="Phase 2+"
          eta="après ingestion Google Timeline"
          description="Mini-app embarquée (iframe) qui visualise tes déplacements GPS sur une carte interactive heatmap. Filtres par date, mode de transport, durée. Exports KML/GPX. La version v1, v2, v3... cohabitent et sont sélectionnables — ADR-0007."
          sources={['/v1/locations/points (hub-core API)', 'leaflet.heat plugin', 'Versionnage par sous-chemin']}
          capabilities={[
            "Heatmap des zones les plus fréquentées",
            "Trajet du jeudi 15 mars (GPS + activité)",
            "Distance totale parcourue ce mois-ci",
            "Exporter mes trajets en GPX pour Strava",
          ]}
        />
        <div className="mt-auto pt-4">
          <HubStatus />
        </div>
      </main>
    </div>
  )
}
