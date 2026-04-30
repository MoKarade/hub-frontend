'use client'

import { Sidebar } from '@/components/sidebar'
import { HubStatus } from '@/components/hub-status'
import {
  Wallet,
  CreditCard,
  TrendingUp,
  RefreshCw,
  LayoutDashboard,
} from 'lucide-react'
import { ComingSoon } from '@/components/coming-soon'
import useSWR from 'swr'
import { useMemo, useState, type ComponentType } from 'react'
import { api, type Account } from '@/lib/api'
import { formatCurrency, formatDate, signedAmount, cn } from '@/lib/utils'

type TabId = 'banking' | 'credit_card' | 'investments' | 'app'

const TABS: { id: TabId; label: string; icon: ComponentType<{ size?: number; className?: string }> }[] = [
  { id: 'banking', label: 'Banque', icon: Wallet },
  { id: 'credit_card', label: 'Carte de crédit', icon: CreditCard },
  { id: 'investments', label: 'Investissement', icon: TrendingUp },
  { id: 'app', label: 'App avancée', icon: LayoutDashboard },
]

export default function FinancesPage() {
  const [tab, setTab] = useState<TabId>('banking')
  const [accountId, setAccountId] = useState<string | undefined>()
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')
  const [search, setSearch] = useState('')

  const { data: accounts, mutate: refetchAccounts } = useSWR(
    '/v1/finance/accounts',
    () => api.finance.accounts.list().catch(() => [] as Account[])
  )

  const filteredAccounts = useMemo(() => {
    if (!accounts) return []
    if (tab === 'banking') return accounts.filter((a) => a.account_type === 'checking' || a.account_type === 'savings')
    if (tab === 'credit_card') return accounts.filter((a) => a.account_type === 'credit_card')
    return accounts.filter((a) => a.account_type === 'investment')
  }, [accounts, tab])

  return (
    <div className="flex min-h-screen">
      <Sidebar />

      <main className="flex-1 px-4 sm:px-6 lg:px-8 pt-16 lg:pt-6 pb-6 max-w-[1400px]">
        <header className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Finances</h1>
            <p className="text-sm text-ink-400">
              Toutes les transactions, par compte et par type · CAD par défaut
            </p>
          </div>
          <button
            onClick={() => refetchAccounts()}
            className="px-3 py-1.5 text-xs font-mono bg-ink-800 border border-ink-700 rounded-md hover:border-ink-600 transition-colors flex items-center gap-2"
          >
            <RefreshCw size={12} />
            Refresh
          </button>
        </header>

        {/* Tabs */}
        <div className="flex items-center gap-1 mb-4 border-b border-ink-800">
          {TABS.map((t) => {
            const Icon = t.icon
            const active = tab === t.id
            return (
              <button
                key={t.id}
                onClick={() => {
                  setTab(t.id)
                  setAccountId(undefined)
                }}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 text-sm border-b-2 -mb-px transition-colors',
                  active
                    ? 'border-accent text-ink-100'
                    : 'border-transparent text-ink-400 hover:text-ink-200'
                )}
              >
                <Icon size={14} />
                {t.label}
              </button>
            )
          })}
        </div>

        {/* Filters */}
        <div className="panel p-4 mb-4 grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-ink-400 mb-1">
              Compte
            </label>
            <select
              value={accountId ?? ''}
              onChange={(e) => setAccountId(e.target.value || undefined)}
              className="w-full bg-ink-800 border border-ink-700 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:border-accent/60"
            >
              <option value="">Tous les comptes</option>
              {filteredAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nickname || a.account_number_masked} · {a.currency}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-ink-400 mb-1">
              Du
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full bg-ink-800 border border-ink-700 rounded-md px-3 py-1.5 text-sm font-mono"
            />
          </div>
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-ink-400 mb-1">
              Au
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full bg-ink-800 border border-ink-700 rounded-md px-3 py-1.5 text-sm font-mono"
            />
          </div>
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-ink-400 mb-1">
              Rechercher
            </label>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="description, marchand..."
              className="w-full bg-ink-800 border border-ink-700 rounded-md px-3 py-1.5 text-sm"
            />
          </div>
        </div>

        {/* Content */}
        <div className="mb-6">
          {tab === 'banking' && (
            <BankingTab
              accountId={accountId}
              startDate={startDate}
              endDate={endDate}
              search={search}
              accounts={accounts}
            />
          )}
          {tab === 'credit_card' && (
            <CreditCardTab
              accountId={accountId}
              startDate={startDate}
              endDate={endDate}
              search={search}
              accounts={accounts}
            />
          )}
          {tab === 'investments' && (
            <InvestmentsTab
              accountId={accountId}
              startDate={startDate}
              endDate={endDate}
              search={search}
              accounts={accounts}
            />
          )}
          {tab === 'app' && (
            <ComingSoon
              icon={LayoutDashboard}
              title="App Finance avancée"
              subtitle="Graphes interactifs · cashflow · catégorisation LLM · abonnements"
              phase="Phase 2+"
              eta="après stabilisation Phase 1"
              description="Mini-app intégrée qui prolonge la table de transactions avec : graphes recharts (cashflow 12 mois, dépenses par catégorie en pie chart), tracking d'abonnements, performance portefeuille Disnat avec benchmarks. Versionnable v1/v2/v3 (ADR-0007)."
              sources={['/v1/finance/* (hub-core API)', 'recharts pour graphes', 'Catégorisation LLM auto']}
              capabilities={[
                "Mes 5 plus grosses catégories de dépenses ce trimestre",
                "Évolution de mon solde sur 12 mois (cashflow)",
                "Performance de mon portefeuille vs S&P 500",
                "Mes abonnements actifs et leur coût annuel total",
              ]}
            />
          )}
        </div>

        <HubStatus />
      </main>
    </div>
  )
}

