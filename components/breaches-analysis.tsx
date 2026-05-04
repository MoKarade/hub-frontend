'use client'

/**
 * BreachesAnalysis — vue agregee des fuites de donnees affectant tes services Google.
 *
 * Approche 100% gratuite (pas de cle HIBP $3.95/mois) :
 *  1. Fetch HIBP /api/v3/breaches → liste publique de TOUTES les fuites (~700)
 *  2. Cross-ref avec les domaines des entries Google (e.g. linkedin.com → "LinkedIn 2012")
 *  3. Affiche : chronologie des breaches + types de donnees exposees + severity
 *
 * Limitation : c'est probabiliste (= si t'avais un compte LinkedIn en 2012, t'es
 * presque certain d'etre dans la fuite). Pour confirmation exacte par email,
 * lien vers Mozilla Monitor (gratuit) ou HIBP.com (gratuit pour check ponctuel).
 */

import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  ExternalLink,
  Database,
  Calendar,
  Users,
  Shield,
  ChevronDown,
  ChevronUp,
  Loader2,
  Mail,
  Phone,
  MapPin,
  Cake,
  CreditCard,
  User,
  Lock,
  Globe,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { api, type HibpBreach } from '@/lib/api'

type HIBPBreach = HibpBreach

interface BreachesAnalysisProps {
  /** Liste des entries CSV (apres extraction des domaines) */
  entries: { url: string; username: string }[]
}

/** Extrait le domaine depuis une URL, normalise (sans www, lowercase) */
function extractDomain(url: string): string | null {
  if (!url) return null
  try {
    const u = new URL(url.includes('://') ? url : `https://${url}`)
    return u.hostname.replace(/^www\./, '').toLowerCase()
  } catch {
    return null
  }
}

/** Match un domaine user contre un domaine HIBP (incluant sous-domaines) */
function domainMatches(userDomain: string, hibpDomain: string): boolean {
  if (!userDomain || !hibpDomain) return false
  const u = userDomain.toLowerCase()
  const h = hibpDomain.toLowerCase()
  return u === h || u.endsWith(`.${h}`) || h.endsWith(`.${u}`)
}

/** Map les data classes HIBP vers icones lucide pour affichage compact */
const DATA_CLASS_ICONS: Record<string, { icon: typeof Mail; label: string; severity: number }> = {
  'Email addresses': { icon: Mail, label: 'Email', severity: 1 },
  'Passwords': { icon: Lock, label: 'Mot de passe', severity: 5 },
  'Password hints': { icon: Lock, label: 'Indices mdp', severity: 4 },
  'Phone numbers': { icon: Phone, label: 'Téléphone', severity: 3 },
  'Physical addresses': { icon: MapPin, label: 'Adresse', severity: 4 },
  'Geographic locations': { icon: Globe, label: 'Géolocation', severity: 3 },
  'Dates of birth': { icon: Cake, label: 'Date de naissance', severity: 4 },
  'Credit cards': { icon: CreditCard, label: 'Carte crédit', severity: 5 },
  'Partial credit card data': { icon: CreditCard, label: 'CB partielle', severity: 3 },
  'Names': { icon: User, label: 'Nom', severity: 2 },
  'Usernames': { icon: User, label: 'Username', severity: 2 },
  'IP addresses': { icon: Globe, label: 'IP', severity: 2 },
  'Genders': { icon: User, label: 'Genre', severity: 1 },
}

function getDataClassMeta(cls: string): { icon: typeof Mail; label: string; severity: number } {
  return DATA_CLASS_ICONS[cls] ?? { icon: Database, label: cls, severity: 2 }
}

