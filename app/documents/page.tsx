'use client'

import { Sidebar } from '@/components/sidebar'
import { HubStatus } from '@/components/hub-status'
import {
  FileText,
  RefreshCw,
  Loader2,
  Search,
  Star,
  Users,
  ExternalLink,
  HardDrive,
  Image as ImageIcon,
  FileSpreadsheet,
  Presentation,
  Folder,
  FileCode,
  FileVideo,
  FileAudio,
  type LucideIcon,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import useSWR, { mutate as swrMutate } from 'swr'
import { api, type DriveFileItem, type DriveStatsResponse } from '@/lib/api'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'

interface CategoryDef {
  id: string
  label: string
  icon: LucideIcon
  color: string
  match: (mime: string, name?: string | null) => boolean
}

const CATEGORIES: CategoryDef[] = [
  {
    id: 'doc',
    label: 'Documents',
    icon: FileText,
    color: 'text-info',
    match: (m) =>
      m === 'application/vnd.google-apps.document' ||
      m === 'application/pdf' ||
      m === 'application/msword' ||
      m.includes('wordprocessingml'),
  },
  {
    id: 'sheet',
    label: 'Feuilles',
    icon: FileSpreadsheet,
    color: 'text-data-positive',
    match: (m) =>
      m === 'application/vnd.google-apps.spreadsheet' ||
      m.includes('spreadsheetml') ||
      m === 'text/csv',
  },
  {
    id: 'slide',
    label: 'Présentations',
    icon: Presentation,
    color: 'text-warn',
    match: (m) =>
      m === 'application/vnd.google-apps.presentation' || m.includes('presentationml'),
  },
  {
    id: 'image',
    label: 'Images',
    icon: ImageIcon,
    color: 'text-accent',
    match: (m) => m.startsWith('image/'),
  },
  {
    id: 'video',
    label: 'Vidéos',
    icon: FileVideo,
    color: 'text-data-negative',
    match: (m) => m.startsWith('video/'),
  },
  {
    id: 'audio',
    label: 'Audio',
    icon: FileAudio,
    color: 'text-purple-400',
    match: (m) => m.startsWith('audio/'),
  },
  {
    id: 'code',
    label: 'Code',
    icon: FileCode,
    color: 'text-info',
    match: (m, name) =>
      m === 'text/x-python' ||
      m === 'application/json' ||
      m === 'text/javascript' ||
      Boolean(name?.match(/\.(py|js|ts|tsx|jsx|java|cpp|c|go|rs|rb|sh|ps1)$/i)),
  },
  {
    id: 'folder',
    label: 'Dossiers',
    icon: Folder,
    color: 'text-ink-300',
    match: (m) => m === 'application/vnd.google-apps.folder',
  },
]

function categorize(file: DriveFileItem): CategoryDef {
  for (const cat of CATEGORIES) {
    if (cat.match(file.mime_type, file.name)) return cat
  }
  return {
    id: 'other',
    label: 'Autres',
    icon: FileText,
    color: 'text-ink-400',
    match: () => true,
  }
}

export default function DocumentsPage() {
  const [syncing, setSyncing] = useState(false)
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState<string | null>(null)

  const { data: files } = useSWR<DriveFileItem[]>(
    ['drive-files', search],
    () => api.drive.files({ q: search.trim() || undefined, limit: 500 })
  )
  const { data: stats } = useSWR<DriveStatsResponse>('drive-stats', () => api.drive.stats())

  async function handleSync() {
    setSyncing(true)
    try {
      const res = await api.drive.sync({ max_results: 5000 })
      toast.success(`Sync OK · ${res.ingested} nouveaux, ${res.updated} màj`, {
        description: `${res.duration_seconds}s`,
      })
      void swrMutate(['drive-files', search])
      void swrMutate('drive-stats')
    } catch (err) {
      toast.apiError(err, 'Sync Drive échoué')
    } finally {
      setSyncing(false)
    }
  }

  // Compte par categorie pour les pills
  const byCategory = useMemo(() => {
    const counts = new Map<string, { count: number; size: number }>()
    for (const f of files ?? []) {
      const cat = categorize(f)
      const cur = counts.get(cat.id) ?? { count: 0, size: 0 }
      counts.set(cat.id, {
        count: cur.count + 1,
        size: cur.size + (f.size_bytes ?? 0),
      })
    }
    return counts
  }, [files])

  const visibleFiles = useMemo(() => {
    if (!files) return []
    if (!activeCategory) return files
    return files.filter((f) => categorize(f).id === activeCategory)
  }, [files, activeCategory])

  // Top 5 plus gros fichiers
  const biggestFiles = useMemo(() => {
    if (!files) return []
    return [...files]
      .filter((f) => f.size_bytes !== null)
      .sort((a, b) => (b.size_bytes ?? 0) - (a.size_bytes ?? 0))
      .slice(0, 5)
  }, [files])

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 px-4 sm:px-6 lg:px-8 pt-16 lg:pt-6 pb-6 max-w-[1400px] flex flex-col">
        <header className="mb-4 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Documents</h1>
            <p className="text-sm text-ink-400">
              Google Drive · catégorisé · recherche par nom
            </p>
          </div>
          <button
            type="button"
            onClick={handleSync}
            disabled={syncing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-accent text-ink-950 text-xs font-semibold hover:bg-accent-light transition-colors disabled:opacity-50"
          >
            {syncing ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
            {syncing ? 'Sync…' : 'Sync Drive'}
          </button>
        </header>

        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
            <Kpi label="Total" value={stats.total} icon={FileText} color="text-ink-100" />
            <Kpi label="Étoilés" value={stats.starred} icon={Star} color="text-warn" />
            <Kpi label="Partagés" value={stats.shared} icon={Users} color="text-info" />
            <Kpi
              label="Taille"
              value={(stats.total_size_bytes / 1_073_741_824).toFixed(2)}
              icon={HardDrive}
              color="text-accent"
              suffix="GB"
            />
          </div>
        )}

        {/* Top 5 plus gros */}
        {biggestFiles.length > 0 && (
          <div className="ga-card p-3 mb-3">
            <div className="text-xs font-semibold text-ink-200 mb-2 flex items-center gap-1.5">
              <HardDrive size={11} className="text-accent" />
              Top 5 plus volumineux
            </div>
            <div className="space-y-1">
              {biggestFiles.map((f) => {
                const cat = categorize(f)
                const Icon = cat.icon
                const pctOfTotal =
                  stats?.total_size_bytes && stats.total_size_bytes > 0
                    ? ((f.size_bytes ?? 0) / stats.total_size_bytes) * 100
                    : 0
                return (
                  <a
                    key={f.id}
                    href={f.web_view_link ?? '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 hover:bg-ink-800/40 rounded px-1 py-1 transition-colors"
                  >
                    <Icon size={11} className={cn('shrink-0', cat.color)} />
                    <span className="text-xs text-ink-200 truncate flex-1">
                      {f.name ?? '(sans nom)'}
                    </span>
                    <div className="text-[10px] font-mono text-ink-500 shrink-0 w-20 text-right">
                      {formatSize(f.size_bytes ?? 0)}
                    </div>
                    <div className="w-12 h-1 bg-ink-800 rounded overflow-hidden shrink-0">
                      <div
                        className="h-full bg-accent"
                        style={{ width: `${Math.min(100, pctOfTotal)}%` }}
                      />
                    </div>
                  </a>
                )
              })}
            </div>
          </div>
        )}

        {/* Categories pills */}
        {files && files.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            <button
              type="button"
              onClick={() => setActiveCategory(null)}
              className={cn(
                'inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] border transition-colors',
                !activeCategory
                  ? 'bg-accent/15 border-accent/30 text-accent'
                  : 'bg-ink-800 border-ink-700 text-ink-300'
              )}
            >
              Tous
              <span className="font-mono text-[10px] text-ink-500">{files.length}</span>
            </button>
            {CATEGORIES.map((cat) => {
              const data = byCategory.get(cat.id)
              if (!data || data.count === 0) return null
              const Icon = cat.icon
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setActiveCategory(cat.id === activeCategory ? null : cat.id)}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] border transition-colors',
                    cat.id === activeCategory
                      ? 'bg-accent/15 border-accent/30 text-accent'
                      : 'bg-ink-800 border-ink-700 text-ink-300 hover:text-ink-100'
                  )}
                >
                  <Icon size={10} className={cat.color} />
                  {cat.label}
                  <span className="font-mono text-[10px] text-ink-500">{data.count}</span>
                </button>
              )
            })}
          </div>
        )}

        <div className="relative mb-3">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Recherche par nom de fichier…"
            className="w-full bg-ink-800 border border-ink-700 rounded-md pl-7 pr-3 py-1.5 text-xs focus:outline-none focus:border-accent/60"
          />
        </div>

        <div className="flex-1 min-h-0">
          {visibleFiles.length === 0 && files && files.length === 0 && (
            <div className="ga-card p-6 text-center">
              <FileText size={24} className="text-ink-500 mx-auto mb-2" />
              <div className="text-sm text-ink-300">Aucun fichier</div>
              <p className="text-xs text-ink-500 mt-1">
                Click &laquo;&nbsp;Sync Drive&nbsp;&raquo; pour importer
              </p>
            </div>
          )}
          {visibleFiles.length > 0 && (
            <div className="ga-card divide-y divide-ink-700/30 max-h-[60vh] overflow-y-auto">
              {visibleFiles.slice(0, 200).map((f) => (
                <FileRow key={f.id} file={f} />
              ))}
              {visibleFiles.length > 200 && (
                <div className="px-3 py-2 text-[11px] text-ink-500 text-center">
                  +{visibleFiles.length - 200} autres (affine la recherche pour voir)
                </div>
              )}
            </div>
          )}
        </div>

        <div className="mt-auto pt-4">
          <HubStatus />
        </div>
      </main>
    </div>
  )
}

