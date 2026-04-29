import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

type AppTileProps = {
  name: string
  description: string
  href: string
  versions: { id: string; isLive?: boolean }[]
  icon: React.ComponentType<{ size?: number; className?: string }>
  accentColor?: string
}

export function AppTile({
  name,
  description,
  href,
  versions,
  icon: Icon,
  accentColor = 'bg-accent/15 text-accent',
}: AppTileProps) {
  return (
    <Link
      href={href}
      className="panel panel-hover p-4 group flex flex-col gap-3 relative overflow-hidden"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2.5">
          <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center', accentColor)}>
            <Icon size={18} />
          </div>
          <div>
            <div className="text-sm font-semibold">{name}</div>
            <div className="text-xs text-ink-400">{description}</div>
          </div>
        </div>
        <ChevronRight size={16} className="text-ink-500 group-hover:text-ink-300 transition-colors mt-1" />
      </div>

      <div className="flex items-center gap-1 text-[11px] font-mono mt-auto">
        {versions.length === 0 ? (
          <span className="text-ink-500">pas encore déployée</span>
        ) : (
          <>
            <span className="text-ink-500">versions:</span>
            {versions.map((v) => (
              <span
                key={v.id}
                className={cn(
                  'px-1.5 py-0.5 rounded',
                  v.isLive
                    ? 'bg-accent/20 text-accent border border-accent/30'
                    : 'bg-ink-800 text-ink-400 border border-ink-700'
                )}
              >
                {v.id}
                {v.isLive && ' ●'}
              </span>
            ))}
          </>
        )}
      </div>
    </Link>
  )
}
