import { Sparkles } from 'lucide-react'

/**
 * Insights pro-actifs (anomalies, doublons, patterns).
 *
 * Phase 4+ : pas encore implémenté côté hub-core. L'endpoint
 * `GET /v1/insights` n'existe pas (cf. roadmap dans hub-docs/04-api-contract.md).
 *
 * Règle "no fake data" : on n'invente pas d'insights — on affiche un placeholder
 * honnête qui explique l'état réel.
 */
export function InsightList() {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
      <Sparkles size={20} className="text-ink-600" />
      <p className="text-sm text-ink-300">Aucun insight encore</p>
      <p className="text-xs text-ink-500 max-w-[260px]">
        L'endpoint <code className="font-mono">/v1/insights</code> sera ajouté
        en Phase 4+ (anomalies, abonnements doublons, patterns).
      </p>
    </div>
  )
}
