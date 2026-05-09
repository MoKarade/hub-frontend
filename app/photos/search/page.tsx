'use client'

/**
 * /photos/search — Recherche semantique CLIP sur photos (Phase 7+).
 *
 * Marc tape une description en francais ou anglais, le backend embed la query
 * via CLIP et retourne les photos avec le score cosine le plus eleve.
 *
 * Setup requis : `cd hub-core && pip install -e .[ml]` + restart hub-core.
 * Sans ca, l'endpoint retourne 503.
 */

import { useState, useCallback, useEffect } from 'react'
import Link from 'next/link'
import { Search, Loader2, AlertTriangle, ArrowLeft, Sparkles } from 'lucide-react'
import { Sidebar } from '@/components/sidebar'
import { HubStatus } from '@/components/hub-status'
import { api, photoThumbUrl } from '@/lib/api'
import { toast } from '@/lib/toast'

interface SearchHit {
  photo_id: string
  media_id: string
  filename: string | null
  score: number
}

interface MlStatus {
  clip_installed: boolean
  face_recognition_installed: boolean
  total_photos: number
  total_embeddings: number
  embed_remaining: number
  total_faces: number
  total_clusters: number
}

export default function PhotosSearchPage() {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<SearchHit[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [status, setStatus] = useState<MlStatus | null>(null)
  const [embedding, setEmbedding] = useState(false)

  const fetchStatus = useCallback(async () => {
    try {
      setStatus(await api.photosMl.status())
    } catch {
      /* ignore : on affiche juste l'absence de status */
    }
  }, [])

  useEffect(() => {
    fetchStatus()
  }, [fetchStatus])

  const search = useCallback(async () => {
    if (!q.trim()) return
    setLoading(true)
    setSearched(true)
    try {
      const hits = await api.photosMl.search(q, { top_k: 30, min_score: 0.18 })
      setResults(hits)
      if (hits.length === 0) {
        toast.info('Aucun resultat', {
          description: 'Essaie une description plus generale ou plus precise.',
        })
      }
    } catch (err) {
      toast.apiError(err, 'Recherche semantique echouee')
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [q])

  const triggerEmbed = useCallback(async () => {
    setEmbedding(true)
    try {
      const data = await api.photosMl.embed({ limit: 100 })
      await fetchStatus()
      toast.success(`Batch indexe · ${data.embedded} embeddings`, {
        description: `${data.total_remaining} photos restantes · ${data.duration_seconds}s`,
      })
    } catch (err) {
      toast.apiError(err, 'Indexation CLIP echouee')
    } finally {
      setEmbedding(false)
    }
  }, [fetchStatus])

  const indexedPct =
    status && status.total_photos > 0
      ? Math.round((status.total_embeddings / status.total_photos) * 100)
      : 0

  const noPhotosIndexed = status?.clip_installed && status.total_embeddings === 0

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
              <Sparkles size={20} className="text-accent" />
              Recherche semantique
            </h1>
            <p className="text-xs text-ink-400 mt-0.5">
              Decris ce que tu cherches, l&apos;IA trouve les photos similaires (CLIP)
            </p>
          </div>
        </header>

        {/* CLIP non installe : warning */}
        {status && !status.clip_installed && (
          <div className="panel p-3 border-amber-500/40 flex items-start gap-2">
            <AlertTriangle size={14} className="text-amber-400 shrink-0 mt-0.5" />
            <div className="text-xs">
              <p className="text-ink-200 font-semibold mb-1">CLIP non installe</p>
              <p className="text-ink-400">
                Lance dans hub-core :{' '}
                <code className="font-mono bg-ink-800 px-1">pip install -e .[ml]</code> puis restart
                uvicorn. Telecharge ~3 GB (torch + open_clip).
              </p>
            </div>
          </div>
        )}

        {/* Status indexation */}
        {status && status.clip_installed && (
          <div className="panel p-3 flex items-center justify-between flex-wrap gap-3">
            <div className="flex-1 min-w-[220px]">
              <div className="text-xs text-ink-300 mb-1.5">
                <span className="font-mono text-ink-100">{status.total_embeddings}</span> /{' '}
                <span className="font-mono">{status.total_photos}</span> photos indexees
                {status.embed_remaining > 0 && (
                  <span className="text-warn ml-2">({status.embed_remaining} restantes)</span>
                )}
                {status.embed_remaining === 0 && status.total_embeddings > 0 && (
                  <span className="text-accent ml-2">· tout est indexe</span>
                )}
              </div>
              <div className="h-1.5 w-full bg-ink-800 rounded overflow-hidden">
                <div
                  className="h-full bg-accent transition-all"
                  style={{ width: `${indexedPct}%` }}
                />
              </div>
              <div className="text-[10px] font-mono text-ink-500 mt-1">{indexedPct}%</div>
            </div>
            {status.embed_remaining > 0 && (
              <button
                type="button"
                onClick={triggerEmbed}
                disabled={embedding}
                className="px-3 py-1.5 rounded-md text-xs font-semibold bg-accent/15 border border-accent/40 text-accent hover:bg-accent/25 disabled:opacity-40 inline-flex items-center gap-1.5"
              >
                {embedding ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
                {embedding ? 'Indexation 100…' : 'Indexer batch 100'}
              </button>
            )}
          </div>
        )}

        {/* Empty state honnete : 0 photo indexee */}
        {noPhotosIndexed && status && status.total_photos > 0 && (
          <div className="panel p-6 text-center">
            <Sparkles size={28} className="text-ink-600 mx-auto mb-2" />
            <p className="text-sm text-ink-200 font-semibold">Aucune photo encore indexee</p>
            <p className="text-xs text-ink-400 mt-1 mb-3">
              CLIP doit d&apos;abord encoder tes {status.total_photos} photos avant de pouvoir
              chercher. Premier batch ~30s.
            </p>
            <button
              type="button"
              onClick={triggerEmbed}
              disabled={embedding}
              className="px-4 py-2 rounded-md text-sm font-semibold bg-accent/15 border border-accent/40 text-accent hover:bg-accent/25 disabled:opacity-40 inline-flex items-center gap-1.5"
            >
              {embedding ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
              {embedding ? 'Indexation…' : 'Lancer indexation (100 photos)'}
            </button>
          </div>
        )}

        {noPhotosIndexed && status && status.total_photos === 0 && (
          <div className="panel p-6 text-center text-xs text-ink-400">
            Pas encore de photos importees. Va dans{' '}
            <Link href="/photos" className="text-accent hover:underline">
              /photos
            </Link>{' '}
            et lance le picker Google Photos d&apos;abord.
          </div>
        )}

        {/* Search input — disponible des qu'au moins 1 photo est indexee */}
        {status?.clip_installed && status.total_embeddings > 0 && (
          <div className="panel p-3">
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-500"
                />
                <input
                  type="text"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && search()}
                  placeholder="ex: plage coucher de soleil, velo, repas en famille..."
                  className="w-full bg-ink-800 border border-ink-700 rounded-md pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-accent/60"
                />
              </div>
              <button
                type="button"
                onClick={search}
                disabled={loading || !q.trim()}
                className="px-4 py-2 rounded-md text-sm font-semibold bg-accent/15 border border-accent/40 text-accent hover:bg-accent/25 disabled:opacity-40 inline-flex items-center justify-center gap-1.5"
              >
                {loading ? <Loader2 size={12} className="animate-spin" /> : <Search size={12} />}
                Chercher
              </button>
            </div>
            <p className="text-[10px] text-ink-500 mt-2">
              Astuce : decris la SCENE, pas le format (&laquo;&nbsp;une foret en
              automne&nbsp;&raquo; plutot que &laquo;&nbsp;image jpg&nbsp;&raquo;)
            </p>
          </div>
        )}

        {/* Results grid */}
        {results.length > 0 && (
          <div>
            <p className="text-xs text-ink-400 mb-2">
              {results.length} resultats (cosine score &gt; 0.18)
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
              {results.map((hit) => (
                <Link
                  key={hit.photo_id}
                  href={`/photos?id=${hit.photo_id}`}
                  className="ga-card ga-card-hover overflow-hidden group relative"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photoThumbUrl(hit.media_id, 256)}
                    alt={hit.filename ?? ''}
                    className="w-full h-32 sm:h-36 object-cover"
                    loading="lazy"
                  />
                  <span className="absolute top-1 right-1 text-[9px] font-mono bg-ink-900/80 text-accent px-1.5 py-0.5 rounded">
                    {(hit.score * 100).toFixed(0)}%
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {!loading && results.length === 0 && searched && q && (
          <div className="panel p-6 text-center text-xs text-ink-400">
            Aucun resultat. Essaie une description plus precise ou plus generale.
          </div>
        )}

        <HubStatus />
      </main>
    </div>
  )
}
