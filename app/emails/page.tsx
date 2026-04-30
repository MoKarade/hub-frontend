'use client'

import { Sidebar } from '@/components/sidebar'
import { HubStatus } from '@/components/hub-status'
import { ComingSoon } from '@/components/coming-soon'
import { Mail } from 'lucide-react'

export default function EmailsPage() {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 px-4 sm:px-6 lg:px-8 pt-16 lg:pt-6 pb-6 max-w-[1400px] flex flex-col">
        <ComingSoon
          icon={Mail}
          title="Emails"
          subtitle="Recherche full-text dans tes emails Gmail · indexation locale"
          phase="Phase 3"
          eta="après déploiement Phase 0"
          description="Synchronisation incrémentale Gmail via OAuth, parsing MIME, extraction des pièces jointes. Indexation full-text Postgres + embeddings nomic pour recherche sémantique. Tout reste local — Gmail garde l'original, le hub garde une copie indexée chiffrée."
          sources={['Gmail API', 'OAuth 2.0 (read-only scope)', 'IMAP fallback']}
          capabilities={[
            "Trouve l'email d'Hydro-Québec sur la facture de mars",
            "Combien d'emails non-lus dans 'Travail' depuis 1 mois ?",
            "Liste les emails avec PDF reçus en avril",
            "Quels marchands m'ont envoyé un reçu cette semaine ?",
          ]}
        />
        <div className="mt-auto pt-4">
          <HubStatus />
        </div>
      </main>
    </div>
  )
}