// ============================================================================
// Banking tab
// ============================================================================

function BankingTab({
  accountId,
  startDate,
  endDate,
  search,
  accounts,
}: {
  accountId?: string
  startDate: string
  endDate: string
  search: string
  accounts?: Account[]
}) {
  const { data, isLoading, error } = useSWR(
    ['/v1/finance/transactions', accountId, startDate, endDate],
    () =>
      api.finance.transactions
        .list({
          account_id: accountId,
          start_date: startDate || undefined,
          end_date: endDate || undefined,
          limit: 500,
        })
        .catch(() => [])
  )

  const filtered = useMemo(() => {
    if (!data) return []
    const q = search.trim().toLowerCase()
    if (!q) return data
    return data.filter((t) => t.description.toLowerCase().includes(q))
  }, [data, search])

  const totalDebit = useMemo(
    () => filtered.reduce((s, t) => s + (t.debit ? parseFloat(t.debit) : 0), 0),
    [filtered]
  )
  const totalCredit = useMemo(
    () => filtered.reduce((s, t) => s + (t.credit ? parseFloat(t.credit) : 0), 0),
    [filtered]
  )

  return (
    <>
      <SummaryRow items={[
        { label: 'Transactions', value: String(filtered.length) },
        { label: 'Débits', value: formatCurrency(totalDebit, 'CAD'), color: 'data-negative' },
        { label: 'Crédits', value: formatCurrency(totalCredit, 'CAD'), color: 'data-positive' },
        { label: 'Net', value: formatCurrency(totalCredit - totalDebit, 'CAD') },
      ]} />

      <div className="panel overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-ink-800/50 text-[11px] uppercase tracking-wider text-ink-400">
            <tr>
              <th className="text-left px-4 py-2 font-medium">Date</th>
              <th className="text-left px-4 py-2 font-medium">Compte</th>
              <th className="text-left px-4 py-2 font-medium">Description</th>
              <th className="text-right px-4 py-2 font-medium">Montant</th>
              <th className="text-right px-4 py-2 font-medium">Solde</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-800/60">
            {isLoading && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-ink-400">
                  Chargement…
                </td>
              </tr>
            )}
            {error && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-danger">
                  Erreur · le hub-core ne répond pas
                </td>
              </tr>
            )}
            {!isLoading && !error && filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-ink-400">
                  Aucune transaction trouvée pour ces filtres.
                </td>
              </tr>
            )}
            {filtered.map((t) => {
              const amount = signedAmount(t.debit, t.credit)
              const account = accounts?.find((a) => a.id === t.account_id)
              return (
                <tr key={t.id} className="hover:bg-ink-800/30 transition-colors">
                  <td className="px-4 py-2 font-mono text-xs text-ink-300">
                    {formatDate(t.transaction_date)}
                  </td>
                  <td className="px-4 py-2 text-xs text-ink-400">
                    {account?.account_number_masked ?? '—'}
                  </td>
                  <td className="px-4 py-2">{t.description}</td>
                  <td
                    className={cn(
                      'px-4 py-2 text-right font-mono tabular-nums',
                      amount >= 0 ? 'data-positive' : 'data-negative'
                    )}
                  >
                    {amount >= 0 ? '+' : ''}
                    {formatCurrency(amount, account?.currency ?? 'CAD')}
                  </td>
                  <td className="px-4 py-2 text-right font-mono tabular-nums text-ink-400">
                    {formatCurrency(t.balance_after, account?.currency ?? 'CAD')}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}

// ============================================================================
// Credit card tab
// ============================================================================

function CreditCardTab({
  accountId,
  startDate,
  endDate,
  search,
  accounts,
}: {
  accountId?: string
  startDate: string
  endDate: string
  search: string
  accounts?: Account[]
}) {
  const { data, isLoading, error } = useSWR(
    ['/v1/finance/credit-card-transactions', accountId, startDate, endDate],
    () =>
      api.finance.creditCard
        .list({
          account_id: accountId,
          start_date: startDate || undefined,
          end_date: endDate || undefined,
          limit: 500,
        })
        .catch(() => [])
  )

  const filtered = useMemo(() => {
    if (!data) return []
    const q = search.trim().toLowerCase()
    if (!q) return data
    return data.filter((t) => t.description.toLowerCase().includes(q))
  }, [data, search])

  const totalAchats = useMemo(
    () => filtered.filter((t) => parseFloat(t.amount) > 0).reduce((s, t) => s + parseFloat(t.amount), 0),
    [filtered]
  )
  const totalPaiements = useMemo(
    () => -filtered.filter((t) => parseFloat(t.amount) < 0).reduce((s, t) => s + parseFloat(t.amount), 0),
    [filtered]
  )

  return (
    <>
      <SummaryRow items={[
        { label: 'Transactions', value: String(filtered.length) },
        { label: 'Achats', value: formatCurrency(totalAchats, 'CAD'), color: 'data-negative' },
        { label: 'Paiements', value: formatCurrency(totalPaiements, 'CAD'), color: 'data-positive' },
        { label: 'Net carte', value: formatCurrency(totalAchats - totalPaiements, 'CAD') },
      ]} />

      <div className="panel overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-ink-800/50 text-[11px] uppercase tracking-wider text-ink-400">
            <tr>
              <th className="text-left px-4 py-2 font-medium">Date</th>
              <th className="text-left px-4 py-2 font-medium">Carte</th>
              <th className="text-left px-4 py-2 font-medium">Description</th>
              <th className="text-right px-4 py-2 font-medium">Cashback</th>
              <th className="text-right px-4 py-2 font-medium">Montant</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-800/60">
            {isLoading && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-ink-400">Chargement…</td>
              </tr>
            )}
            {error && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-danger">
                  Erreur · le hub-core ne répond pas
                </td>
              </tr>
            )}
            {!isLoading && !error && filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-ink-400">
                  Aucune transaction.
                </td>
              </tr>
            )}
            {filtered.map((t) => {
              const amount = parseFloat(t.amount)
              const account = accounts?.find((a) => a.id === t.account_id)
              return (
                <tr key={t.id} className="hover:bg-ink-800/30 transition-colors">
                  <td className="px-4 py-2 font-mono text-xs text-ink-300">{formatDate(t.transaction_date)}</td>
                  <td className="px-4 py-2 font-mono text-[10px] text-ink-400">
                    ****{t.card_number_masked.slice(-4)}
                  </td>
                  <td className="px-4 py-2">{t.description}</td>
                  <td className="px-4 py-2 text-right font-mono text-xs text-ink-400">
                    {t.cashback_rate ? `${(parseFloat(t.cashback_rate) * 100).toFixed(2)} %` : '—'}
                  </td>
                  <td
                    className={cn(
                      'px-4 py-2 text-right font-mono tabular-nums',
                      amount > 0 ? 'data-negative' : 'data-positive'
                    )}
                  >
                    {amount > 0 ? '-' : '+'}
                    {formatCurrency(Math.abs(amount), account?.currency ?? 'CAD')}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}

// ============================================================================
// Investments tab — affiche transactions + positions du dernier statement
// ============================================================================

function InvestmentsTab({
  accountId,
  startDate,
  endDate,
  search,
  accounts,
}: {
  accountId?: string
  startDate: string
  endDate: string
  search: string
  accounts?: Account[]
}) {
  // Note : l'API investment-transactions ne supporte pas start_date/end_date côté
  // serveur (il filtre uniquement par account_id, sub_account_code, symbol,
  // operation, statement_date). On charge donc tout et on filtre côté client
  // — acceptable tant que limit=500 couvre l'historique total.
  const { data: txns, isLoading, error } = useSWR(
    ['/v1/finance/investment-transactions', accountId],
    () =>
      api.finance.investmentTransactions
        .list({ account_id: accountId, limit: 500 })
        .catch(() => [])
  )

  const { data: positions } = useSWR(
    ['/v1/finance/investment-positions', accountId],
    () =>
      api.finance.investmentPositions
        .list({ account_id: accountId, limit: 500 })
        .catch(() => [])
  )

  // Dernier snapshot par sub_account_code
  const latestPositions = useMemo(() => {
    if (!positions || positions.length === 0) return []
    const latestDate = positions.reduce((max, p) => (p.statement_date > max ? p.statement_date : max), '')
    return positions.filter((p) => p.statement_date === latestDate)
  }, [positions])

  const filteredTxns = useMemo(() => {
    if (!txns) return []
    const q = search.trim().toLowerCase()
    let res = txns
    if (q) res = res.filter((t) => t.description.toLowerCase().includes(q) || (t.symbol ?? '').toLowerCase().includes(q))
    if (startDate) res = res.filter((t) => t.transaction_date >= startDate)
    if (endDate) res = res.filter((t) => t.transaction_date <= endDate)
    return res
  }, [txns, search, startDate, endDate])

  const totalValueByCcy = useMemo(() => {
    const acc: Record<string, number> = {}
    for (const p of latestPositions) {
      acc[p.currency] = (acc[p.currency] ?? 0) + parseFloat(p.market_value)
    }
    return acc
  }, [latestPositions])

  return (
    <>
      <SummaryRow items={[
        ...Object.entries(totalValueByCcy).map(([ccy, v]) => ({
          label: `Portefeuille ${ccy}`,
          value: formatCurrency(v, ccy),
        })),
        { label: 'Positions', value: String(latestPositions.length) },
        { label: 'Transactions filtrées', value: String(filteredTxns.length) },
      ]} />

      {/* Positions snapshot */}
      <div className="panel overflow-hidden mb-4">
        <div className="px-4 py-2 bg-ink-800/40 text-xs font-semibold text-ink-300">
          Dernier snapshot des positions
        </div>
        <table className="w-full text-sm">
          <thead className="text-[11px] uppercase tracking-wider text-ink-400">
            <tr>
              <th className="text-left px-4 py-2 font-medium">Symbole</th>
              <th className="text-left px-4 py-2 font-medium">Titre</th>
              <th className="text-right px-4 py-2 font-medium">Quantité</th>
              <th className="text-right px-4 py-2 font-medium">Prix marché</th>
              <th className="text-right px-4 py-2 font-medium">Valeur</th>
              <th className="text-right px-4 py-2 font-medium">% portef.</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-800/60">
            {latestPositions.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-ink-400">
                  Aucun snapshot de position pour ce filtre.
                </td>
              </tr>
            ) : (
              latestPositions.map((p) => (
                <tr key={p.id} className="hover:bg-ink-800/30 transition-colors">
                  <td className="px-4 py-2 font-mono font-semibold">{p.symbol ?? '—'}</td>
                  <td className="px-4 py-2 text-ink-300">{p.description}</td>
                  <td className="px-4 py-2 text-right font-mono">{p.quantity}</td>
                  <td className="px-4 py-2 text-right font-mono tabular-nums">
                    {formatCurrency(p.market_price, p.currency, undefined, { maximumFractionDigits: 4 })}
                  </td>
                  <td className="px-4 py-2 text-right font-mono tabular-nums font-semibold">
                    {formatCurrency(p.market_value, p.currency)}
                  </td>
                  <td className="px-4 py-2 text-right font-mono text-xs text-ink-400">
                    {p.portfolio_pct ? `${p.portfolio_pct} %` : '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Transactions */}
      <div className="panel overflow-hidden">
        <div className="px-4 py-2 bg-ink-800/40 text-xs font-semibold text-ink-300">
          Transactions
        </div>
        <table className="w-full text-sm">
          <thead className="text-[11px] uppercase tracking-wider text-ink-400">
            <tr>
              <th className="text-left px-4 py-2 font-medium">Date</th>
              <th className="text-left px-4 py-2 font-medium">Sous-compte</th>
              <th className="text-left px-4 py-2 font-medium">Opération</th>
              <th className="text-left px-4 py-2 font-medium">Description</th>
              <th className="text-right px-4 py-2 font-medium">Quantité</th>
              <th className="text-right px-4 py-2 font-medium">Montant</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-800/60">
            {isLoading && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-ink-400">Chargement…</td></tr>
            )}
            {error && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-danger">Erreur · le hub-core ne répond pas</td></tr>
            )}
            {!isLoading && !error && filteredTxns.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-ink-400">Aucune transaction.</td></tr>
            )}
            {filteredTxns.map((t) => {
              const amt = t.amount ? parseFloat(t.amount) : 0
              const account = accounts?.find((a) => a.id === t.account_id)
              return (
                <tr key={t.id} className="hover:bg-ink-800/30 transition-colors">
                  <td className="px-4 py-2 font-mono text-xs text-ink-300">{formatDate(t.transaction_date)}</td>
                  <td className="px-4 py-2 font-mono text-[10px] text-ink-400">{t.sub_account_code ?? '—'}</td>
                  <td className="px-4 py-2 text-xs">{t.operation}</td>
                  <td className="px-4 py-2">
                    {t.symbol && <span className="font-mono font-semibold mr-2">{t.symbol}</span>}
                    <span className="text-ink-300">{t.description}</span>
                  </td>
                  <td className="px-4 py-2 text-right font-mono">{t.quantity ?? '—'}</td>
                  <td className={cn('px-4 py-2 text-right font-mono tabular-nums', amt >= 0 ? 'data-positive' : 'data-negative')}>
                    {amt !== 0 ? (amt >= 0 ? '+' : '') + formatCurrency(amt, t.currency ?? account?.currency ?? 'CAD') : '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}

// ============================================================================
// Helpers UI
// ============================================================================

function SummaryRow({ items }: { items: { label: string; value: string; color?: string }[] }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
      {items.map((it) => (
        <div key={it.label} className="ga-card ga-card-hover px-4 py-3">
          <div className="metric-label mb-1.5">{it.label}</div>
          <div className={cn('metric truncate', it.color)}>{it.value}</div>
        </div>
      ))}
    </div>
  )
}
