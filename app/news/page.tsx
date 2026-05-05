'use client'

/**
 * /news - Actualites Quebec via RSS Google News (Phase 6).
 *
 * Source: https://news.google.com/rss?hl=fr-CA&gl=CA&ceid=CA%3Afr (gratuit, sans auth).
 * Auto-sync toutes les 30 min via le scheduler backend.
 *
 * UI :
 *  - Liste des articles tries par date desc
 *  - Filtres : source, recherche texte, "depuis hier" / "cette semaine"
 *  - Bouton "Ouvrir dans nouvel onglet" -> redirige vers la source
 *  - Strip "Top sources" en haut pour filtrer en 1 clic
 */

import useSWR from 'swr'
import { Sidebar } from '@/components/sidebar'
import { HubStatus } from '@/components/hub-status'
import { useState } from 'react'
import {
  Newspaper,
  RefreshCw,
  ExternalLink,
  Search,
  X,
  Loader2,
  AlertCircle,
} from 'lucide-react'
import { cn, formatRelative } from '@/lib/utils'

interface NewsItem {
  id: string
  guid: string
  title: string
  link: string
  summary: string | null
  source: string | null
  category: string | null
  image_url: string | null
  published_at: string
  feed_url: string
}
interface NewsStats {
  total: number
  by_source: Array<{ source: string; count: number }>
  by_day: Array<{ day: string; count: number }>
  last_sync: string | null
}

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    return r.json()
  })

