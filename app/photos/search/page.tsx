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
import { Search, Loader2, AlertTriangle, ArrowLeft } from 'lucide-react'
import { Sidebar } from '@/components/sidebar'
import { HubStatus } from '@/components/hub-status'
import { getBaseUrl, photoThumbUrl } from '@/lib/api'

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
  const base = getBaseUrl()
  const [q, setQ] = useState('')
  const [results, setResults] = useState<SearchHit[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<MlStatus | null>(null)
  const [embedding, setEmbedding] = useState(false)

  const fetchStatus = useCallback(async () => {
    try {
      const r = await fetch(`${base}/v1/photos/ml-status`)
      if (r.ok) setStatus(await r.json())
    } catch {
      /* ignore */
    }
  }, [base])

  useEffect(() => {
    fetchStatus()
  }, [fetchStatus])

  const search = useCallback(async () => {
    if (!q.trim()) return
    setLoading(true)
    setError(null)
    try {
      const r = await fetch(
        `${base}/v1/photos/search?q=${encodeURIComponent(q)}&top_k=30&min_score=0.18`,
      )
      if (!r.ok) {
        const data = await r.json().catch(() => ({}))
        throw new Error(data.detail || `HTTP ${r.status}`)
      }
      setResults(await r.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [q, base])

  const triggerEmbed = useCallback(async () => {
    setEmbedding(true)
    setError(null)
    try {
      const r = await fetch(`${base}/v1/photos/embed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit: 100 }),
      })
      if (!r.ok) {
        const data = await r.json().catch(() => ({}))
        throw new Error(data.detail || `HTTP ${r.status}`)
      }
      const data = await r.json()
      await fetchStatus()
      setError(`Batch OK : embedded=${data.embedded}, remaining=${data.total_remaining}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setEmbedding(false)
    }
  }, [base, fetchStatus])

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
              <Search size={20} className="text-accent" />
              Recherche semantique
            </h1>
            <p className="text-xs text-ink-400 mt-0.5">
              Decris ce que tu cherches, l&apos;IA trouve les photos similaires (CLIP)
            </p>
          </div>
        </header>

        {/* Status + setup hint */}
        {status && !status.clip_installed && (
          <div className="panel p-3 border-amber-500/40 flex items-start gap-2">
            <AlertTriangle size={14} className="text-amber-400 shrink-0 mt-0.5" />
            <div className="text-xs">
              <p className="text-ink-200 font-semibold mb-1">CLIP non installe</p>
              <p className="text-ink-400">
                Lance dans hub-core : <code className="font-mono bg-ink-800 px-1">pip install -e .[ml]</code>
                {' '}puis restart uvicorn. Telecharge ~3 GB (torch + open_clip).
              </p>
            </div>
          </div>
        )}

        {status && status.clip_installed && (
          <div className="panel p-3 flex items-center justify-between flex-wrap gap-3 text-xs">
            <div className="text-ink-300">
              <span className="font-mono">{status.total_embeddings}</span> photos embedded sur{' '}
              <span className="font-mono">{status.total_photos}</span>
              {status.embed_remaining > 0 && (
                <span className="text-warn ml-2">({status.embed_remaining} restantes)</span>
              )}
            </div>
            {status.embed_remaining > 0 && (
              <button
                onClick={triggerEmbed}
                disabled={embedding}
                className="px-3 py-1.5 rounded-md text-[10px] font-semibold bg-info/15 border border-info/40 text-info hover:bg-info/25 disabled:opacity-40"
              >
                {embedding ? 'Embed batch 100…' : 'Lancer batch 100'}
              </button>
            )}
          </div>
        )}

        {/* Search input */}
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
              onClick={search}
              disabled={loading || !q.trim()}
              className="px-4 py-2 rounded-md text-sm font-semibold bg-accent/15 border border-accent/40 text-accent hover:bg-accent/25 disabled:opacity-40 inline-flex items-center justify-center gap-1.5"
            >
              {loading ? <Loader2 size={12} className="animate-spin" /> : <Search size={12} />}
              Chercher
            </button>
          </div>
          <p className="text-[10px] text-ink-500 mt-2">
            Astuce : decris la SCENE, pas le format (&laquo;&nbsp;une foret en automne&nbsp;&raquo; plutot que &laquo;&nbsp;image jpg&nbsp;&raquo;)
          </p>
        </div>

        {error && (
          <div className="panel p-3 text-xs text-red-400 font-mono">{error}</div>
        )}

        {/* Results grid */}
        {results.length > 0 && (
          <div>
            <p className="text-xs text-ink-400 mb-2">
              {results.length} resultats (cosine score &gt;0.18)
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
              {results.map((hit) => (
                <Link
                  key={hit.photo_id}
                  href={`/photos?id=${hit.photo_id}`}
                  className="ga-card ga-card-hover overflow-hidden group relative"
                >
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

        {!loading && results.length === 0 && q && !error && (
          <div className="panel p-6 text-center text-xs text-ink-400">
            Aucun resultat. Essaie une description plus precise ou plus generale.
          </div>
        )}

        <HubStatus />
      </main>
    </div>
  )
}
