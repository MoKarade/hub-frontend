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
} from 'lucide-react'
import { useState } from 'react'
import useSWR, { mutate as swrMutate } from 'swr'
import { api, type DriveFileItem, type DriveStatsResponse } from '@/lib/api'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'

export default function DocumentsPage() {
  const [syncing, setSyncing] = useState(false)
  const [search, setSearch] = useState('')
  const { data: files } = useSWR<DriveFileItem[]>(
    ['drive-files', search],
    () => api.drive.files({ q: search.trim() || undefined, limit: 100 })
  )
  const { data: stats } = useSWR<DriveStatsResponse>('drive-stats', () => api.drive.stats())

  async function handleSync() {
    setSyncing(true)
    try {
      const res = await api.drive.sync({ max_results: 5000 })
      toast.success(
        `Sync OK · ${res.ingested} nouveaux, ${res.updated} màj`,
        { description: `${res.duration_seconds}s` }
      )
      void swrMutate(['drive-files', search])
      void swrMutate('drive-stats')
    } catch (err) {
      toast.apiError(err, 'Sync Drive échoué')
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 px-4 sm:px-6 lg:px-8 pt-16 lg:pt-6 pb-6 max-w-[1400px] flex flex-col">
        <header className="mb-4 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Documents</h1>
            <p className="text-sm text-ink-400">
              Google Drive · métadonnées indexées localement
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
              value={(stats.total_size_bytes / 1_073_741_824).toFixed(1)}
              icon={HardDrive}
              color="text-accent"
              suffix="GB"
            />
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
          {files && files.length === 0 && (
            <div className="ga-card p-6 text-center">
              <FileText size={24} className="text-ink-500 mx-auto mb-2" />
              <div className="text-sm text-ink-300">Aucun fichier</div>
              <p className="text-xs text-ink-500 mt-1">
                Click &laquo;&nbsp;Sync Drive&nbsp;&raquo; pour importer
              </p>
            </div>
          )}
          {files && files.length > 0 && (
            <div className="ga-card divide-y divide-ink-700/30 max-h-[60vh] overflow-y-auto">
              {files.map((f) => (
                <FileRow key={f.id} file={f} />
              ))}
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
  icon: typeof FileText
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
  const sizeStr = file.size_bytes
    ? formatSize(file.size_bytes)
    : isGoogleDoc(file.mime_type)
      ? 'Google Doc'
      : '—'
  return (
    <a
      href={file.web_view_link ?? '#'}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 px-3 py-2 hover:bg-ink-800/40 transition-colors"
    >
      <div className="shrink-0 w-7 h-7 rounded bg-ink-800 border border-ink-700 flex items-center justify-center text-ink-300">
        <FileText size={13} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="text-sm text-ink-200 truncate">{file.name ?? '(sans nom)'}</span>
          {file.starred && <Star size={10} className="text-warn shrink-0" />}
          {file.is_shared && <Users size={10} className="text-info shrink-0" />}
        </div>
        <div className="text-[11px] font-mono text-ink-500 truncate">
          {file.mime_type.replace('application/', '').replace('vnd.google-apps.', '')} · {sizeStr}
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

function isGoogleDoc(mime: string): boolean {
  return mime.startsWith('application/vnd.google-apps.')
}
