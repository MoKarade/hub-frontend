'use client'

/**
 * Bottom navigation bar mobile-only.
 *
 * Visible uniquement sur mobile (< lg breakpoint).
 * Touch targets >=48px (Material Design + Apple HIG recommendations).
 * 5 raccourcis vers les pages les plus utilisees.
 */

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Map, Sparkles, MessageSquare, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'

const ITEMS = [
  { href: '/',          label: 'Accueil',  icon: Home          },
  { href: '/locations', label: 'Carte',    icon: Map           },
  { href: '/insights',  label: 'Insights', icon: Sparkles      },
  { href: '/search',    label: 'IA',       icon: MessageSquare },
  { href: '/settings',  label: 'Régl.',    icon: Settings      },
]

export function MobileBottomNav() {
  const pathname = usePathname()

  return (
    <nav
      aria-label="Navigation mobile"
      className={cn(
        // Visible uniquement sur mobile (< lg)
        'lg:hidden fixed bottom-0 inset-x-0 z-30',
        // Safe-area iOS (notch + home indicator)
        'pb-[env(safe-area-inset-bottom)]',
        // Style fond
        'bg-ink-900/95 backdrop-blur-md border-t border-ink-800',
      )}
      style={{
        // Hauteur min en accord touch targets
        minHeight: 'calc(56px + env(safe-area-inset-bottom))',
      }}
    >
      <ul className="flex justify-around items-stretch">
        {ITEMS.map((item) => {
          const Icon = item.icon
          // Active si pathname commence par href (sauf '/' qui doit etre exact)
          const isActive =
            item.href === '/'
              ? pathname === '/'
              : pathname.startsWith(item.href)
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  // Touch target 48x48 minimum + flex column compact
                  'flex flex-col items-center justify-center gap-0.5 py-2',
                  'min-h-[56px] active:bg-ink-800/80 transition-colors',
                  // Couleurs selon active
                  isActive ? 'text-accent' : 'text-ink-400',
                )}
              >
                <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
                <span
                  className={cn(
                    'text-[10px] font-medium leading-tight',
                    isActive && 'font-bold',
                  )}
                >
                  {item.label}
                </span>
                {/* Indicateur actif sous l'icone */}
                {isActive && (
                  <span
                    aria-hidden="true"
                    className="absolute bottom-0 h-0.5 w-8 rounded-full bg-accent"
                  />
                )}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
