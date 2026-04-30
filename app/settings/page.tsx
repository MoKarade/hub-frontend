'use client'

import { Sidebar } from '@/components/sidebar'
import { HubStatus } from '@/components/hub-status'
import { ComingSoon } from '@/components/coming-soon'
import { Settings } from 'lucide-react'

export default function SettingsPage() {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 px-4 sm:px-6 lg:px-8 pt-16 lg:pt-6 pb-6 max-w-[1400px] flex flex-col">
        <ComingSoon
          icon={Settings}
          title="Réglages"
          subtitle="Configuration du hub · sources, modèles, notifications"
          phase="Phase 1+"
          eta="incrémental selon les besoins"
          description="Réglages utilisateur : choix du modèle Ollama, fréquence de sync de chaque source, seuils d'alertes (anomalies, abonnements oubliés), langue d'interface, fuseau horaire, raccourcis clavier, thèmes (dark only pour l'instant), export/import du layout dashboard."
          sources={['localStorage (préférences UI)', 'Postgres (configs source)', 'age+sops (secrets sources)']}
          capabilities={[
            "Activer/désactiver les sources de data",
            "Configurer la fréquence d'ingestion CSV/email",
            "Définir les seuils d'alertes (anomalie = ±X% mensuel)",
            "Gérer les modèles Ollama (changer Qwen → Llama 3.3)",
            "Export du layout dashboard pour partager entre devices",
          ]}
        />
        <div className="mt-auto pt-4">
          <HubStatus />
        </div>
      </main>
    </div>
  )
}
