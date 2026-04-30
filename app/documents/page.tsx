'use client'

import { Sidebar } from '@/components/sidebar'
import { HubStatus } from '@/components/hub-status'
import { ComingSoon } from '@/components/coming-soon'
import { FileText } from 'lucide-react'

export default function DocumentsPage() {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 px-4 sm:px-6 lg:px-8 pt-16 lg:pt-6 pb-6 max-w-[1400px] flex flex-col">
        <ComingSoon
          icon={FileText}
          title="Documents"
          subtitle="PDFs, contrats, factures · indexation full-text + OCR"
          phase="Phase 5"
          eta="après santé + emails"
          description="Drop tes PDFs dans inbox/documents/, le hub fait OCR (tesseract si scan), extraction texte (pdfplumber), classification (contrat / facture / relevé / impôt) via Qwen, indexation full-text Postgres. Recherche par contenu + tags + date."
          sources={['inbox/documents/*.pdf', 'pdfplumber + tesseract OCR', 'classification LLM']}
          capabilities={[
            "Mon contrat Hydro-Québec quelle est la date de renouvellement ?",
            "Liste tous les contrats actifs",
            "Trouve la facture de mon plombier en mars 2025",
            "Combien j'ai payé en frais notariés cette année ?",
          ]}
        />
        <div className="mt-auto pt-4">
          <HubStatus />
        </div>
      </main>
    </div>
  )
}
