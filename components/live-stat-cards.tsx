'use client'

import useSWR from 'swr'
import { Wallet, Activity, MapPin, Briefcase } from 'lucide-react'
import { api } from '@/lib/api'
import { formatCurrency, cn } from '@/lib/utils'

/**
 * 4 stat cards branchés sur les vrais endpoints du hub-core.
 * Pas de fake data — si l'API ne répond pas, on affiche "—".
 *
 * - Solde compte courant : dernier `balance_after` du compte EOP
 * - Dépenses carte de crédit (mois courant) : sum amount > 0
 * - Valeur portefeuille (dernier snapshot) : sum market_value par devise
 * - Points GPS (7 derniers jours) : count
 */
export function LiveStatCards() {
  const today = new Date()
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
    .toISOString()
    .slice(0, 10)
  const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 3600 * 1000)
    .toISOString()
    .slice(0, 10)

  // Solde courant
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

  // Dépenses carte de crédit ce mois
  const { data: cc } = useSWR(
    ['/v1/finance/credit-card-transactions', 'month', monthStart],
    () =>
      api.finance.creditCard
        .list({ start_date: monthStart, limit: 500 })
        .catch(() => [])
  )
  const monthlySpending =
    cc?.filter((t) => parseFloat(t.amount) > 0)
      .reduce((s, t) => s + parseFloat(t.amount), 0) ?? null

  // Valeur portefeuille
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

  // Points GPS 7 jours
  const { data: pts } = useSWR(['/v1/locations/points', sevenDaysAgo], () =>
    api.locations.points
      .list({ start_date: sevenDaysAgo, limit: 5000 })
      .catch(() => [])
  )

  return (
    <section className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
      <Card
        label="Solde courant"
        value={balance !== null ? formatCurrency(balance, balanceCurrency) : '—'}
        sub={checkingAccount?.account_number_masked ?? 'pas de compte'}
        icon={Wallet}
      />
      <Card
        label="Dépenses (ce mois)"
        value={monthlySpending !== null ? formatCurrency(monthlySpending, 'CAD') : '—'}
        sub={cc ? `${cc.filter((t) => parseFloat(t.amount) > 0).length} achat(s)` : '…'}
        icon={Activity}
      />
      <Card
        label="Portefeuille"
        value={
          portfolio
            ? Object.entries(portfolio)
                .map(([ccy, v]) => formatCurrency(v, ccy, undefined, { maximumFractionDigits: 0 }))
                .join(' · ')
            : '—'
        }
        sub={positions?.length ? `${positions.length} snapshots` : 'aucun snapshot'}
        icon={Briefcase}
      />
      <Card
        label="Points GPS · 7j"
        value={pts ? pts.length.toLocaleString('fr-CA') : '—'}
        sub={pts && pts.length > 0 ? new Set(pts.map((p) => p.timestamp_utc.slice(0, 10))).size + ' jour(s)' : 'pas de data'}
        icon={MapPin}
      />
    </section>
  )
}

function Card({
  label,
  value,
  sub,
  icon: Icon,
}: {
  label: string
  value: string
  sub: string
  icon: React.ComponentType<{ size?: number; className?: string }>
}) {
  return (
    <div className={cn('panel panel-hover p-4 relative')}>
      <div className="flex items-start justify-between mb-2">
        <div className="text-xs text-ink-400">{label}</div>
        <Icon size={14} className="text-ink-500" />
      </div>
      <div className="text-2xl font-semibold tabular-nums tracking-tight truncate">
        {value}
      </div>
      <div className="text-[10px] text-ink-500 font-mono mt-1 truncate">{sub}</div>
    </div>
  )
}
