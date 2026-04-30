'use client'

/**
 * ComingSoon — page stub pour les sources/features pas encore livrées.
 *
 * Pattern Google Analytics : icône grosse, titre clair, sous-titre explicatif,
 * tags des sources/tech prévues, ETA en mode "phase".
 *
 * Sprint C compatible : utilise .ga-card, .metric-label, palette ink.
 */

import type { LucideIcon } from 'lucide-react'
import { ArrowRight, Sparkles } from 'lucide-react'

export interface ComingSoonProps {
  /** Icône principale (lucide-react). */
  icon: LucideIcon
  /** Titre H1 de la page. */
  title: string
  /** Sous-titre court (1 ligne). */
  subtitle: string
  /** Phase de livraison (ex: "Phase 3", "Phase 4+"). */
  phase: string
  /** Estimation de date/ordre (ex: "après le déploiement", "Q3 2026"). */
  eta?: string
  /** Description longue de ce que la page va contenir. */
  description: string
  /** Sources de data prévues. */
  sources?: string[]
  /** Capabilities prévues (queries qu'on pourra poser). */
  capabilities?: string[]
}

export function ComingSoon({
  icon: Icon,
  title,
  subtitle,
  phase,
  eta,
  description,
  sources,
  capabilities,
}: ComingSoonProps) {
  return (
    <div className="flex flex-col">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="text-sm text-ink-400">{subtitle}</p>
      </header>

      <div className="ga-card p-8 max-w-2xl">
        {/* Icône hero */}
        <div className="flex items-start gap-4 mb-5">
          <div className="w-12 h-12 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center shrink-0">
            <Icon size={24} className="text-accent" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-accent bg-accent/10 px-2 py-0.5 rounded border border-accent/20">
                {phase}
              </span>
              {eta && (
                <span className="text-[10px] text-ink-500 font-mono">
                  · {eta}
                </span>
              )}
            </div>
            <p className="text-sm text-ink-200 leading-relaxed">{description}</p>
          </div>
        </div>

        {/* Sources prévues */}
        {sources && sources.length > 0 && (
          <div className="mt-6 pt-5 border-t border-ink-800">
            <div className="metric-label mb-2">Sources prévues</div>
            <div className="flex flex-wrap gap-1.5">
              {sources.map((s) => (
                <span
                  key={s}
                  className="text-[11px] px-2 py-1 rounded-md bg-ink-800 border border-ink-700 text-ink-300 font-mono"
                >
                  {s}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Exemples de questions */}
        {capabilities && capabilities.length > 0 && (
          <div className="mt-5 pt-5 border-t border-ink-800">
            <div className="metric-label mb-2">Tu pourras demander</div>
            <ul className="space-y-1.5">
              {capabilities.map((c) => (
                <li
                  key={c}
                  className="flex items-start gap-2 text-sm text-ink-300"
                >
                  <Sparkles size={12} className="text-accent/60 shrink-0 mt-1" />
                  <span className="italic">«{' '}{c}{' '}»</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Footer hint */}
        <div className="mt-6 pt-5 border-t border-ink-800 flex items-center gap-2 text-[11px] text-ink-500 font-mono">
          <ArrowRight size={11} />
          <span>
            Voir le plan complet dans <code className="text-ink-300">hub-docs/JOURNAL.md</code>
          </span>
        </div>
      </div>
    </div>
  )
}
