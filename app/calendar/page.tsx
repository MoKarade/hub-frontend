'use client'

import { Sidebar } from '@/components/sidebar'
import { HubStatus } from '@/components/hub-status'
import { ComingSoon } from '@/components/coming-soon'
import { Calendar } from 'lucide-react'

export default function CalendarPage() {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 px-4 sm:px-6 lg:px-8 pt-16 lg:pt-6 pb-6 max-w-[1400px] flex flex-col">
        <ComingSoon
          icon={Calendar}
          title="Calendrier"
          subtitle="Tes événements Google Calendar agrégés · timeline temporelle"
          phase="Phase 5"
          eta="après santé + emails"
          description="Sync iCal Google Calendar (read-only). Stockage des événements en DB pour cross-reference avec localisation, dépenses, photos. Détection de patterns : récurrence, durée moyenne par catégorie, conflits."
          sources={['Google Calendar iCal export', 'Apple Calendar', 'Outlook .ics']}
          capabilities={[
            "Combien d'heures en réunion la semaine dernière ?",
            "Mes anniversaires à venir dans 30 jours",
            "Quels événements à Lévis pendant mes vacances de mars ?",
            "Conflits dans mon calendrier vendredi prochain",
          ]}
        />
        <div className="mt-auto pt-4">
          <HubStatus />
        </div>
      </main>
    </div>
  )
}
