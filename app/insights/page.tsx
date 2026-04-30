'use client'

import { Sidebar } from '@/components/sidebar'
import { HubStatus } from '@/components/hub-status'
import { ComingSoon } from '@/components/coming-soon'
import { Sparkles } from 'lucide-react'

export default function InsightsPage() {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 px-4 sm:px-6 lg:px-8 pt-16 lg:pt-6 pb-6 max-w-[1400px] flex flex-col">
        <ComingSoon
          icon={Sparkles}
          title="Insights"
          subtitle="Anomalies, patterns et alertes proactives · LLM cross-source"
          phase="Phase 4+"
          eta="après toutes les sources connectées"
          description="Le hub regarde tes data toutes les nuits et te signale ce qui mérite ton attention : dépense inhabituelle, abonnement oublié, doublon de paiement, baisse de sommeil corrélée à un stress, photos prises hors zone habituelle, etc. Ranking par importance (dot rouge/orange/vert)."
          sources={['Cross-référencement Banking + Localisation + Santé + Calendrier', 'Détection statistique (z-score, IQR)', 'Pattern matching LLM']}
          capabilities={[
            "Anomalies : 'Hydro-Québec a doublé ce mois'",
            "Abonnements jamais annulés depuis > 6 mois",
            "Dépenses 30% au-dessus de la moyenne mensuelle",
            "Doublons de paiements (même marchand, même montant, < 7 jours)",
            "Baisse de sommeil corrélée avec dépenses élevées",
          ]}
        />
        <div className="mt-auto pt-4">
          <HubStatus />
        </div>
      </main>
    </div>
  )
}
