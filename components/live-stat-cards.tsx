'use client'

/**
 * LiveStatCards — 4 KPI cards branchées sur les vrais endpoints du hub-core.
 * Pas de fake data — si l'API ne répond pas, on affiche "—".
 *
 * Sprint A : stagger animation au montage + hover lift sur chaque card.
 * Sprint B : pulse visuel quand un événement SSE arrive.
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
      <StatCard
        label="Solde courant"
        value={balance !== null ? formatCurrency(balance, balanceCurrency) : '—'}
        sub={checkingAccount?.account_number_masked ?? 'pas de compte'}
        icon={Wallet}
        trend={balance !== null && parseFloat(balance) > 0 ? 'positive' : 'neutral'}
      />
      <StatCard
        label="Dépenses · ce mois"
        value={monthlySpending !== null ? formatCurrency(monthlySpending, 'CAD') : '—'}
        sub={
          cc
            ? `${cc.filter((t) => parseFloat(t.amount) > 0).length} achat(s)`
            : '…'
        }
        icon={Activity}
        trend="neutral"
      />
      <StatCard
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
        trend={portfolio ? 'positive' : 'neutral'}
      />
      <StatCard
        label="GPS · 7 derniers jours"
        value={pts ? pts.length.toLocaleString('fr-CA') : '—'}
        sub={
          pts && pts.length > 0
            ? `${new Set(pts.map((p) => p.timestamp_utc.slice(0, 10))).size} jour(s)`
            : 'pas de data'
        }
        icon={MapPin}
        trend="neutral"
      />
    </motion.div>
  )
}

// ── StatCard (interne) ────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  trend = 'neutral',
}: {
  label: string
  value: string
  sub: string
  icon: LucideIcon
  trend?: 'positive' | 'negative' | 'neutral'
}) {
  return (
    <motion.div
      variants={staggerItem}
      whileHover={{
        y: -3,
        boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
        transition: { duration: 0.15, ease: 'easeOut' },
      }}
      className="panel panel-hover p-4 cursor-default"
    >
      <div className="flex items-start justify-between mb-3">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-400">
          {label}
        </span>
        <Icon size={13} className="text-ink-600 shrink-0" />
      </div>
      <div
        className={cn(
          'text-xl font-semibold tabular-nums tracking-tight truncate',
          trend === 'positive' && 'text-accent',
          trend === 'negative' && 'text-danger',
          trend === 'neutral' && 'text-ink-100'
        )}
      >
        {value}
      </div>
      <div className="text-[10px] text-ink-500 font-mono mt-1 truncate">{sub}</div>
    </motion.div>
  )
}
