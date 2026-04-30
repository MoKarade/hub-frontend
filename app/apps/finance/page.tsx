'use client'

import { Sidebar } from '@/components/sidebar'
import { HubStatus } from '@/components/hub-status'
import { ComingSoon } from '@/components/coming-soon'
import { Wallet } from 'lucide-react'

export default function FinanceAppPage() {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 px-4 sm:px-6 lg:px-8 pt-16 lg:pt-6 pb-6 max-w-[1400px] flex flex-col">
        <ComingSoon
          icon={Wallet}
          title="App Finance"
          subtitle="Comptes, abonnements, placements · iframe versionnée"
          phase="Phase 2+"
          eta="après stabilisation Phase 1"
          description="Mini-app embarquée (iframe) qui prolonge la page Finances avec : graphes recharts avancés (cashflow, dépenses par catégorie en pie chart), tracking d'abonnements, performance portefeuille Disnat avec benchmarks. Versionnable v1/v2/v3 (ADR-0007)."
          sources={['/v1/finance/* (hub-core API)', 'recharts pour graphes', 'Catégorisation LLM auto']}
          capabilities={[
            "Mes 5 plus grosses catégories de dépenses ce trimestre",
            "Évolution de mon solde sur 12 mois (cashflow)",
            "Performance de mon portefeuille vs S&P 500",
            "Mes abonnements actifs et leur coût annuel total",
          ]}
        />
        <div className="mt-auto pt-4">
          <HubStatus />
        </div>
      </main>
    </div>
  )
}
