'use client'

/**
 * Page Insights — anomalies, patterns, alertes proactives.
 *
 * Phase 4+ côté backend (cross-référencement Banking + Locations + Santé).
 * Pour l'instant : design preview avec exemples de cards qui montrent ce
 * que ça donnera quand les data sont là.
 */

import { Sidebar } from '@/components/sidebar'
import { HubStatus } from '@/components/hub-status'
import {
  Sparkles,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  Bell,
  Zap,
  Calendar,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'

type Severity = 'critical' | 'warning' | 'info' | 'positive'

interface InsightCard {
  severity: Severity
  icon: LucideIcon
  title: string
  description: string
  delta?: string
  action?: string
  preview: boolean
}

const PREVIEW_INSIGHTS: InsightCard[] = [
  {
    severity: 'critical',
    icon: AlertTriangle,
    title: 'Doublon de paiement détecté',
    description: 'Hydro-Québec facturé 2 fois ce mois — 14 mars (134 $) et 18 mars (134 $).',
    delta: '+134 $',
    action: 'Voir les transactions',
    preview: true,
  },
  {
    severity: 'warning',
    icon: TrendingUp,
    title: 'Dépenses restos +47% vs moyenne',
    description: '423 $ ce mois vs 287 $ en moyenne. 8 sorties au lieu de 5 habituelles.',
    delta: '+136 $',
    action: 'Détails par marchand',
    preview: true,
  },
  {
    severity: 'info',
    icon: Bell,
    title: 'Abonnement oublié ?',
    description: 'Netflix prélevé chaque mois depuis 14 mois. Dernier login détecté il y a 5 mois.',
    delta: '17,99 $/mois',
    action: 'Aller à Netflix',
    preview: true,
  },
  {
    severity: 'positive',
    icon: CheckCircle2,
    title: 'Solde au-dessus de l\'objectif',
    description: 'Solde courant fin mars : 8 432 $ — au-dessus du seuil 5 000 $ que tu te fixes.',
    delta: '+3 432 $',
    action: 'Voir l\'évolution',
    preview: true,
  },
  {
    severity: 'info',
    icon: TrendingDown,
    title: 'Sommeil en baisse',
    description: 'Moyenne 6h12 sur les 7 derniers jours vs 7h28 le mois dernier. Corrélation avec dépenses élevées les soirs courts.',
    delta: '-1h16',
    action: 'Voir Santé',
    preview: true,
  },
  {
    severity: 'warning',
    icon: Zap,
    title: 'Pic de localisation hors zone',
    description: '12 points GPS détectés à Montréal le 15 mars — habituellement Lévis. Voyage non identifié dans Calendar.',
    action: 'Voir trajets',
    preview: true,
  },
]

const SEVERITY_STYLES: Record<Severity, { dot: string; border: string; bg: string; iconColor: string }> = {
  critical: { dot: 'bg-data-negative', border: 'border-data-negative/30', bg: 'bg-data-negative/5', iconColor: 'text-data-negative' },
  warning:  { dot: 'bg-warn',          border: 'border-warn/30',          bg: 'bg-warn/5',          iconColor: 'text-warn' },
  info:     { dot: 'bg-info',          border: 'border-info/30',          bg: 'bg-info/5',          iconColor: 'text-info' },
  positive: { dot: 'bg-data-positive', border: 'border-data-positive/30', bg: 'bg-data-positive/5', iconColor: 'text-data-positive' },
}

export default function InsightsPage() {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 px-4 sm:px-6 lg:px-8 pt-16 lg:pt-6 pb-6 max-w-[1400px] flex flex-col">
        <header className="mb-4 flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Insights</h1>
            <p className="text-sm text-ink-400">
              Anomalies, patterns et alertes proactives · cross-source LLM
            </p>
          </div>
          <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-warn bg-warn/10 px-2 py-1 rounded border border-warn/30">
            PREVIEW · Phase 4+
          </span>
        </header>

        {/* Banner explicatif */}
        <div className="ga-card p-4 mb-4 flex items-start gap-3 border-info/30 bg-info/5">
          <Sparkles size={16} className="text-info shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-ink-100 mb-0.5">
              Aperçu de ce que tu verras quand toutes les sources seront connectées
            </div>
            <p className="text-xs text-ink-300 leading-relaxed">
              Le hub regarde tes data toutes les nuits et te signale ce qui mérite attention.
              Cards ci-dessous = exemples plausibles à partir de tes data réelles.
              <strong className="text-ink-100"> Pas encore de vrais insights</strong> tant que
              Phase 1 (banking) + Phase 2 (locations) + Phase 3 (emails/photos) + Phase 5 (santé) ne sont pas livrées.
            </p>
          </div>
        </div>

        {/* KPI strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-4">
          <KpiTile label="Total insights" value="6" icon={Sparkles} />
          <KpiTile label="Critiques" value="1" color="data-negative" />
          <KpiTile label="À surveiller" value="2" color="text-warn" />
          <KpiTile label="Positifs" value="1" color="data-positive" />
        </div>

        {/* Grid des insights */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
          {PREVIEW_INSIGHTS.map((insight, i) => (
            <InsightCardView key={i} insight={insight} />
          ))}
        </div>

        {/* Footer roadmap */}
        <div className="ga-card p-4 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <Calendar size={14} className="text-accent" />
            <span className="metric-label">Roadmap insights</span>
          </div>
          <ul className="space-y-2 text-sm">
            <li className="flex items-start gap-3 text-ink-300">
              <span className="w-1.5 h-1.5 rounded-full bg-data-positive mt-2 shrink-0" />
              <div>
                <strong className="text-ink-100">Phase 4.1</strong> — Détection anomalies finance (z-score sur dépenses mensuelles)
              </div>
            </li>
            <li className="flex items-start gap-3 text-ink-300">
              <span className="w-1.5 h-1.5 rounded-full bg-warn mt-2 shrink-0" />
              <div>
                <strong className="text-ink-100">Phase 4.2</strong> — Détection abonnements (paiements récurrents même montant)
              </div>
            </li>
            <li className="flex items-start gap-3 text-ink-300">
              <span className="w-1.5 h-1.5 rounded-full bg-info mt-2 shrink-0" />
              <div>
                <strong className="text-ink-100">Phase 4.3</strong> — Cross-référencement (sommeil ↔ dépenses, localisation ↔ calendrier)
              </div>
            </li>
            <li className="flex items-start gap-3 text-ink-300">
              <span className="w-1.5 h-1.5 rounded-full bg-ink-600 mt-2 shrink-0" />
              <div>
                <strong className="text-ink-100">Phase 4.4</strong> — Pattern matching LLM (descriptions naturelles : « tu sors plus le jeudi »)
              </div>
            </li>
          </ul>
        </div>

        <div className="mt-auto">
          <HubStatus />
        </div>
      </main>
    </div>
  )
}

function InsightCardView({ insight }: { insight: InsightCard }) {
  const Icon = insight.icon
  const styles = SEVERITY_STYLES[insight.severity]

  return (
    <div className={cn('ga-card ga-card-hover p-4', styles.border, styles.bg, 'relative')}>
      {insight.preview && (
        <span className="absolute top-2 right-2 text-[9px] font-mono uppercase tracking-wider text-ink-500 bg-ink-800 border border-ink-700 px-1.5 py-0.5 rounded">
          mockup
        </span>
      )}
      <div className="flex items-start gap-3">
        <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center shrink-0', styles.bg, styles.border, 'border')}>
          <Icon size={16} className={styles.iconColor} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 mb-1 flex-wrap">
            <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', styles.dot)} />
            <h3 className="text-sm font-semibold text-ink-100 leading-tight">{insight.title}</h3>
            {insight.delta && (
              <span className={cn('text-[11px] font-mono font-semibold ml-auto shrink-0', styles.iconColor)}>
                {insight.delta}
              </span>
            )}
          </div>
          <p className="text-xs text-ink-300 leading-relaxed mb-2">{insight.description}</p>
          {insight.action && (
            <button
              type="button"
              className="text-[11px] text-ink-400 hover:text-ink-100 transition-colors font-mono"
              onClick={(e) => e.preventDefault()}
            >
              {insight.action} →
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function KpiTile({ label, value, color, icon: Icon }: { label: string; value: string; color?: string; icon?: LucideIcon }) {
  return (
    <div className="ga-card ga-card-hover px-4 py-3">
      <div className="flex items-center gap-1.5 mb-1.5">
        {Icon && <Icon size={11} className="text-ink-500" />}
        <div className="metric-label">{label}</div>
      </div>
      <div className={cn('metric truncate', color)}>{value}</div>
    </div>
  )
}
