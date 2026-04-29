'use client'

/**
 * RecentTransactions — table compacte des dernières transactions (Sprint C).
 *
 * Style Google Analytics : table dense avec hiérarchie typographique forte.
 * Mélange transactions de compte courant + carte de crédit, triées par date.
 *
 * Click sur une ligne → /finances?txn=<id> (TODO C3).
 *
 * Pas de fake data — si l'API ne répond pas, on affiche un état vide.
 */

import useSWR from 'swr'
import Link from 'next/link'
import { ArrowDownLeft, ArrowUpRight, ArrowRight } from 'lucide-react'
import { api } from '@/lib/api'
import { formatCurrency, cn } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────────

/** Transaction unifiée (compte courant + carte de crédit). */
interface UnifiedTxn {
  id: string
  source: 'checking' | 'credit_card'
  date: string         // YYYY-MM-DD
  description: string
  amount: number       // négatif = débit (sortie d'argent), positif = crédit (entrée)
  currency: string
  meta?: string        // ex: "Mastercard 1234" pour CC
}

const DEFAULT_LIMIT = 8

// ── Component ─────────────────────────────────────────────────────────────────

export function RecentTransactions({ limit = DEFAULT_LIMIT }: { limit?: number }) {
  // Compte courant : limit ×2 pour avoir de la marge après merge
  const { data: txns, isLoading: txnsLoading } = useSWR(
    ['/v1/finance/transactions', 'recent', limit],
    () =>
      api.finance.transactions
        .list({ limit: limit * 2 })
        .catch(() => [])
  )

  // Cartes de crédit
  const { data: ccTxns, isLoading: ccLoading } = useSWR(
    ['/v1/finance/credit-card-transactions', 'recent', limit],
    () =>
      api.finance.creditCard
        .list({ limit: limit * 2 })
        .catch(() => [])
  )

  const isLoading = txnsLoading || ccLoading

  // Merge + tri par date desc
  const unified: UnifiedTxn[] = []
  if (txns) {
    for (const t of txns) {
      // débit = sortie (négatif), crédit = entrée (positif)
      const debit = parseFloat(t.debit ?? '0')
      const credit = parseFloat(t.credit ?? '0')
      const amount = credit - debit
      unified.push({
        id: t.id,
        source: 'checking',
        date: t.transaction_date.slice(0, 10),
        description: t.description,
        amount,
        currency: 'CAD',
      })
    }
  }
  if (ccTxns) {
    for (const t of ccTxns) {
      // CC : amount positif = achat (sortie), donc on inverse pour aligner avec checking
      const amount = -parseFloat(t.amount)
      unified.push({
        id: t.id,
        source: 'credit_card',
        date: t.transaction_date.slice(0, 10),
        description: t.description,
        amount,
        currency: 'CAD',
        meta: t.card_number_masked,
      })
    }
  }

  unified.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
  const top = unified.slice(0, limit)

  // ── Rendu ──────────────────────────────────────────────────────────────────

  if (isLoading && unified.length === 0) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-9 skeleton rounded" />
        ))}
      </div>
    )
  }

  if (top.length === 0) {
    return (
      <div className="text-center py-6 text-sm text-ink-500">
        Aucune transaction récente
      </div>
    )
  }

  return (
    <div className="-mx-4 -my-4">
      {/* En-tête colonnes (style GA : très petit, uppercase) */}
      <div className="grid grid-cols-[60px_1fr_auto] gap-3 px-4 py-2 border-b border-ink-800/60 metric-label">
        <span>Date</span>
        <span>Description</span>
        <span className="text-right">Montant</span>
      </div>

      {/* Lignes */}
      <div className="divide-y divide-ink-800/40">
        {top.map((t) => (
          <TransactionRow key={`${t.source}-${t.id}`} txn={t} />
        ))}
      </div>

      {/* Footer : voir tout */}
      <div className="px-4 py-2.5 border-t border-ink-800/60 flex items-center justify-end">
        <Link
          href="/finances"
          className="text-[11px] font-mono text-ink-400 hover:text-accent transition-colors flex items-center gap-1"
        >
          voir toutes les transactions
          <ArrowRight size={11} />
        </Link>
      </div>
    </div>
  )
}

// ── TransactionRow ────────────────────────────────────────────────────────────

function TransactionRow({ txn }: { txn: UnifiedTxn }) {
  const isCredit = txn.amount > 0
  const dateShort = txn.date.slice(5) // MM-DD

  return (
    <div className="grid grid-cols-[60px_1fr_auto] gap-3 px-4 py-2.5 items-center hover:bg-ink-800/30 transition-colors">
      {/* Date compacte */}
      <span className="text-[11px] font-mono text-ink-500 tabular-nums">
        {dateShort}
      </span>

      {/* Description + meta (CC mask) */}
      <div className="min-w-0 flex items-center gap-2">
        {isCredit ? (
          <ArrowDownLeft size={12} className="data-positive shrink-0" aria-label="Crédit" />
        ) : (
          <ArrowUpRight size={12} className="text-ink-500 shrink-0" aria-label="Débit" />
        )}
        <span className="text-[12px] text-ink-200 truncate" title={txn.description}>
          {txn.description}
        </span>
        {txn.source === 'credit_card' && (
          <span className="text-[9px] font-mono text-ink-600 shrink-0 hidden md:inline">
            {txn.meta}
          </span>
        )}
      </div>

      {/* Montant aligné droite, couleur sémantique */}
      <span
        className={cn(
          'text-[12px] font-semibold tabular-nums tracking-tight text-right',
          isCredit ? 'data-positive' : 'text-ink-100'
        )}
      >
        {isCredit ? '+' : ''}{formatCurrency(txn.amount, txn.currency)}
      </span>
    </div>
  )
}