export function BreachesAnalysis({ entries }: BreachesAnalysisProps) {
  const [breaches, setBreaches] = useState<HIBPBreach[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedBreach, setExpandedBreach] = useState<string | null>(null)

  // Fetch la liste publique HIBP /breaches via proxy backend (jamais direct depuis le frontend)
  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const data = await api.security.hibpBreaches()
        if (!cancelled) {
          setBreaches(data)
          setLoading(false)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Erreur fetch HIBP')
          setLoading(false)
        }
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  // Cross-ref domaines user × breaches HIBP
  const analysis = useMemo(() => {
    if (!breaches || breaches.length === 0) return null

    // Domaines uniques de l'user
    const userDomains = new Set<string>()
    for (const e of entries) {
      const d = extractDomain(e.url)
      if (d) userDomains.add(d)
    }

    // Pour chaque breach, voir si un domaine user matche
    const matched: { breach: HIBPBreach; domains: string[] }[] = []
    for (const breach of breaches) {
      // Skip spam lists et retired (pas vraiment des "breaches")
      if (breach.IsSpamList || breach.IsRetired) continue
      const matches: string[] = []
      for (const d of userDomains) {
        if (domainMatches(d, breach.Domain)) matches.push(d)
      }
      if (matches.length > 0) {
        matched.push({ breach, domains: matches })
      }
    }

    // Sort par date desc
    matched.sort((a, b) => b.breach.BreachDate.localeCompare(a.breach.BreachDate))

    // Aggregation des data classes affectees
    const allDataClasses = new Set<string>()
    let totalAccountsExposed = 0
    for (const m of matched) {
      for (const c of m.breach.DataClasses) allDataClasses.add(c)
      totalAccountsExposed += m.breach.PwnCount
    }

    return {
      matched,
      uniqueServicesAffected: new Set(matched.flatMap((m) => m.domains)).size,
      totalServices: userDomains.size,
      dataClasses: Array.from(allDataClasses).sort((a, b) => {
        const sa = getDataClassMeta(a).severity
        const sb = getDataClassMeta(b).severity
        return sb - sa
      }),
      totalAccountsExposed,
    }
  }, [breaches, entries])

  if (loading) {
    return (
      <div className="ga-card p-4 flex items-center gap-3">
        <Loader2 size={14} className="animate-spin text-accent" />
        <div className="text-sm text-ink-400">
          Chargement de la base HIBP des fuites publiques (~700 breaches)…
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="ga-card p-4 border-warn/30 bg-warn/5 flex items-start gap-3">
        <AlertTriangle size={16} className="text-warn shrink-0 mt-0.5" />
        <div className="text-xs text-ink-300">
          <strong className="text-warn">Erreur HIBP :</strong> {error}.
          {' '}Fallback :{' '}
          <a
            href="https://monitor.mozilla.org/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent hover:text-accent-light inline-flex items-center gap-1"
          >
            Mozilla Monitor <ExternalLink size={10} />
          </a>
        </div>
      </div>
    )
  }

  if (!analysis || analysis.matched.length === 0) {
    return (
      <div className="ga-card p-4 border-data-positive/30 bg-data-positive/5 flex items-start gap-3">
        <Shield size={16} className="text-data-positive shrink-0 mt-0.5" />
        <div className="flex-1">
          <div className="text-sm font-semibold text-data-positive mb-1">
            Aucun service affecté par une fuite connue
          </div>
          <p className="text-xs text-ink-400 leading-relaxed">
            Aucun de tes {analysis?.totalServices ?? 0} services ne correspond à une fuite publique
            répertoriée par HIBP. Pour vérification définitive par email :{' '}
            <a
              href="https://monitor.mozilla.org/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent hover:text-accent-light inline-flex items-center gap-1"
            >
              Mozilla Monitor <ExternalLink size={10} />
            </a>
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header explicatif */}
      <div className="ga-card p-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-warn/10 border border-warn/30 flex items-center justify-center shrink-0">
            <AlertTriangle size={16} className="text-warn" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-ink-100 mb-1">
              {analysis.uniqueServicesAffected}/{analysis.totalServices} services dans des fuites publiques
            </h3>
            <p className="text-xs text-ink-400 leading-relaxed mb-2">
              Cross-référence avec la base HIBP des fuites historiques. Si tu avais un compte sur
              ces services à l&apos;époque de la fuite, tes données ont probablement été exposées.
              Pour vérif exacte par email :{' '}
              <a
                href="https://monitor.mozilla.org/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent hover:text-accent-light inline-flex items-center gap-1"
              >
                Mozilla Monitor <ExternalLink size={10} />
              </a>
            </p>
            <div className="text-[11px] text-ink-500 leading-relaxed border-t border-ink-700/50 pt-2 mt-2">
              <strong className="text-ink-300">Différence avec le scan password ↑ :</strong>{' '}
              le scan password vérifie si <strong>ton mdp actuel</strong> est dans les fuites (souvent OK
              si Google le génère). Le scan ici vérifie si <strong>les services</strong> ont été piratés
              — donc si ton email/téléphone/DOB y ont fuité (et tu peux pas les changer comme un mdp).
            </div>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        <KpiTile
          icon={AlertTriangle}
          color="text-data-negative"
          label="Breaches"
          value={analysis.matched.length}
          sub="Fuites historiques affectant tes services"
        />
        <KpiTile
          icon={Users}
          color="text-warn"
          label="Comptes exposés"
          value={formatBigNumber(analysis.totalAccountsExposed)}
          sub="Volume cumulé des fuites"
        />
        <KpiTile
          icon={Database}
          color="text-info"
          label="Types de données"
          value={analysis.dataClasses.length}
          sub="Catégories d'infos exposées"
        />
      </div>

      {/* Data classes summary */}
      <div className="ga-card p-4">
        <h4 className="text-xs font-semibold text-ink-200 uppercase tracking-wide mb-3">
          Types de données potentiellement exposées
        </h4>
        <div className="flex flex-wrap gap-2">
          {analysis.dataClasses.map((cls) => {
            const meta = getDataClassMeta(cls)
            const Icon = meta.icon
            const sevColor =
              meta.severity >= 4
                ? 'border-data-negative/40 bg-data-negative/10 text-data-negative'
                : meta.severity >= 3
                  ? 'border-warn/40 bg-warn/10 text-warn'
                  : 'border-info/30 bg-info/5 text-info'
            return (
              <div
                key={cls}
                className={cn(
                  'inline-flex items-center gap-1.5 px-2 py-1 rounded-md border text-[11px] font-medium',
                  sevColor
                )}
                title={cls}
              >
                <Icon size={11} />
                <span>{meta.label}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Liste des breaches */}
      <div className="space-y-2">
        <h4 className="text-xs font-semibold text-ink-200 uppercase tracking-wide">
          Chronologie des fuites ({analysis.matched.length})
        </h4>
        <div className="space-y-1.5 max-h-[600px] overflow-y-auto -mx-1 px-1">
          {analysis.matched.map(({ breach, domains }) => (
            <BreachCard
              key={breach.Name}
              breach={breach}
              domains={domains}
              expanded={expandedBreach === breach.Name}
              onToggle={() =>
                setExpandedBreach(expandedBreach === breach.Name ? null : breach.Name)
              }
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function KpiTile({
  icon: Icon,
  color,
  label,
  value,
  sub,
}: {
  icon: typeof Mail
  color: string
  label: string
  value: string | number
  sub: string
}) {
  return (
    <div className="ga-card p-3">
      <div className="flex items-center gap-1.5 mb-1">
        <Icon size={11} className={color} />
        <div className="metric-label">{label}</div>
      </div>
      <div className={cn('metric truncate', color)}>{value}</div>
      <div className="text-[10px] text-ink-500 mt-0.5">{sub}</div>
    </div>
  )
}

function BreachCard({
  breach,
  domains,
  expanded,
  onToggle,
}: {
  breach: HIBPBreach
  domains: string[]
  expanded: boolean
  onToggle: () => void
}) {
  const breachYear = new Date(breach.BreachDate).getFullYear()
  const sensitive = breach.IsSensitive

  return (
    <div
      className={cn(
        'ga-card transition-colors',
        sensitive && 'border-data-negative/30 bg-data-negative/5'
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        className="w-full p-3 text-left flex items-center gap-3 hover:bg-ink-800/40 transition-colors rounded-lg"
      >
        {/* Logo / fallback */}
        <div className="w-10 h-10 rounded bg-ink-900 border border-ink-700 flex items-center justify-center shrink-0 overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={breach.LogoPath}
            alt=""
            className="w-full h-full object-contain"
            onError={(e) => {
              ;(e.target as HTMLImageElement).style.display = 'none'
            }}
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <span className="text-sm font-semibold text-ink-100 truncate">{breach.Title}</span>
            <span className="text-[10px] font-mono text-ink-500">
              <Calendar size={9} className="inline -mt-0.5 mr-0.5" />
              {breachYear}
            </span>
            {sensitive && (
              <span className="text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-data-negative/10 text-data-negative border border-data-negative/30">
                Sensible
              </span>
            )}
          </div>
          <div className="text-[11px] text-ink-400 truncate">
            <span className="font-mono text-ink-500">{breach.Domain}</span>
            {' · '}
            <span>{formatBigNumber(breach.PwnCount)} comptes affectés</span>
            {' · '}
            <span>{breach.DataClasses.length} types de données</span>
          </div>
          {domains.length > 1 && (
            <div className="text-[10px] text-ink-500 mt-0.5 font-mono truncate">
              Match : {domains.join(', ')}
            </div>
          )}
        </div>
        {expanded ? <ChevronUp size={14} className="text-ink-400 shrink-0" /> : <ChevronDown size={14} className="text-ink-400 shrink-0" />}
      </button>

      {expanded && (
        <div className="px-3 pb-3 pt-1 border-t border-ink-700/50 mt-1">
          {/* Description : on strip TOUT le HTML pour eviter XSS, on garde que le texte.
              HIBP nous donne du HTML controle mais on ne fait pas confiance par defaut. */}
          <p className="text-xs text-ink-300 leading-relaxed mb-3 whitespace-pre-wrap">
            {stripAllHtml(breach.Description)}
          </p>
          {/* Data classes detaillees */}
          <div className="flex flex-wrap gap-1.5 mb-3">
            {breach.DataClasses.map((cls) => {
              const meta = getDataClassMeta(cls)
              const Icon = meta.icon
              return (
                <span
                  key={cls}
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-ink-800 border border-ink-700 text-[10px] text-ink-300"
                >
                  <Icon size={10} />
                  {meta.label}
                </span>
              )
            })}
          </div>
          {/* Lien HIBP officiel */}
          <a
            href={`https://haveibeenpwned.com/PwnedWebsites#${breach.Name}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] text-accent hover:text-accent-light inline-flex items-center gap-1"
          >
            Détails sur HIBP <ExternalLink size={10} />
          </a>
        </div>
      )}
    </div>
  )
}

/** Strip TOUT le HTML — on rend en texte pur pour eviter XSS (event handlers
 * unquotes, balises exotiques, etc.). HIBP fournit du HTML mais on ne fait pas
 * confiance aveugle, et React rendra le texte safely automatiquement.
 * Decode aussi les entites HTML communes pour lisibilite. */
function stripAllHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function formatBigNumber(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}G`
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return n.toLocaleString('fr-CA')
}