export default function NewsPage() {
  const [search, setSearch] = useState('')
  const [activeSource, setActiveSource] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)

  const queryParams = new URLSearchParams()
  queryParams.set('limit', '100')
  if (activeSource) queryParams.set('source', activeSource)
  if (search.trim()) queryParams.set('q', search.trim())

  const articles = useSWR<NewsItem[]>(
    `/api/v1/news?${queryParams.toString()}`,
    fetcher,
    { refreshInterval: 60000 },
  )
  const stats = useSWR<NewsStats>('/api/v1/news/stats', fetcher, {
    refreshInterval: 300000,
  })

  async function handleSync() {
    setSyncing(true)
    try {
      const res = await fetch('/api/v1/news/sync', { method: 'POST' })
      const data = await res.json()
      await Promise.all([articles.mutate(), stats.mutate()])
      alert(`Sync OK · ${data.ingested} nouveaux, ${data.updated} maj`)
    } catch (e) {
      alert('Erreur sync : ' + (e as Error).message)
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />

      <main className="flex-1 px-4 sm:px-6 lg:px-8 pt-16 lg:pt-6 pb-6 max-w-[1400px] flex flex-col">
        {/* ── Header ── */}
        <header className="mb-4 flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
              <Newspaper size={20} className="text-accent" />
              Actualites
            </h1>
            <p className="text-xs text-ink-400 font-mono">
              {stats.data?.total ?? '—'} articles ·
              {stats.data?.last_sync
                ? ` derniere sync ${formatRelative(stats.data.last_sync)}`
                : ' jamais sync'}{' '}
              · auto-sync 30 min
            </p>
          </div>
          <button
            type="button"
            onClick={handleSync}
            disabled={syncing}
            className="text-[11px] font-mono uppercase tracking-wider text-ink-400 hover:text-accent transition-colors px-3 py-1.5 rounded border border-ink-700 hover:border-accent flex items-center gap-1.5 disabled:opacity-50"
          >
            {syncing ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
            sync
          </button>
        </header>

        {/* ── Search bar + active filter chip ── */}
        <div className="flex flex-wrap gap-2 mb-3">
          <div className="ga-card flex items-center gap-2 px-3 py-1.5 flex-1 min-w-[200px]">
            <Search size={12} className="text-ink-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cherche dans les titres…"
              className="flex-1 bg-transparent outline-none text-sm text-ink-100 placeholder:text-ink-500"
            />
            {search && (
              <button onClick={() => setSearch('')} className="text-ink-500 hover:text-ink-300">
                <X size={12} />
              </button>
            )}
          </div>
          {activeSource && (
            <button
              onClick={() => setActiveSource(null)}
              className="ga-card px-3 py-1.5 text-xs flex items-center gap-1.5 text-accent border-accent/40"
            >
              {activeSource} <X size={11} />
            </button>
          )}
        </div>

        {/* ── Top sources strip ── */}
        {stats.data?.by_source && stats.data.by_source.length > 0 && (
          <div className="ga-card p-3 mb-4">
            <div className="metric-label mb-2">Top sources</div>
            <div className="flex flex-wrap gap-1.5">
              {stats.data.by_source.slice(0, 12).map((s) => (
                <button
                  key={s.source}
                  type="button"
                  onClick={() =>
                    setActiveSource((prev) => (prev === s.source ? null : s.source))
                  }
                  className={cn(
                    'px-2.5 py-1 text-[11px] font-mono rounded-full border transition-colors',
                    activeSource === s.source
                      ? 'bg-accent/15 border-accent/40 text-accent'
                      : 'bg-ink-800 border-ink-700 text-ink-300 hover:border-ink-600',
                  )}
                >
                  {s.source} <span className="text-ink-500">({s.count})</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Articles list ── */}
        {articles.isLoading && (
          <div className="space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="ga-card p-4 h-20 skeleton" />
            ))}
          </div>
        )}

        {articles.error && (
          <div className="ga-card p-4 border-data-negative/30 bg-data-negative/5 flex items-start gap-3">
            <AlertCircle size={16} className="text-data-negative shrink-0" />
            <div>
              <div className="text-sm font-semibold text-ink-100 mb-1">
                Impossible de charger les actualites
              </div>
              <p className="text-xs text-ink-300">{String((articles.error as Error).message)}</p>
            </div>
          </div>
        )}

        {!articles.isLoading && articles.data && articles.data.length === 0 && (
          <div className="ga-card p-8 text-center">
            <Newspaper size={28} className="text-ink-500 mx-auto mb-2" />
            <div className="text-sm font-semibold text-ink-100 mb-1">Aucun article</div>
            <p className="text-xs text-ink-500">
              {search || activeSource
                ? 'Aucun article ne correspond. Essaie de retirer les filtres.'
                : 'Clique sync pour pull les dernieres actualites.'}
            </p>
          </div>
        )}

        {!articles.isLoading && articles.data && articles.data.length > 0 && (
          <div className="space-y-2 flex-1">
            {articles.data.map((a) => (
              <ArticleRow key={a.id} article={a} />
            ))}
          </div>
        )}

        <div className="mt-4">
          <HubStatus />
        </div>
      </main>
    </div>
  )
}

function ArticleRow({ article }: { article: NewsItem }) {
  // Strip le suffixe " - Source" du titre puisqu'on l'affiche separement
  const cleanTitle = article.source
    ? article.title.replace(new RegExp(` - ${escapeRegExp(article.source)}$`), '')
    : article.title

  return (
    <a
      href={article.link}
      target="_blank"
      rel="noopener noreferrer"
      className="ga-card ga-card-hover p-3.5 block group hover:border-accent/40 transition-colors"
    >
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            {article.source && (
              <span className="text-[10px] font-mono uppercase tracking-wider text-accent bg-accent/10 border border-accent/30 px-1.5 py-0.5 rounded">
                {article.source}
              </span>
            )}
            <span className="text-[10px] font-mono text-ink-500">
              {formatRelative(article.published_at)}
            </span>
          </div>
          <h3 className="text-[14px] text-ink-100 leading-snug group-hover:text-accent transition-colors">
            {cleanTitle}
          </h3>
          {article.summary && (
            <p className="text-[12px] text-ink-400 leading-snug mt-1.5 line-clamp-2">
              {article.summary}
            </p>
          )}
        </div>
        <ExternalLink
          size={14}
          className="text-ink-500 group-hover:text-accent shrink-0 mt-1 transition-colors"
        />
      </div>
    </a>
  )
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
