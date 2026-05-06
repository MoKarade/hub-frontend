'use client'

/**
 * /photos/faces — Reconnaissance faciale + clustering (Phase 7+).
 *
 * Workflow Marc :
 *  1. Lance "Detecter visages" (batch 50) → backend detect+encode dlib
 *  2. Lance "Clusteriser" → DBSCAN groupe les visages similaires
 *  3. Pour chaque cluster, Marc tape un nom (Sophie, papa, ...)
 *  4. Click un cluster → liste des photos ou ce cluster apparait
 *
 * Setup requis : `cd hub-core && pip install -e .[ml]` + MSVC sur Windows.
 */

import { useState, useCallback, useEffect } from 'react'
import Link from 'next/link'
import {
  Users,
  Loader2,
  AlertTriangle,
  ArrowLeft,
  Search,
  RefreshCw,
} from 'lucide-react'
import { Sidebar } from '@/components/sidebar'
import { HubStatus } from '@/components/hub-status'
import { getBaseUrl, photoThumbUrl } from '@/lib/api'

interface FaceCluster {
  id: string
  name: string | null
  photo_count: number
  sample_face_id: string | null
}

interface MlStatus {
  face_recognition_installed: boolean
  total_photos: number
  total_faces: number
  total_clusters: number
}

interface ClusterPhoto {
  photo_id: string
  media_id: string
  filename: string | null
  taken_at: string | null
}

