/**
 * /search -> redirige vers / (la home a maintenant le chat conversationnel
 * intégré, donc la page recherche devenait un doublon. Marc 2026-05-05).
 *
 * On garde le path pour compat des liens existants (Cmd+K envoie sur
 * /search?q=... pour pré-remplir une question). On redirige avec le query
 * param vers la home qui le récupère pour pré-remplir le chat.
 */

import { redirect } from 'next/navigation'

interface PageProps {
  searchParams: Promise<{ q?: string; conv?: string }>
}

export default async function SearchRedirect({ searchParams }: PageProps) {
  const params = await searchParams
  const q = params.q
  // Si on avait une question, on la passe a la home via ?ask=
  if (q) {
    redirect(`/?ask=${encodeURIComponent(q)}`)
  }
  redirect('/')
}
