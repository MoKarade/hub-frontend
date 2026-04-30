'use client'

import { Sidebar } from '@/components/sidebar'
import { HubStatus } from '@/components/hub-status'
import { ComingSoon } from '@/components/coming-soon'
import { Heart } from 'lucide-react'

export default function HealthPage() {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 px-4 sm:px-6 lg:px-8 pt-16 lg:pt-6 pb-6 max-w-[1400px] flex flex-col">
        <ComingSoon
          icon={Heart}
          title="Santé"
          subtitle="Garmin Connect + Google Fit · sommeil, fréquence cardiaque, VO2max"
          phase="Phase 5"
          eta="Q3 2026"
          description="Sync Garmin Connect (FIT files) + Apple Health export + Google Fit. Métriques quotidiennes : sommeil (durée, qualité, REM/profond/léger), fréquence cardiaque (repos, max, zones), pas, calories, VO2max. Cross-reference avec localisation pour détecter activités."
          sources={['Garmin Connect API (via garmin-connect-py)', 'Apple Health XML export', 'Google Fit REST API', 'FIT files']}
          capabilities={[
            "Mon sommeil moyen sur le dernier mois",
            "Combien de pas en moyenne en avril 2026 ?",
            "Mes courses du dernier semestre — distance totale ?",
            "Comment évolue ma VO2max depuis janvier ?",
            "Comparer mon sommeil les soirs où j'ai fait du sport vs sans",
          ]}
        />
        <div className="mt-auto pt-4">
          <HubStatus />
        </div>
      </main>
    </div>
  )
}
