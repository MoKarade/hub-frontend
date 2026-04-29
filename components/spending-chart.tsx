'use client'

import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import useSWR from 'swr'
import { useMemo } from 'react'
import { api } from '@/lib/api'
import { formatCurrency, formatDateShort } from '@/lib/utils'

/**
 * Bar chart des dépenses quotidiennes (carte de crédit) sur les 30 derniers jours.
 * Source : /v1/finance/credit-card-transactions, filtré sur amount > 0 (achats).
 */
export function SpendingChart() {
  const startDate = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() - 30)
    return d.toISOString().slice(0, 10)
  }, [])

  const { data, isLoading, error } = useSWR(
    ['/v1/finance/credit-card-transactions', 'spending-30d', startDate],
    () =>
      api.finance.creditCard
        .list({ start_date: startDate, limit: 1000 })
        .catch(() => [])
  )

  const series = useMemo(() => {
    if (!data) return []
    // Group by transaction_date, sum positive amounts only
    const byDay: Record<string, number> = {}
    for (const t of data) {
      const amount = parseFloat(t.amount)
      if (amount <= 0) continue
      byDay[t.transaction_date] = (byDay[t.transaction_date] ?? 0) + amount
    }
    return Object.entries(byDay)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([day, amount]) => ({
        day: formatDateShort(day),
        amount: Math.round(amount * 100) / 100,
      }))
  }, [data])

  if (isLoading) {
    return (
      <div className="h-[220px] flex items-center justify-center text-sm text-ink-400">
        Chargement…
      </div>
    )
  }

  if (error) {
    return (
      <div className="h-[220px] flex items-center justify-center text-sm text-danger">
        Erreur · le hub-core ne répond pas
      </div>
    )
  }

  if (series.length === 0) {
    return (
      <div className="h-[220px] flex items-center justify-center text-sm text-ink-400">
        Aucune dépense sur les 30 derniers jours.
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={series} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
        <XAxis
          dataKey="day"
          tick={{ fill: '#5a6572', fontSize: 10 }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          tick={{ fill: '#5a6572', fontSize: 10 }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          contentStyle={{
            background: '#171c25',
            border: '1px solid #2a323e',
            borderRadius: '6px',
            fontSize: '12px',
          }}
          cursor={{ fill: '#1f2630' }}
          formatter={(value: number) => [formatCurrency(value, 'CAD'), 'Dépenses']}
        />
        <Bar dataKey="amount" fill="#5cdb95" radius={[2, 2, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
