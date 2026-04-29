import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Formatte une devise. Marc est au Québec → CAD par défaut, locale fr-CA.
 * Accepte un `string` (Decimal sérialisé par Pydantic) ou un `number`.
 */
export function formatCurrency(
  amount: number | string | null | undefined,
  currency: string = 'CAD',
  locale: string = 'fr-CA',
  options: { maximumFractionDigits?: number } = {}
): string {
  if (amount === null || amount === undefined) return '—'
  const n = typeof amount === 'string' ? parseFloat(amount) : amount
  if (Number.isNaN(n)) return '—'
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    maximumFractionDigits: options.maximumFractionDigits ?? 2,
  }).format(n)
}

/** Formatte un nombre simple (ex: quantités de titres). */
export function formatNumber(
  n: number | string | null | undefined,
  options: { maximumFractionDigits?: number } = {}
): string {
  if (n === null || n === undefined) return '—'
  const x = typeof n === 'string' ? parseFloat(n) : n
  if (Number.isNaN(x)) return '—'
  return new Intl.NumberFormat('fr-CA', {
    maximumFractionDigits: options.maximumFractionDigits ?? 2,
  }).format(x)
}

/** Formatte une date YYYY-MM-DD en "15 mars 2026". */
export function formatDate(d: Date | string | null | undefined): string {
  if (!d) return '—'
  const date = typeof d === 'string' ? new Date(d) : d
  return date.toLocaleDateString('fr-CA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

/** Format compact d'une date (ex: "15 mars"). */
export function formatDateShort(d: Date | string | null | undefined): string {
  if (!d) return '—'
  const date = typeof d === 'string' ? new Date(d) : d
  return date.toLocaleDateString('fr-CA', { month: 'short', day: 'numeric' })
}

export function formatRelative(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const diff = Date.now() - d.getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return "à l'instant"
  if (minutes < 60) return `il y a ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `il y a ${hours} h`
  const days = Math.floor(hours / 24)
  if (days < 7) return `il y a ${days} j`
  return d.toLocaleDateString('fr-CA')
}

/**
 * Détermine le signe et le montant absolu d'une transaction (compte courant).
 * Retourne `+credit` si la transaction est un credit, `-debit` sinon.
 */
export function signedAmount(
  debit: string | null,
  credit: string | null
): number {
  if (credit !== null) return parseFloat(credit)
  if (debit !== null) return -parseFloat(debit)
  return 0
}