export default function FacesPage() {
  const base = getBaseUrl()
  const [clusters, setClusters] = useState<FaceCluster[]>([])
  const [status, setStatus] = useState<MlStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedCluster, setSelectedCluster] = useState<string | null>(null)
  const [clusterPhotos, setClusterPhotos] = useState<ClusterPhoto[]>([])

  const refresh = useCallback(async () => {
    try {
      const [r1, r2] = await Promise.all([
        fetch(`${base}/v1/photos/face-clusters`).then((r) => r.json()),
        fetch(`${base}/v1/photos/ml-status`).then((r) => r.json()),
      ])
      setClusters(r1)
      setStatus(r2)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [base])

  useEffect(() => {
    refresh()
  }, [refresh])

  const detectBatch = useCallback(async () => {
    setWorking('detect')
    setError(null)
    try {
      const r = await fetch(`${base}/v1/photos/detect-faces`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit: 50, detection_model: 'hog' }),
      })
      if (!r.ok) {
        const data = await r.json().catch(() => ({}))
        throw new Error(data.detail || `HTTP ${r.status}`)
      }
      const data = await r.json()
      await refresh()
      setError(`Detection OK : ${data.photos_processed} photos, ${data.faces_found} visages trouves`)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setWorking(null)
    }
  }, [base, refresh])

  const clusterAll = useCallback(async () => {
    setWorking('cluster')
    setError(null)
    try {
      const r = await fetch(`${base}/v1/photos/cluster-faces`, { method: 'POST' })
      if (!r.ok) {
        const data = await r.json().catch(() => ({}))
        throw new Error(data.detail || `HTTP ${r.status}`)
      }
      const data = await r.json()
      await refresh()
      setError(
        `Clustering OK : ${data.total_faces} visages → ${data.clusters_found} groupes (${data.noise_faces} isoles)`,
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setWorking(null)
    }
  }, [base, refresh])

  const renameCluster = useCallback(
    async (clusterId: string, name: string | null) => {
      try {
        await fetch(`${base}/v1/photos/face-clusters/${clusterId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name }),
        })
        refresh()
      } catch {
        /* ignore */
      }
    },
    [base, refresh],
  )

  const openCluster = useCallback(
    async (clusterId: string) => {
      setSelectedCluster(clusterId)
      try {
        const r = await fetch(`${base}/v1/photos/by-face/${clusterId}?limit=200`)
        setClusterPhotos(await r.json())
      } catch {
        setClusterPhotos([])
      }
    },
    [base],
  )

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 px-4 sm:px-6 lg:px-8 pt-16 lg:pt-6 pb-6 max-w-[1400px] space-y-4">
        <header className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <Link
              href="/photos"
              className="inline-flex items-center gap-1 text-xs text-ink-400 hover:text-ink-200 mb-1"
            >
              <ArrowLeft size={11} /> Photos
            </Link>
            <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
              <Users size={20} className="text-accent" />
              Visages
            </h1>
            <p className="text-xs text-ink-400 mt-0.5">
              Detection + clustering automatique des visages dans tes photos
            </p>
          </div>
          <Link
            href="/photos/search"
            className="px-3 py-2 rounded-md text-xs font-semibold bg-ink-800 border border-ink-700 text-ink-300 hover:border-ink-600 inline-flex items-center gap-1.5"
          >
            <Search size={11} /> Recherche semantique
          </Link>
        </header>

        {status && !status.face_recognition_installed && (
          <div className="panel p-3 border-amber-500/40 flex items-start gap-2">
            <AlertTriangle size={14} className="text-amber-400 shrink-0 mt-0.5" />
            <div className="text-xs">
              <p className="text-ink-200 font-semibold mb-1">face_recognition non installe</p>
              <p className="text-ink-400">
                Lance dans hub-core : <code className="font-mono bg-ink-800 px-1">pip install -e .[ml]</code>.
                Sur Windows, MSVC Build Tools requis pour compiler dlib.
              </p>
            </div>
          </div>
        )}

        {/* Stats + actions */}
        {status && status.face_recognition_installed && (
          <div className="panel p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="text-ink-300 flex flex-wrap gap-3">
              <span>
                <span className="font-mono text-ink-100">{status.total_faces}</span> visages dans{' '}
                <span className="font-mono text-ink-100">{status.total_photos}</span> photos
              </span>
              <span>
                <span className="font-mono text-ink-100">{status.total_clusters}</span> groupes
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={detectBatch}
                disabled={working !== null}
                className="px-3 py-1.5 rounded-md text-[10px] font-semibold bg-info/15 border border-info/40 text-info hover:bg-info/25 disabled:opacity-40 inline-flex items-center gap-1"
              >
                {working === 'detect' ? <Loader2 size={10} className="animate-spin" /> : <RefreshCw size={10} />}
                Detecter (batch 50)
              </button>
              <button
                onClick={clusterAll}
                disabled={working !== null || status.total_faces === 0}
                className="px-3 py-1.5 rounded-md text-[10px] font-semibold bg-accent/15 border border-accent/40 text-accent hover:bg-accent/25 disabled:opacity-40 inline-flex items-center gap-1"
              >
                {working === 'cluster' ? <Loader2 size={10} className="animate-spin" /> : <Users size={10} />}
                Clusteriser
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="panel p-3 text-xs text-ink-300 font-mono">{error}</div>
        )}

        {/* Clusters list */}
        {!loading && clusters.length === 0 && status?.face_recognition_installed && (
          <div className="panel p-6 text-center text-xs text-ink-400">
            Aucun cluster encore. Lance &laquo;&nbsp;Detecter&nbsp;&raquo; puis &laquo;&nbsp;Clusteriser&nbsp;&raquo;.
          </div>
        )}

        {clusters.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
            {clusters.map((c) => (
              <ClusterTile
                key={c.id}
                cluster={c}
                base={base}
                onRename={renameCluster}
                onOpen={openCluster}
                isSelected={selectedCluster === c.id}
              />
            ))}
          </div>
        )}

        {/* Photos du cluster selectionne */}
        {selectedCluster && clusterPhotos.length > 0 && (
          <div className="panel p-3">
            <p className="text-xs text-ink-400 mb-2">
              {clusterPhotos.length} photos pour ce cluster
            </p>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
              {clusterPhotos.map((p) => (
                <Link
                  key={p.photo_id}
                  href={`/photos?id=${p.photo_id}`}
                  className="ga-card ga-card-hover overflow-hidden"
                >
                  <img
                    src={photoThumbUrl(p.media_id, 200)}
                    alt={p.filename ?? ''}
                    className="w-full h-24 object-cover"
                    loading="lazy"
                  />
                </Link>
              ))}
            </div>
          </div>
        )}

        <HubStatus />
      </main>
    </div>
  )
}

function ClusterTile({
  cluster,
  base,
  onRename,
  onOpen,
  isSelected,
}: {
  cluster: FaceCluster
  base: string
  onRename: (id: string, name: string | null) => void
  onOpen: (id: string) => void
  isSelected: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(cluster.name ?? '')

  const sampleUrl = cluster.sample_face_id
    ? `${base}/v1/photos/face-thumb/${cluster.sample_face_id}`
    : null

  return (
    <div
      className={`ga-card overflow-hidden ${isSelected ? 'border-accent/60' : ''}`}
    >
      <button
        onClick={() => onOpen(cluster.id)}
        className="block w-full bg-ink-800 hover:opacity-80 transition-opacity"
        aria-label={`Ouvrir cluster ${cluster.name ?? 'sans nom'}`}
      >
        {sampleUrl ? (
          <img
            src={sampleUrl}
            alt=""
            className="w-full h-32 object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-32 flex items-center justify-center">
            <Users size={32} className="text-ink-600" />
          </div>
        )}
      </button>
      <div className="p-2">
        {editing ? (
          <input
            type="text"
            value={name}
            autoFocus
            onChange={(e) => setName(e.target.value)}
            onBlur={() => {
              setEditing(false)
              onRename(cluster.id, name.trim() || null)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
              if (e.key === 'Escape') {
                setName(cluster.name ?? '')
                setEditing(false)
              }
            }}
            className="w-full bg-ink-900 border border-accent/40 rounded px-1.5 py-0.5 text-xs"
          />
        ) : (
          <button
            onClick={() => setEditing(true)}
            className="text-xs font-semibold text-ink-200 truncate w-full text-left hover:text-accent"
          >
            {cluster.name ?? 'Sans nom'}
          </button>
        )}
        <span className="text-[10px] text-ink-500 font-mono">
          {cluster.photo_count} visage{cluster.photo_count > 1 ? 's' : ''}
        </span>
      </div>
    </div>
  )
}
