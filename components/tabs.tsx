'use client'

/**
 * Tabs — composant réutilisable pour les pages avec sections internes.
 *
 * Pattern Google Analytics : underline horizontale + transition smooth.
 * URL state via ?tab=xxx (Marc peut bookmarker un tab spécifique).
 *
 * Usage:
 *   <Tabs
 *     items={[
 *       { id: 'overview', label: 'Vue', icon: LayoutDashboard },
 *       { id: 'transactions', label: 'Transactions', icon: List },
 *     ]}
 *   />
 */

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface TabItem {
  id: string
  label: string
  icon?: LucideIcon
  /** Badge optionnel à droite du label (ex: count). */
  badge?: string | number
}

export interface TabsProps {
  items: TabItem[]
  /** Tab actif par défaut si pas de ?tab= dans l'URL. */
  defaultId?: string
  /** Param URL utilisé. Default: 'tab'. */
  paramKey?: string
  /** Si true, scroll horizontal sur mobile au lieu de wrap. */
  scrollOnMobile?: boolean
}

export function Tabs({ items, defaultId, paramKey = 'tab', scrollOnMobile = true }: TabsProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const activeId = searchParams.get(paramKey) ?? defaultId ?? items[0]?.id

  function handleClick(id: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set(paramKey, id)
    router.push(`${pathname}?${params.toString()}`, { scroll: false })
  }

  return (
    <div
      role="tablist"
      className={cn(
        'flex border-b border-ink-800 mb-4 -mx-1',
        scrollOnMobile && 'overflow-x-auto'
      )}
    >
      {items.map((item) => {
        const Icon = item.icon
        const active = activeId === item.id
        return (
          <button
            key={item.id}
            role="tab"
            aria-selected={active}
            onClick={() => handleClick(item.id)}
            className={cn(
              'inline-flex items-center gap-2 px-3 py-2.5 text-sm border-b-2 -mb-px whitespace-nowrap transition-colors shrink-0',
              active
                ? 'border-accent text-ink-100'
                : 'border-transparent text-ink-400 hover:text-ink-200 hover:border-ink-700'
            )}
          >
            {Icon && <Icon size={14} className={active ? 'text-accent' : ''} />}
            <span>{item.label}</span>
            {item.badge !== undefined && (
              <span className={cn(
                'text-[10px] font-mono px-1.5 py-0.5 rounded',
                active ? 'bg-accent/15 text-accent' : 'bg-ink-800 text-ink-400'
              )}>
                {item.badge}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

/** Hook pour récupérer le tab actif depuis l'URL. */
export function useActiveTab(items: TabItem[], paramKey = 'tab', defaultId?: string): string {
  const searchParams = useSearchParams()
  const activeId = searchParams.get(paramKey) ?? defaultId ?? items[0]?.id
  return activeId
}
