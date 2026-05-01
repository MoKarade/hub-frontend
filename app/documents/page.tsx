'use client'

/**
 * /documents - Vue type Google Drive : navigation folders + breadcrumb +
 * détail click sur fichier. Folders d'abord, files ensuite. Couleurs par type.
 */

import { Sidebar } from '@/components/sidebar'
import { HubStatus } from '@/components/hub-status'
import {
  FileText,
  Folder,
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
  FileCode,
  FileVideo,
  FileAudio,
  ChevronRight,
  Home,
  X,
  Calendar,
  type LucideIcon,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import useSWR, { mutate as swrMutate } from 'swr'
import {
  api,
  type DriveFileItem,
  type DriveStatsResponse,
} from '@/lib/api'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'

interface CategoryDef {
  id: string
  label: string
  icon: LucideIcon
  color: string
  match: (mime: string, name?: string | null) => boolean
}

const FOLDER_MIME = 'application/vnd.google-apps.folder'

const CATEGORIES: CategoryDef[] = [
  {
    id: 'doc',
    label: 'Documents',
    icon: FileText,
    color: 'text-info',
    match: (m) =>
      m === 'application/vnd.google-apps.document' ||
      m === 'application/pdf' ||
      m.includes('wordprocessingml'),
  },
  {
    id: 'sheet',
    label: 'Feuilles',
    icon: FileSpreadsheet,
    color: 'text-data-positive',
    match: (m) =>
      m === 'application/vnd.google-apps.spreadsheet' || m.includes('spreadsheetml') || m === 'text/csv',
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
  { id: 'video', label: 'Vidéos', icon: FileVideo, color: 'text-data-negative', match: (m) => m.startsWith('video/') },
  { id: 'audio', label: 'Audio', icon: FileAudio, color: 'text-purple-400', match: (m) => m.startsWith('audio/') },
  {
    id: 'code',
    label: 'Code',
    icon: FileCode,
    color: 'text-info',
    match: (m, name) =>
      Boolean(name?.match(/\.(py|js|ts|tsx|jsx|java|cpp|c|go|rs|rb|sh|ps1)$/i)),
  },
]

function categorize(file: DriveFileItem): CategoryDef {
  if (file.mime_type === FOLDER_MIME) {
    return { id: 'folder', label: 'Dossier', icon: Folder, color: 'text-warn', match: () => true }
  }
  for (const c of CATEGORIES) {
    if (c.match(file.mime_type, file.name)) return c
  }
  return { id: 'other', label: 'Fichier', icon: FileText, color: 'text-ink-400', match: () => true }
}

export default function DocumentsPage() {
  const [syncing, setSyncing] = useState(false)
  const [search, setSearch] = useState('')
  const [stack, setStack] = useState<{ id: string; name: string }[]>([
    { id: 'root', name: 'Racine' },
  ])
  const [selected, setSelected] = useState<DriveFileItem | null>(null)
  const current = stack[stack.length - 1]

  const { data: files } = useSWR<DriveFileItem[]>(
    ['drive-files', current.id, search],
    () =>
      api.drive.files({
        parent_id: search.trim() ? undefined : current.id,
        q: search.trim() || undefined,
        limit: 500,
      })
  )
  const { data: stats } = useSWR<DriveStatsResponse>('drive-stats', () => api.drive.stats())

  async function handleSync() {
    setSyncing(true)
    try {
      const res = await api.drive.sync({ max_results: 5000 })
      toast.success(`Sync OK · ${res.ingested} nouveaux, ${res.updated} màj`, {
        description: `${res.duration_seconds}s`,
      })
      void swrMutate(['drive-files', current.id, search])
      void swrMutate('drive-stats')
    } catch (err) {
      toast.apiError(err, 'Sync Drive échoué')
    } finally {
      setSyncing(false)
    }
  }

  function enterFolder(f: DriveFileItem) {
    setStack([...stack, { id: f.drive_id, name: f.name ?? '(sans nom)' }])
    setSearch('')
  }

  function jumpTo(idx: number) {
    setStack(stack.slice(0, idx + 1))
    setSearch('')
  }

  // Sort : folders d'abord, ensuite par modified desc
  const sortedFiles = useMemo(() => {
    if (!files) return []
    return [...files].sort((a, b) => {
      const aFolder = a.mime_type === FOLDER_MIME
      const bFolder = b.mime_type === FOLDER_MIME
      if (aFolder !== bFolder) return aFolder ? -1 : 1
      const at = a.modified_time ? new Date(a.modified_time).getTime() : 0
      const bt = b.modified_time ? new Date(b.modified_time).getTime() : 0
      return bt - at
    })
  }, [files])

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 px-4 sm:px-6 lg:px-8 pt-16 lg:pt-6 pb-6 max-w-[1400px] flex flex-col">
        <header className="mb-3 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Drive</h1>
            <p className="text-xs text-ink-400">
              {stats
                ? `${stats.total} fichiers · ${(stats.total_size_bytes / 1_073_741_824).toFixed(2)} GB · ${stats.starred} étoilés`
                : 'Chargement…'}
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

        {/* Breadcrumb + search */}
        <div className="ga-card p-2 mb-3 flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-0.5 text-sm">
            {stack.map((s, i) => (
              <div key={`${s.id}-${i}`} className="flex items-center gap-0.5">
                {i > 0 && <ChevronRight size={11} className="text-ink-600" />}
                <button
                  type="button"
                  onClick={() => jumpTo(i)}
                  className={cn(
                    'inline-flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-ink-800 transition-colors max-w-[200px]',
                    i === stack.length - 1 ? 'text-ink-100 font-semibold' : 'text-ink-400 hover:text-ink-200'
                  )}
                >
                  {i === 0 && <Home size={10} />}
                  <span className="truncate">{s.name}</span>
                </button>
              </div>
            ))}
          </div>
          <div className="flex-1" />
          <div className="relative">
            <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-ink-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Recherche globale…"
              className="bg-ink-800 border border-ink-700 rounded-md pl-7 pr-2 py-1 text-xs w-56 focus:outline-none focus:border-accent/60"
            />
          </div>
        </div>

        {/* Liste */}
        <div className="flex-1 min-h-0">
          {sortedFiles.length === 0 && (
            <div className="ga-card p-8 text-center">
              <Folder size={32} className="text-ink-600 mx-auto mb-2" />
              <div className="text-sm text-ink-400">Dossier vide</div>
              <div className="text-xs text-ink-500 mt-1">
                {search ? 'Aucun match. Affine ta recherche.' : 'Click "Sync Drive" pour importer.'}
              </div>
            </div>
          )}
          {sortedFiles.length > 0 && (
            <div className="ga-card overflow-hidden">
              <div className="grid grid-cols-12 px-3 py-1.5 border-b border-ink-700/50 text-[10px] uppercase tracking-wider text-ink-500 font-mono">
                <div className="col-span-7">Nom</div>
                <div className="col-span-2">Type</div>
                <div className="col-span-2">Modifié</div>
                <div className="col-span-1 text-right">Taille</div>
              </div>
              <div className="divide-y divide-ink-700/20 max-h-[60vh] overflow-y-auto">
                {sortedFiles.map((f) => (
                  <FileRow
                    key={f.id}
                    file={f}
                    onEnter={() => enterFolder(f)}
                    onSelect={() => setSelected(f)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {selected && <FileDetailModal file={selected} onClose={() => setSelected(null)} />}

        <div className="mt-3">
          <HubStatus />
        </div>
      </main>
    </div>
  )
}

function FileRow({
  file,
  onEnter,
  onSelect,
}: {
  file: DriveFileItem
  onEnter: () => void
  onSelect: () => void
}) {
  const cat = categorize(file)
  const Icon = cat.icon
  const isFolder = file.mime_type === FOLDER_MIME
  const sizeStr = file.size_bytes ? formatSize(file.size_bytes) : isFolder ? '' : 'Google'
  const modStr = file.modified_time
    ? new Date(file.modified_time).toLocaleDateString('fr-CA')
    : '—'

  return (
    <div
      role="button"
      tabIndex={0}
      onDoubleClick={isFolder ? onEnter : onSelect}
      onClick={(e) => {
        // Single click = open folder OR show detail
        if (isFolder) onEnter()
        else onSelect()
      }}
      className="grid grid-cols-12 items-center px-3 py-2 hover:bg-ink-800/40 transition-colors text-xs cursor-pointer"
    >
      <div className="col-span-7 flex items-center gap-2 min-w-0">
        <Icon size={14} className={cn('shrink-0', cat.color)} />
        <span className="text-ink-100 truncate">{file.name ?? '(sans nom)'}</span>
        {file.starred && <Star size={10} className="text-warn shrink-0" />}
        {file.is_shared && <Users size={10} className="text-info shrink-0" />}
      </div>
      <div className="col-span-2 text-ink-400 truncate">{cat.label}</div>
      <div className="col-span-2 font-mono text-[11px] text-ink-500">{modStr}</div>
      <div className="col-span-1 text-right font-mono text-[11px] text-ink-500">{sizeStr}</div>
    </div>
  )
}

function FileDetailModal({ file, onClose }: { file: DriveFileItem; onClose: () => void }) {
  const cat = categorize(file)
  const Icon = cat.icon
  const sizeStr = file.size_bytes
    ? formatSize(file.size_bytes)
    : file.mime_type.startsWith('application/vnd.google-apps.')
      ? 'Format Google'
      : '—'
  return (
    <div
      className="fixed inset-0 z-50 bg-ink-950/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="ga-card max-w-lg w-full overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-ink-700/50 flex items-start gap-3">
          <div className={cn('w-12 h-12 rounded-lg bg-ink-800 border border-ink-700 flex items-center justify-center shrink-0', cat.color)}>
            <Icon size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-semibold text-ink-100 break-words">
              {file.name ?? '(sans nom)'}
            </h2>
            <div className="text-[11px] font-mono text-ink-500 mt-0.5">{cat.label}</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded text-ink-400 hover:text-ink-100 hover:bg-ink-800"
          >
            <X size={13} />
          </button>
        </div>
        <div className="p-4 space-y-2 text-xs">
          <DetailRow icon={HardDrive} label="Taille" value={sizeStr} />
          <DetailRow icon={FileText} label="Type MIME" value={file.mime_type} mono />
          {file.modified_time && (
            <DetailRow
              icon={Calendar}
              label="Modifié"
              value={new Date(file.modified_time).toLocaleString('fr-CA')}
            />
          )}
          {file.owner_email && <DetailRow icon={Users} label="Propriétaire" value={file.owner_email} />}
          <div className="flex items-center gap-2 text-[11px] flex-wrap pt-1">
            {file.starred && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-warn/15 text-warn border border-warn/30">
                <Star size={9} /> Étoilé
              </span>
            )}
            {file.is_shared && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-info/15 text-info border border-info/30">
                <Users size={9} /> Partagé
              </span>
            )}
          </div>
        </div>
        {file.web_view_link && (
          <div className="px-4 pb-4">
            <a
              href={file.web_view_link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-accent text-ink-950 text-xs font-semibold hover:bg-accent-light"
            >
              Ouvrir sur Drive
              <ExternalLink size={11} />
            </a>
          </div>
        )}
      </div>
    </div>
  )
}

function DetailRow({
  icon: Icon,
  label,
  value,
  mono,
}: {
  icon: LucideIcon
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div className="flex items-start gap-2">
      <Icon size={11} className="text-ink-500 mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-[10px] uppercase tracking-wider text-ink-500">{label}</div>
        <div className={cn('text-ink-200 break-words', mono && 'font-mono text-[11px]')}>{value}</div>
      </div>
    </div>
  )
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1_048_576) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1_073_741_824) return `${(bytes / 1_048_576).toFixed(1)} MB`
  return `${(bytes / 1_073_741_824).toFixed(2)} GB`
}
