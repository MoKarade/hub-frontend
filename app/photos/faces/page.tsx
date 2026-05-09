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

import { useState, useCallback } from 'react'
import Link from 'next/link'
import {
  Users,
  Loader2,
  AlertTriangle,
  ArrowLeft,
  Search,
  ScanFace,
  Sparkles,
  X,
} from 'lucide-react'
import useSWR from 'swr'
import { Sidebar } from '@/components/sidebar'
import { HubStatus } from '@/components/hub-status'
import { api, photoThumbUrl } from '@/lib/api'
import { toast } from '@/lib/toast'

type FaceCluster = {
  id: string
  name: string | null
  photo_count: number
  sample_face_id: string | null
  sample_media_id: string | null
}

type ClusterPhoto = {
  photo_id: string
  media_id: string
  filename: string | null
  taken_at: string | null
}

type Working = 'detect' | 'cluster' | null

export default function FacesPage() {
  const [working, setWorking] = useState<Working>(null)
  const [selectedCluster, setSelectedCluster] = useState<FaceCluster | null>(null)

  const { data: status, mutate: refreshStatus, isLoading: statusLoading } = useSWR(
    'photos-ml-status',
    () => api.photosMl.status(),
  )
  const { data: clusters, mutate: refreshClusters, isLoading: clustersLoading } = useSWR(
    'face-clusters',
    () => api.photosMl.listClusters({ limit: 200 }),
  )

  const refreshAll = useCallback(async () => {
    await Promise.all([refreshStatus(), refreshClusters()])
  }, [refreshStatus, refreshClusters])

  const detectBatch = useCallback(async () => {
    setWorking('detect')
    try {
      const res = await api.photosMl.detectFaces({ limit: 50, detection_model: 'hog' })
      await refreshAll()
      toast.success(
        `Détection OK · ${res.photos_processed} photos analysées, ${res.faces_found} visages trouvés`,
        { description: `${res.duration_seconds}s${res.errors > 0 ? ` · ${res.errors} erreurs` : ''}` },
      )
    } catch (err) {
      toast.apiError(err, 'Détection visages échouée')
    } finally {
      setWorking(null)
    }
  }, [refreshAll])

  const clusterAll = useCallback(async () => {
    setWorking('cluster')
    try {
      const res = await api.photosMl.clusterFaces()
      await refreshAll()
      toast.success(
        `Clustering OK · ${res.total_faces} visages → ${res.clusters_found} groupes`,
        { description: `${res.noise_faces} isolés · ${res.duration_seconds}s` },
      )
    } catch (err) {
      toast.apiError(err, 'Clustering échoué')
    } finally {
      setWorking(null)
    }
  }, [refreshAll])

  const renameCluster = useCallback(
    async (clusterId: string, name: string | null) => {
      try {
        await api.photosMl.renameCluster(clusterId, name)
        await refreshClusters()
        toast.success(name ? `Cluster renommé : ${name}` : 'Nom retiré')
      } catch (err) {
        toast.apiError(err, 'Renommage échoué')
      }
    },
    [refreshClusters],
  )

  const mlMissing = status && !status.face_recognition_installed
  const totalAnalysed = status?.total_photos ?? 0
  const totalFaces = status?.total_faces ?? 0
  const totalClusters = status?.total_clusters ?? 0

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
              Détection + clustering automatique des visages dans tes photos
            </p>
          </div>
          <Link
            href="/photos/search"
            className="px-3 py-2 rounded-md text-xs font-semibold bg-ink-800 border border-ink-700 text-ink-300 hover:border-ink-600 inline-flex items-center gap-1.5"
          >
            <Search size={11} /> Recherche sémantique
          </Link>
        </header>

        {mlMissing && (
          <div className="panel p-3 border-amber-500/40 flex items-start gap-2">
            <AlertTriangle size={14} className="text-amber-400 shrink-0 mt-0.5" />
            <div className="text-xs">
              <p className="text-ink-200 font-semibold mb-1">face_recognition non installé</p>
              <p className="text-ink-400">
                Lance dans hub-core :{' '}
                <code className="font-mono bg-ink-800 px-1">pip install -e .[ml]</code>. Sur
                Windows, MSVC Build Tools requis pour compiler dlib.
              </p>
            </div>
          </div>
        )}

        {/* Statut clair en haut */}
        <div className="panel p-4">
          {statusLoading ? (
            <div className="flex items-center gap-2 text-xs text-ink-400">
              <Loader2 size={12} className="animate-spin" /> Chargement du statut ML…
            </div>
          ) : status ? (
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-xs text-ink-300">
              <span>
                <span className="font-mono text-ink-100 text-sm">{totalFaces}</span> visages
                détectés
              </span>
              <span className="text-ink-600">·</span>
              <span>
                <span className="font-mono text-ink-100 text-sm">{totalClusters}</span> clusters
              </span>
              <span className="text-ink-600">·</span>
              <span>
                sur <span className="font-mono text-ink-100">{totalAnalysed}</span> photos
                indexées
              </span>
            </div>
          ) : (
            <div className="text-xs text-ink-400">Statut indisponible</div>
          )}
        </div>

        {/* Actions distinctes */}
        {status?.face_recognition_installed && (
          <div className="panel p-4">
            <div className="text-[11px] uppercase tracking-wide text-ink-500 font-semibold mb-3">
              Actions
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <ActionCard
                icon={ScanFace}
                title="Détecter visages"
                description="Analyse 50 photos non encore traitées et encode les visages trouvés."
                buttonLabel="Lancer détection (batch 50)"
                onClick={detectBatch}
                disabled={working !== null || totalAnalysed === 0}
                loading={working === 'detect'}
                tone="info"
              />
              <ActionCard
                icon={Sparkles}
                title="Clusteriser"
                description={
                  totalFaces === 0
                    ? 'Aucun visage encore détecté. Lance la détection d’abord.'
                    : `Regroupe les ${totalFaces} visages par similarité (DBSCAN).`
                }
                buttonLabel="Lancer clustering"
                onClick={clusterAll}
                disabled={working !== null || totalFaces === 0}
                loading={working === 'cluster'}
                tone="accent"
              />
            </div>
          </div>
        )}

        {/* Empty states honnêtes */}
        {!clustersLoading && status?.face_recognition_installed && totalFaces === 0 && (
          <div className="panel p-6 text-center text-xs text-ink-400">
            Aucun visage analysé pour le moment. Lance &laquo;&nbsp;Détecter visages&nbsp;&raquo;
            pour commencer.
          </div>
        )}

        {!clustersLoading &&
          status?.face_recognition_installed &&
          totalFaces > 0 &&
          (clusters?.length ?? 0) === 0 && (
            <div className="panel p-6 text-center text-xs text-ink-400">
              {totalFaces} visages détectés mais aucun cluster formé. Lance
              &laquo;&nbsp;Clusteriser&nbsp;&raquo; pour les regrouper.
            </div>
          )}

        {/* Grille des clusters */}
        {clusters && clusters.length > 0 && (
          <div>
            <div className="text-[11px] uppercase tracking-wide text-ink-500 font-semibold mb-2">
              Clusters
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
              {clusters.map((c) => (
                <ClusterTile
                  key={c.id}
                  cluster={c}
                  onRename={renameCluster}
                  onOpen={() => setSelectedCluster(c)}
                  isSelected={selectedCluster?.id === c.id}
                />
              ))}
            </div>
          </div>
        )}

        {selectedCluster && (
          <ClusterPanel
            cluster={selectedCluster}
            onClose={() => setSelectedCluster(null)}
          />
        )}

        <HubStatus />
      </main>
    </div>
  )
}

