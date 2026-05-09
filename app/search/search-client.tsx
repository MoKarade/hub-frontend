'use client'

/**
 * Client component pour /search?q=... — multi-search parallele :
 *  - Emails    : api.emails.list({ q })
 *  - Browser   : api.browser.history({ q })
 *  - Drive     : api.drive.files({ q })
 *  - Photos    : api.photosMl.search(q) — ML CLIP si dispo
 *
 * Resultats groupes par source, chaque section affiche compteur + top 5.
 * CTA "Poser cette question au hub" -> redirige vers / avec ask=q (chat IA).
 */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Search,
  Mail,
  Globe,
  FileText,
  Image as ImageIcon,
  Sparkles,
  Loader2,
  ArrowRight,
} from 'lucide-react'
import {
  api,
  photoThumbUrl,
  type EmailListItem,
  type BrowserHistoryItem,
  type DriveFileItem,
} from '@/lib/api'
import { EmptyState } from '@/components/empty-state'

type PhotoMlHit = {
  photo_id: string
  media_id: string
  filename: string | null
  score: number
}

interface MultiResults {
  emails: { data: EmailListItem[] | null; error: string | null }
  browser: { data: BrowserHistoryItem[] | null; error: string | null }
  drive: { data: DriveFileItem[] | null; error: string | null }
  photos: { data: PhotoMlHit[] | null; error: string | null }
}

const PER_SOURCE_LIMIT = 8

