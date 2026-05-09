/**
 * /search — recherche cross-source (Phase 1 : multi-search parallele).
 *
 * Pas de fake unification : 4 endpoints existants en parallele, resultats
 * groupes par source avec compteur. Pas d'embeddings cross-source en backend
 * pour emails/drive/browser, donc pas de vraie recherche vectorielle unifiee
 * pour l'instant — full-text par source + ML pour photos.
 *
 * Server Component qui lit ?q= et passe au client. Si pas de q, redirige
 * vers / pour ouvrir le chat (legacy compat avec Cmd+K).
 */

import { redirect } from 'next/navigation'
import { Sidebar } from '@/components/sidebar'
import { SearchClient } from './search-client'

interface PageProps {
  searchParams: Promise<{ q?: string; conv?: string }>
}

export default async function SearchPage({ searchParams }: PageProps) {
  const params = await searchParams
  const q = params.q?.trim()

  if (!q) {
    // Legacy : Cmd+K ouvert sans question -> home avec chat
    redirect('/')
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 px-4 sm:px-6 lg:px-8 pt-16 lg:pt-6 pb-6 max-w-[1100px]">
        <SearchClient query={q} />
      </main>
    </div>
  )
}
