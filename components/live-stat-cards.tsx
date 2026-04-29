'use client'

/**
 * LiveStatCards — KPI strip Google Analytics dark mode (Sprint C).
 *
 * Refonte Sprint C :
 *   - Plus de vert agressif sur les valeurs neutres (Marc : "trop crypto bro")
 *   - Métriques plus grosses (.metric-lg) avec hiérarchie typographique forte
 *   - Bordures subtiles (.ga-card) au lieu du panel original
 *   - Stagger animation conservé (subtil) mais retrait du whileHover lift
 *   - Couleur sémantique appliquée UNIQUEMENT sur le delta (pas la valeur)
 *
 * Pas de fake data — si l'API ne répond pas, on affiche "—".
 */

import { motion } from 'framer-motion'
import useSWR from 'swr'
import { Wallet, Activity, MapPin, Briefcase } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { api } from '@/lib/api'
import { formatCurrency, cn } from '@/lib/utils'
import { stagger, staggerItem } from '@/lib/motion'

export function LiveStatCards() {
  const today = new Date()
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
    .toISOString()
    .slice(0, 10)
  const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 3600 * 1000)
    .toISOString()
    .slice(0, 10)

  // ── Solde compte courant ──────────────────────────────────────────────────
  const { data: accounts } = useSWR('/v1/finance/accounts', () =>
    api.finance.accounts.list().catch(() => [])
  )
  const checkingAccount = accounts?.find((a) => a.account_type === 'checking')

  const { data: lastTxns } = useSWR(
    checkingAccount ? ['/v1/finance/transactions', checkingAccount.id, 'last'] : null,
    () =>
      api.finance.transactions
        .list({ account_id: checkingAccount!.id, limit: 1 })
        .catch(() => [])
  )
  const balance = lastTxns?.[0]?.balance_after ?? null
  const balanceCurrency = checkingAccount?.currency ?? 'CAD'
  const balanceNum = balance !== null ? parseFloat(balance) : null

  // ── Dépenses carte de crédit ce mois ──────────────────────────────────────
  const { data: cc } = useSWR(
    ['/v1/finance/credit-card-transactions', 'month', monthStart],
    () =>
      api.finance.creditCard
        .list({ start_date: monthStart, limit: 500 })
        .catch(() => [])
  )
  const monthlySpending =
    cc
      ?.filter((t) => parseFloat(t.amount) > 0)
      .reduce((s, t) => s + parseFloat(t.amount), 0) ?? null

  // ── Valeur portefeuille (dernier snapshot) ───────────────────────────────
  const { data: positions } = useSWR('/v1/finance/investment-positions', () =>
    api.finance.investmentPositions.list({ limit: 500 }).catch(() => [])
  )
  const portfolio = positions
    ? (() => {
        if (positions.length === 0) return null
        const latest = positions.reduce(
          (m, p) => (p.statement_date > m ? p.statement_date : m),
          ''
        )
        const recent = positions.filter((p) => p.statement_date === latest)
        const byCcy: Record<string, number> = {}
        for (const p of recent) {
          byCcy[p.currency] = (byCcy[p.currency] ?? 0) + parseFloat(p.market_value)
        }
        return byCcy
      })()
    : null

  // ── Points GPS 7 jours ────────────────────────────────────────────────────
  const { data: pts } = useSWR(['/v1/locations/points', sevenDaysAgo], () =>
    api.locations.points
      .list({ start_date: sevenDaysAgo, limit: 5000 })
      .catch(() => [])
  )

  return (
    <motion.div
      variants={stagger}
      initial="initial"
      animate="animate"
      className="grid grid-cols-2 xl:grid-cols-4 gap-3"
    >
      <KpiCard
        label="Solde courant"
        value={balanceNum !== null ? formatCurrency(balance!, balanceCurrency) : '—'}
        sub={checkingAccount?.account_number_masked ?? 'pas de compte'}
        icon={Wallet}
        // Vert UNIQUEMENT si solde positif (sémantique : "ça va bien")
        valueTone={balanceNum !== null && balanceNum > 0 ? 'positive' : 'neutral'}
      />
      <KpiCard
        label="Dépenses · ce mois"
        value={monthlySpending !== null ? formatCurrency(monthlySpending, 'CAD') : '—'}
        sub={
          cc
            ? `${cc.filter((t) => parseFloat(t.amount) > 0).length} achat(s)`
            : '…'
        }
        icon={Activity}
        valueTone="neutral"
      />
      <KpiCard
        label="Portefeuille"
        value={
          portfolio
            ? Object.entries(portfolio)
                .map(([ccy, v]) =>
                  formatCurrency(v, ccy, undefined, { maximumFractionDigits: 0 })
                )
                .join(' · ')
            : '—'
        }
        sub={
          positions?.length
            ? `${positions.length} snapshots`
            : 'aucun snapshot'
        }
        icon={Briefcase}
        valueTone="neutral"
      />
      <KpiCard
        label="GPS · 7 jours"
        value={pts ? pts.length.toLocaleString('fr-CA') : '—'}
        sub={
          pts && pts.length > 0
            ? `${new Set(pts.map((p) => p.timestamp_utc.slice(0, 10))).size} jour(s) couverts`
            : 'pas de data'
        }
        icon={MapPin}
        valueTone="neutral"
      />
    </motion.div>
  )
}

// ── KpiCard ───────────────────────────────────────────────────────────────────

type ValueTone = 'positive' | 'negative' | 'neutral'

function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  valueTone = 'neutral',
}: {
  label: string
  value: string
  sub: string
  icon: LucideIcon
  valueTone?: ValueTone
}) {
  return (
    <motion.div
      variants={staggerItem}
      className="ga-card ga-card-hover px-4 py-3.5"
    >
      {/* Header label + icon */}
      <div className="flex items-center justify-between mb-2.5">
        <span className="metric-label truncate">{label}</span>
        <Icon size={13} className="text-ink-600 shrink-0" aria-hidden="true" />
      </div>

      {/* Valeur principale — taille forte, couleur seulement si sémantique */}
      <div
        className={cn(
          'metric-lg truncate',
          valueTone === 'positive' && 'data-positive',
          valueTone === 'negative' && 'data-negative'
        )}
      >
        {value}
      </div>

      {/* Sous-libellé technique (compte masqué, nb d'achats, etc.) */}
      <div className="text-[10px] text-ink-500 font-mono mt-1.5 truncate">
        {sub}
      </div>
    </motion.div>
  )
}
