'use client'

import { Sidebar } from '@/components/sidebar'
import { HubStatus } from '@/components/hub-status'
import { ComingSoon } from '@/components/coming-soon'
import { Image as ImageIcon } from 'lucide-react'

export default function PhotosPage() {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 px-4 sm:px-6 lg:px-8 pt-16 lg:pt-6 pb-6 max-w-[1400px] flex flex-col">
        <ComingSoon
          icon={ImageIcon}
          title="Photos"
          subtitle="Grid + recherche par contenu (CLIP) · indexation locale"
          phase="Phase 3"
          eta="après déploiement Phase 0"
          description="Import depuis Google Photos Takeout (zip) ou dossier local. Génération de thumbnails (sharp), extraction EXIF (date, GPS, appareil), embeddings CLIP locaux pour recherche sémantique 'montre-moi les photos de la mer'. Stockage des originaux sur disque local, vecteurs en pgvector."
          sources={['Google Photos Takeout', 'Dossier local C:\\photos', 'EXIF metadata', 'CLIP ViT-B/32']}
          capabilities={[
            "Montre-moi les photos prises à Lévis en 2025",
            "Trouve toutes les photos avec un chien",
            "Photos prises avant 8h le matin cette année",
            "Combien de photos j'ai prises pendant nos vacances en juillet ?",
          ]}
        />
        <div className="mt-auto pt-4">
          <HubStatus />
        </div>
      </main>
    </div>
  )
}