export function SearchClient({ query }: { query: string }) {
  const [results, setResults] = useState<MultiResults | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancel = false
    setLoading(true)
    setResults(null)

    Promise.allSettled([
      api.emails.list({ q: query, limit: PER_SOURCE_LIMIT }),
      api.browser.history({ q: query, limit: PER_SOURCE_LIMIT, since_days: 365 }),
      api.drive.files({ q: query, limit: PER_SOURCE_LIMIT }),
      api.photosMl.search(query, { top_k: PER_SOURCE_LIMIT }),
    ]).then(([emailsR, browserR, driveR, photosR]) => {
      if (cancel) return
      setResults({
        emails: settledToResult(emailsR),
        browser: settledToResult(browserR),
        drive: settledToResult(driveR),
        photos: settledToResult(photosR),
      })
      setLoading(false)
    })

    return () => {
      cancel = true
    }
  }, [query])

  const total =
    (results?.emails.data?.length ?? 0) +
    (results?.browser.data?.length ?? 0) +
    (results?.drive.data?.length ?? 0) +
    (results?.photos.data?.length ?? 0)

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <Search size={20} className="text-accent" />
          Resultats pour <span className="text-accent">&laquo;&nbsp;{query}&nbsp;&raquo;</span>
        </h1>
        <p className="text-sm text-ink-400 mt-1">
          {loading
            ? 'Recherche dans 4 sources en parallele...'
            : `${total} resultat${total > 1 ? 's' : ''} dans 4 sources`}
        </p>
      </header>

      <Link
        href={`/?ask=${encodeURIComponent(query)}`}
        className="panel p-4 flex items-center gap-3 hover:border-accent/40 transition-colors group"
      >
        <Sparkles size={18} className="text-accent shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-ink-100">
            Poser cette question au hub
          </div>
          <div className="text-xs text-ink-500 mt-0.5">
            L&apos;IA peut interroger la DB pour repondre directement (RAG cross-source).
          </div>
        </div>
        <ArrowRight
          size={14}
          className="text-ink-500 group-hover:text-accent shrink-0"
        />
      </Link>

      {loading && (
        <div className="panel p-12 text-center text-ink-400">
          <Loader2 size={20} className="inline animate-spin" />
        </div>
      )}

      {results && total === 0 && !loading && (
        <EmptyState
          variant="no-data"
          title="Aucun resultat"
          description={`Aucune source du hub ne contient "${query}". Essaie d'autres mots cles ou pose la question au chat IA.`}
        />
      )}

      {results && (
        <>
          <SourceSection
            icon={<Mail size={15} />}
            title="Emails"
            count={results.emails.data?.length ?? 0}
            error={results.emails.error}
            href="/emails"
          >
            {results.emails.data?.slice(0, PER_SOURCE_LIMIT).map((e) => (
              <Link
                key={e.id}
                href={`/emails?email_id=${e.id}`}
                className="block py-2 px-3 rounded hover:bg-ink-800/50 transition-colors"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm text-ink-100 truncate font-medium">
                    {e.subject ?? '(sans sujet)'}
                  </span>
                  <span className="text-[10px] text-ink-500 font-mono shrink-0">
                    {new Date(e.sent_at).toLocaleDateString('fr-CA')}
                  </span>
                </div>
                <div className="text-[11px] text-ink-400 truncate mt-0.5">
                  {e.sender_email}
                  {e.snippet ? ` — ${e.snippet}` : ''}
                </div>
              </Link>
            ))}
          </SourceSection>

          <SourceSection
            icon={<Globe size={15} />}
            title="Navigation"
            count={results.browser.data?.length ?? 0}
            error={results.browser.error}
            href="/browser"
          >
            {results.browser.data?.slice(0, PER_SOURCE_LIMIT).map((b) => (
              <a
                key={b.id}
                href={b.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block py-2 px-3 rounded hover:bg-ink-800/50 transition-colors"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm text-ink-100 truncate font-medium">
                    {b.title ?? b.url}
                  </span>
                  <span className="text-[10px] text-ink-500 font-mono shrink-0">
                    {new Date(b.visited_at).toLocaleDateString('fr-CA')}
                  </span>
                </div>
                <div className="text-[11px] text-ink-500 truncate mt-0.5 font-mono">
                  {b.domain}
                </div>
              </a>
            ))}
          </SourceSection>

          <SourceSection
            icon={<FileText size={15} />}
            title="Drive"
            count={results.drive.data?.length ?? 0}
            error={results.drive.error}
            href="/documents"
          >
            {results.drive.data?.slice(0, PER_SOURCE_LIMIT).map((f) => (
              <a
                key={f.id}
                href={f.web_view_link ?? '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="block py-2 px-3 rounded hover:bg-ink-800/50 transition-colors"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm text-ink-100 truncate font-medium">
                    {f.name ?? '(sans nom)'}
                  </span>
                  {f.modified_time && (
                    <span className="text-[10px] text-ink-500 font-mono shrink-0">
                      {new Date(f.modified_time).toLocaleDateString('fr-CA')}
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-ink-500 truncate mt-0.5 font-mono">
                  {f.mime_type}
                </div>
              </a>
            ))}
          </SourceSection>

          <SourceSection
            icon={<ImageIcon size={15} />}
            title="Photos (ML CLIP)"
            count={results.photos.data?.length ?? 0}
            error={results.photos.error}
            href="/photos"
          >
            {results.photos.data && results.photos.data.length > 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2 p-2">
                {results.photos.data.slice(0, PER_SOURCE_LIMIT).map((p) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={p.photo_id}
                    src={photoThumbUrl(p.media_id, 200)}
                    alt={p.filename ?? ''}
                    className="aspect-square w-full object-cover rounded border border-ink-800"
                    title={`${p.filename ?? ''} · score ${p.score.toFixed(2)}`}
                  />
                ))}
              </div>
            )}
          </SourceSection>
        </>
      )}
    </div>
  )
}

function settledToResult<T>(
  r: PromiseSettledResult<T>
): { data: T | null; error: string | null } {
  if (r.status === 'fulfilled') return { data: r.value, error: null }
  const msg = r.reason instanceof Error ? r.reason.message : String(r.reason)
  return { data: null, error: msg }
}

function SourceSection({
  icon,
  title,
  count,
  error,
  href,
  children,
}: {
  icon: React.ReactNode
  title: string
  count: number
  error: string | null
  href: string
  children: React.ReactNode
}) {
  if (count === 0 && !error) return null
  return (
    <section>
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-semibold text-ink-200 flex items-center gap-2">
          <span className="text-accent">{icon}</span>
          {title}
          <span className="text-ink-500 font-mono font-normal">({count})</span>
        </h2>
        <Link
          href={href}
          className="text-[11px] text-ink-400 hover:text-accent flex items-center gap-1"
        >
          Voir tout <ArrowRight size={10} />
        </Link>
      </div>
      <div className="panel p-1">
        {error ? (
          <div className="text-[11px] text-data-negative px-3 py-2">
            Erreur source : {error}
          </div>
        ) : (
          children
        )}
      </div>
    </section>
  )
}
