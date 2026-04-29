'use client'

import type { ComponentType } from 'react'
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
} from 'lucide-react'
import { cn } from '@/lib/utils'

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
      { label: 'Dashboard', href: '/', icon: LayoutDashboard },
      { label: 'Recherche', href: '/search', icon: Search },
      { label: 'Insights', href: '/insights', icon: Sparkles },
    ],
  },
  {
    title: 'Sources',
    items: [
      { label: 'Finances', href: '/finances', icon: Wallet },
      { label: 'Localisation', href: '/locations', icon: MapPin },
      { label: 'Emails', href: '/emails', icon: Mail },
      { label: 'Photos', href: '/photos', icon: ImageIcon },
      { label: 'Calendrier', href: '/calendar', icon: Calendar },
      { label: 'Documents', href: '/documents', icon: FileText },
      { label: 'Santé', href: '/health', icon: Heart },
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
      { label: 'Réglages', href: '/settings', icon: Settings },
    ],
  },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-64 shrink-0 border-r border-ink-800 bg-ink-900/30 flex flex-col h-screen sticky top-0">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-ink-800">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent to-info flex items-center justify-center shadow-md shadow-accent/20">
            <Boxes size={18} className="text-ink-950" strokeWidth={2.5} />
          </div>
          <div>
            <div className="text-sm font-semibold tracking-tight">Hub perso</div>
            <div className="text-[10px] text-ink-400 font-mono">~/marc</div>
          </div>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-3 overflow-y-auto">
        {SECTIONS.map((section) => (
          <div key={section.title} className="mb-5">
            <div className="px-2 mb-1.5 text-[10px] font-semibold tracking-wider text-ink-400 uppercase">
              {section.title}
            </div>
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const active = pathname === item.href
                const Icon = item.icon
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'flex items-center gap-2.5 px-2 py-1.5 rounded-md text-[13px] transition-colors',
                      active
                        ? 'bg-ink-800 text-ink-100'
                        : 'text-ink-300 hover:text-ink-100 hover:bg-ink-800/50'
                    )}
                  >
                    <Icon size={15} className={active ? 'text-accent' : ''} />
                    <span className="flex-1">{item.label}</span>
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Status footer */}
      <div className="px-4 py-3 border-t border-ink-800 text-[11px] text-ink-400 font-mono">
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse-slow" />
          <span>hub up · 2m ago</span>
        </div>
      </div>
    </aside>
  )
}
