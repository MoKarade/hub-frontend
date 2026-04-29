'use client'

/**
 * Sidebar — navigation principale (Sprint C).
 *
 * Modes :
 *   - Étendu (264 px) : icône + label + sections titrées
 *   - Réduit (60 px)  : icône seule, sections sans titre, tooltip au hover
 *
 * Persistance : état dans localStorage (`hub-sidebar-collapsed-v1`).
 * Le toggle est en bas de la sidebar (chevron).
 *
 * Mobile (<lg) : la sidebar reste fixe pour l'instant. Phase responsive
 * (hamburger) sera traitée plus tard dans le sprint.
 */

import { useEffect, useState, type ComponentType } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Search,
  Sparkles,
  Wallet,
  MapPin,
  Mail,
  Image as ImageIcon,
  Calendar,
  FileText,
  Heart,
  Settings,
  Activity,
  Boxes,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react'
import * as Tooltip from '@radix-ui/react-tooltip'
import { cn } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────────

type NavItem = {
  label: string
  href: string
  icon: ComponentType<{ size?: number; className?: string }>
}

type NavSection = {
  title: string
  items: NavItem[]
}

const SECTIONS: NavSection[] = [
  {
    title: 'Vue d\'ensemble',
    items: [
      { label: 'Dashboard',  href: '/',         icon: LayoutDashboard },
      { label: 'Recherche',  href: '/search',   icon: Search },
      { label: 'Insights',   href: '/insights', icon: Sparkles },
    ],
  },
  {
    title: 'Sources',
    items: [
      { label: 'Finances',     href: '/finances',  icon: Wallet },
      { label: 'Localisation', href: '/locations', icon: MapPin },
      { label: 'Emails',       href: '/emails',    icon: Mail },
      { label: 'Photos',       href: '/photos',    icon: ImageIcon },
      { label: 'Calendrier',   href: '/calendar',  icon: Calendar },
      { label: 'Documents',    href: '/documents', icon: FileText },
      { label: 'Santé',        href: '/health',    icon: Heart },
    ],
  },
  {
    title: 'Mes apps',
    items: [
      { label: 'Trajets', href: '/apps/trajets', icon: MapPin },
      { label: 'Finance', href: '/apps/finance', icon: Wallet },
    ],
  },
  {
    title: 'Système',
    items: [
      { label: 'Santé du hub', href: '/system/health', icon: Activity },
      { label: 'Réglages',     href: '/settings',      icon: Settings },
    ],
  },
]

// ── Storage ───────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'hub-sidebar-collapsed-v1'

function loadCollapsed(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

function saveCollapsed(value: boolean): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, value ? '1' : '0')
  } catch {
    // ignore
  }
}

// ── NavLink ──────────────────────────────────────────────────────────────────

interface NavLinkProps {
  item: NavItem
  active: boolean
  collapsed: boolean
}

function NavLink({ item, active, collapsed }: NavLinkProps) {
  const Icon = item.icon

  const linkContent = (
    <Link
      href={item.href}
      className={cn(
        'flex items-center gap-2.5 rounded-md text-[13px] transition-colors',
        collapsed ? 'justify-center px-0 py-2 mx-1' : 'px-2 py-1.5',
        active
          ? 'bg-ink-800 text-ink-100'
          : 'text-ink-300 hover:text-ink-100 hover:bg-ink-800/50'
      )}
      aria-label={collapsed ? item.label : undefined}
    >
      <Icon size={15} className={active ? 'text-accent' : ''} />
      {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
    </Link>
  )

  // Tooltip uniquement en mode réduit (sinon le label est déjà visible)
  if (!collapsed) return linkContent

  return (
    <Tooltip.Root delayDuration={150}>
      <Tooltip.Trigger asChild>{linkContent}</Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          side="right"
          sideOffset={8}
          className="bg-ink-800 border border-ink-700 px-2 py-1 rounded text-[12px] text-ink-100 shadow-lg z-50"
        >
          {item.label}
          <Tooltip.Arrow className="fill-ink-800" />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  )
}

// ── Sidebar ───────────────────────────────────────────────────────────────────

export function Sidebar() {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const [hydrated, setHydrated] = useState(false)

  // Hydration depuis localStorage (évite mismatch SSR)
  useEffect(() => {
    setCollapsed(loadCollapsed())
    setHydrated(true)
  }, [])

  function toggle() {
    setCollapsed((prev) => {
      const next = !prev
      saveCollapsed(next)
      return next
    })
  }

  // Pendant l'hydration, on rend le mode étendu par défaut pour éviter le flash
  const isCollapsed = hydrated && collapsed

  return (
    <Tooltip.Provider>
      <aside
        className={cn(
          'shrink-0 border-r border-ink-800 bg-ink-900/40 flex flex-col h-screen sticky top-0 transition-[width] duration-200 ease-out',
          isCollapsed ? 'w-[60px]' : 'w-64'
        )}
      >
        {/* ── Logo ── */}
        <div
          className={cn(
            'border-b border-ink-800 flex items-center',
            isCollapsed ? 'justify-center py-4' : 'px-5 py-5'
          )}
        >
          <Link
            href="/"
            className={cn(
              'flex items-center group',
              isCollapsed ? '' : 'gap-2.5'
            )}
            aria-label="Hub perso — accueil"
          >
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent to-info flex items-center justify-center shadow-md shadow-accent/20 shrink-0">
              <Boxes size={18} className="text-ink-950" strokeWidth={2.5} />
            </div>
            {!isCollapsed && (
              <div className="min-w-0">
                <div className="text-sm font-semibold tracking-tight">Hub perso</div>
                <div className="text-[10px] text-ink-400 font-mono">~/marc</div>
              </div>
            )}
          </Link>
        </div>

        {/* ── Nav ── */}
        <nav
          className={cn(
            'flex-1 py-3 overflow-y-auto overflow-x-hidden',
            isCollapsed ? 'px-1' : 'px-3'
          )}
          aria-label="Navigation principale"
        >
          {SECTIONS.map((section) => (
            <div key={section.title} className="mb-5">
              {!isCollapsed && (
                <div className="px-2 mb-1.5 section-title">
                  {section.title}
                </div>
              )}
              {/* Séparateur subtil entre sections en mode réduit */}
              {isCollapsed && (
                <div className="mx-3 mb-2 border-t border-ink-800/60" />
              )}
              <div className="space-y-0.5">
                {section.items.map((item) => (
                  <NavLink
                    key={item.href}
                    item={item}
                    active={pathname === item.href}
                    collapsed={isCollapsed}
                  />
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* ── Status footer ── */}
        <div
          className={cn(
            'border-t border-ink-800',
            isCollapsed ? 'px-1 py-2' : 'px-4 py-3'
          )}
        >
          {!isCollapsed && (
            <div className="text-[11px] text-ink-400 font-mono mb-2">
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse-slow" />
                <span>hub up · 2m ago</span>
              </div>
            </div>
          )}

          {/* Toggle collapse */}
          <button
            onClick={toggle}
            className={cn(
              'w-full flex items-center justify-center gap-2 py-1.5 rounded-md text-[11px] text-ink-400 hover:text-ink-100 hover:bg-ink-800 transition-colors'
            )}
            aria-label={isCollapsed ? 'Étendre la sidebar' : 'Réduire la sidebar'}
            title={isCollapsed ? 'Étendre' : 'Réduire'}
          >
            {isCollapsed ? (
              <PanelLeftOpen size={14} />
            ) : (
              <>
                <PanelLeftClose size={14} />
                <span>Réduire</span>
              </>
            )}
          </button>
        </div>
      </aside>
    </Tooltip.Provider>
  )
}
