'use client'

/**
 * Sidebar — navigation principale (Sprint C + mobile).
 *
 * Modes desktop (≥lg):
 *   - Étendu (264 px) : icône + label + sections titrées
 *   - Réduit (60 px)  : icône seule, sections sans titre, tooltip au hover
 *
 * Mode mobile (<lg):
 *   - Hamburger bouton fixed top-left
 *   - Drawer overlay 80% width quand ouvert
 *   - Backdrop cliquable pour fermer
 *   - Auto-close sur navigation
 *
 * Persistance desktop : état dans localStorage (`hub-sidebar-collapsed-v1`).
 */

import { useEffect, useState, type ComponentType } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Sparkles,
  Wallet,
  MapPin,
  Mail,
  Image as ImageIcon,
  Calendar,
  FileText,
  Heart,
  Newspaper,
  Settings,
  Activity,
  Boxes,
  PanelLeftClose,
  PanelLeftOpen,
  Menu,
  X,
  Users,
  CheckSquare,
  Youtube,
  Tv,
  Globe,
  Gamepad2,
  User,
  Clock,
  Bell,
  Download,
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
      { label: 'Hub',        href: '/',         icon: LayoutDashboard },
      { label: 'Mon profil', href: '/me',       icon: User },
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
      { label: 'Contacts',     href: '/contacts',  icon: Users },
      { label: 'Tâches',       href: '/tasks',     icon: CheckSquare },
      { label: 'YouTube',      href: '/youtube',   icon: Youtube },
      { label: 'Streaming',    href: '/streaming', icon: Tv },
      { label: 'Steam',        href: '/steam',     icon: Gamepad2 },
      { label: 'Navigation',   href: '/browser',   icon: Globe },
      { label: 'Actualites',   href: '/news',      icon: Newspaper },
    ],
  },
  {
    title: 'Système',
    items: [
      { label: 'Santé du hub',  href: '/system/health',    icon: Activity },
      { label: 'Scheduler',     href: '/system/scheduler', icon: Clock },
      { label: 'Notifications', href: '/notifications',    icon: Bell },
      { label: 'Exporter',      href: '/export',           icon: Download },
      { label: 'Réglages',      href: '/settings',         icon: Settings },
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
  const [mobileOpen, setMobileOpen] = useState(false)

  // Hydration depuis localStorage (évite mismatch SSR)
  useEffect(() => {
    setCollapsed(loadCollapsed())
    setHydrated(true)
  }, [])

  // Auto-close mobile drawer when route changes
  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  // Lock body scroll when mobile drawer open
  useEffect(() => {
    if (typeof document === 'undefined') return
    document.body.style.overflow = mobileOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [mobileOpen])

  function toggle() {
    setCollapsed((prev) => {
      const next = !prev
      saveCollapsed(next)
      return next
    })
  }

  // Pendant l'hydration, on rend le mode étendu par défaut pour éviter le flash.
  // En mobile (drawer ouvert), on force toujours expanded pour un meilleur UX.
  const isCollapsed = hydrated && collapsed && !mobileOpen

  return (
    <Tooltip.Provider>
      {/* Mobile: hamburger button (visible <lg) */}
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        aria-label="Ouvrir le menu"
        className="lg:hidden fixed top-3 left-3 z-40 w-10 h-10 flex items-center justify-center rounded-lg bg-ink-900 border border-ink-700 text-ink-200 hover:bg-ink-800 transition-colors shadow-lg"
      >
        <Menu size={18} />
      </button>

      {/* Mobile: backdrop (visible <lg quand drawer ouvert) */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
          className="lg:hidden fixed inset-0 z-40 bg-ink-950/70 backdrop-blur-sm animate-fade-in"
        />
      )}

      <aside
        className={cn(
          // Desktop: sticky, integrated layout
          'lg:shrink-0 lg:border-r lg:border-ink-800 lg:bg-ink-900/40 lg:flex lg:flex-col lg:h-screen lg:sticky lg:top-0 lg:transition-[width] lg:duration-200 lg:ease-out lg:translate-x-0',
          isCollapsed ? 'lg:w-[60px]' : 'lg:w-64',
          // Mobile: fixed drawer
          'fixed inset-y-0 left-0 z-50 w-72 bg-ink-900 border-r border-ink-800 flex flex-col transition-transform duration-200 ease-out',
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        {/* Mobile: close button (visible <lg quand drawer ouvert) */}
        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          aria-label="Fermer le menu"
          className="lg:hidden absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-md text-ink-400 hover:text-ink-100 hover:bg-ink-800 transition-colors"
        >
          <X size={16} />
        </button>

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

        {/* ── Avatar + status footer ── */}
        <div
          className={cn(
            'border-t border-ink-800',
            isCollapsed ? 'px-1 py-2' : 'px-3 py-3'
          )}
        >
          {!isCollapsed ? (
            <Link
              href="/settings"
              className="flex items-center gap-2.5 px-1.5 py-1.5 rounded-md hover:bg-ink-800/60 transition-colors mb-1 group"
            >
              <div className="relative shrink-0">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-accent to-info flex items-center justify-center text-[11px] font-bold text-ink-950 shadow-sm">
                  M
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-data-positive border-2 border-ink-900 animate-pulse-slow" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[12px] font-semibold text-ink-100 truncate group-hover:text-accent transition-colors">
                  Marc
                </div>
                <div className="text-[10px] text-ink-500 font-mono truncate">
                  hub up · Lévis QC
                </div>
              </div>
            </Link>
          ) : (
            <Link
              href="/settings"
              className="flex justify-center mb-1"
              aria-label="Profil"
              title="Marc"
            >
              <div className="relative">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-accent to-info flex items-center justify-center text-[11px] font-bold text-ink-950">
                  M
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-data-positive border-2 border-ink-900 animate-pulse-slow" />
              </div>
            </Link>
          )}

          {/* Toggle collapse — desktop only (mobile a son propre X) */}
          <button
            onClick={toggle}
            className={cn(
              'hidden lg:flex w-full items-center justify-center gap-2 py-1.5 rounded-md text-[11px] text-ink-400 hover:text-ink-100 hover:bg-ink-800 transition-colors'
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