function ActionCard({
  icon: Icon,
  title,
  description,
  buttonLabel,
  onClick,
  disabled,
  loading,
  tone,
}: {
  icon: typeof ScanFace
  title: string
  description: string
  buttonLabel: string
  onClick: () => void
  disabled: boolean
  loading: boolean
  tone: 'info' | 'accent'
}) {
  const toneClass =
    tone === 'accent'
      ? 'bg-accent/15 border-accent/40 text-accent hover:bg-accent/25'
      : 'bg-info/15 border-info/40 text-info hover:bg-info/25'
  const iconColor = tone === 'accent' ? 'text-accent' : 'text-info'
  return (
    <div className="ga-card p-3 flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Icon size={14} className={iconColor} />
        <h3 className="text-sm font-semibold text-ink-100">{title}</h3>
      </div>
      <p className="text-[11px] text-ink-400 flex-1">{description}</p>
      <button
        onClick={onClick}
        disabled={disabled}
        className={`px-3 py-1.5 rounded-md text-[11px] font-semibold border inline-flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed ${toneClass}`}
      >
        {loading ? <Loader2 size={11} className="animate-spin" /> : <Icon size={11} />}
        {loading ? 'En cours…' : buttonLabel}
      </button>
    </div>
  )
}

function ClusterTile({
  cluster,
  onRename,
  onOpen,
  isSelected,
}: {
  cluster: FaceCluster
  onRename: (id: string, name: string | null) => void
  onOpen: () => void
  isSelected: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(cluster.name ?? '')

  const sampleUrl = cluster.sample_media_id
    ? photoThumbUrl(cluster.sample_media_id, 200)
    : null

  return (
    <div className={`ga-card overflow-hidden ${isSelected ? 'border-accent/60' : ''}`}>
      <button
        onClick={onOpen}
        className="block w-full bg-ink-800 hover:opacity-80 transition-opacity"
        aria-label={`Ouvrir cluster ${cluster.name ?? 'sans nom'}`}
      >
        {sampleUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
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
              const trimmed = name.trim()
              if (trimmed !== (cluster.name ?? '')) {
                onRename(cluster.id, trimmed || null)
              }
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

function ClusterPanel({
  cluster,
  onClose,
}: {
  cluster: FaceCluster
  onClose: () => void
}) {
  const { data: photos, isLoading, error } = useSWR(
    ['cluster-photos', cluster.id],
    () => api.photosMl.photosByFace(cluster.id, 200),
  )

  return (
    <div className="panel p-3">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-sm font-semibold text-ink-100">
            {cluster.name ?? 'Cluster sans nom'}
          </div>
          <div className="text-[11px] text-ink-500">
            {cluster.photo_count} visage{cluster.photo_count > 1 ? 's' : ''}
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-md hover:bg-ink-800 text-ink-400 hover:text-ink-200"
          aria-label="Fermer"
        >
          <X size={14} />
        </button>
      </div>

      {isLoading && (
        <div className="text-xs text-ink-400 flex items-center gap-2">
          <Loader2 size={12} className="animate-spin" /> Chargement des photos…
        </div>
      )}

      {error && (
        <div className="text-xs text-ink-400">
          Impossible de charger les photos de ce cluster.
        </div>
      )}

      {!isLoading && !error && photos && photos.length === 0 && (
        <div className="text-xs text-ink-400">Aucune photo trouvée pour ce cluster.</div>
      )}

      {photos && photos.length > 0 && (
        <ClusterPhotoGrid photos={photos} />
      )}
    </div>
  )
}

function ClusterPhotoGrid({ photos }: { photos: ClusterPhoto[] }) {
  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
      {photos.map((p) => (
        <Link
          key={p.photo_id}
          href={`/photos?id=${p.photo_id}`}
          className="ga-card ga-card-hover overflow-hidden"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photoThumbUrl(p.media_id, 200)}
            alt={p.filename ?? ''}
            className="w-full h-24 object-cover"
            loading="lazy"
          />
        </Link>
      ))}
    </div>
  )
}