function Kpi({
  label,
  value,
  icon: Icon,
  color,
  suffix,
}: {
  label: string
  value: number | string
  icon: LucideIcon
  color: string
  suffix?: string
}) {
  return (
    <div className="ga-card p-3">
      <div className="flex items-center gap-1.5 mb-1">
        <Icon size={11} className={color} />
        <div className="metric-label">{label}</div>
      </div>
      <div className={cn('metric truncate', color)}>
        {typeof value === 'number' ? value.toLocaleString('fr-CA') : value}
        {suffix && <span className="text-xs ml-0.5">{suffix}</span>}
      </div>
    </div>
  )
}

function FileRow({ file }: { file: DriveFileItem }) {
  const cat = categorize(file)
  const Icon = cat.icon
  const sizeStr = file.size_bytes ? formatSize(file.size_bytes) : 'Google'
  return (
    <a
      href={file.web_view_link ?? '#'}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 px-3 py-2 hover:bg-ink-800/40 transition-colors"
    >
      <div className={cn('shrink-0', cat.color)}>
        <Icon size={14} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="text-sm text-ink-200 truncate">{file.name ?? '(sans nom)'}</span>
          {file.starred && <Star size={10} className="text-warn shrink-0" />}
          {file.is_shared && <Users size={10} className="text-info shrink-0" />}
        </div>
        <div className="text-[11px] font-mono text-ink-500 truncate">
          {cat.label} · {sizeStr}
          {file.modified_time && (
            <span> · modifié {new Date(file.modified_time).toLocaleDateString('fr-CA')}</span>
          )}
        </div>
      </div>
      <ExternalLink size={11} className="text-ink-500 shrink-0" />
    </a>
  )
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1_048_576) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1_073_741_824) return `${(bytes / 1_048_576).toFixed(1)} MB`
  return `${(bytes / 1_073_741_824).toFixed(2)} GB`
}
