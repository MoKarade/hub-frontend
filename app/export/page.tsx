'use client'

/**
 * /export — droit d'acces Loi 25 / RGPD self-applique.
 *
 * Telecharge un ZIP avec 1 CSV par table + manifest.json + README.
 * Backend : /v1/export/all?confirm=oui (declenche download via <a href>).
 */

import { useEffect, useState } from 'react'
import {
  Download,
  Loader2,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react'
import { Sidebar } from '@/components/sidebar'
import { HubStatus } from '@/components/hub-status'
import { ErrorState } from '@/components/error-state'
import { api } from '@/lib/api'
import { toast } from '@/lib/toast'

type Preview = { tables: Record<string, number>; total_rows: number }

export default function ExportPage() {
  const [preview, setPreview] = useState<Preview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [includeBodies, setIncludeBodies] = useState(false)
  const [confirmed, setConfirmed] = useState(false)

  useEffect(() => {
    let cancel = false
    api.export
      .preview()
      .then((r) => {
        if (!cancel) {
          setPreview(r)
          setLoading(false)
        }
      })
      .catch((e: Error) => {
        if (!cancel) {
          setError(e.message)
          setLoading(false)
        }
      })
    return () => {
      cancel = true
    }
  }, [])

  const handleDownload = () => {
    if (!confirmed) return
    const url = api.export.downloadUrl({ include_email_bodies: includeBodies })
    // <a href download> = browser-native ZIP download, pas de fetch RAM-bound
    const a = document.createElement('a')
    a.href = url
    a.rel = 'noopener'
    a.click()
    toast.success('Telechargement lance', {
      description: 'Le ZIP arrive dans quelques secondes — surveille les downloads du navigateur.',
    })
  }

  const tableEntries = preview
    ? Object.entries(preview.tables)
        .filter(([, n]) => n >= 0)
        .sort((a, b) => b[1] - a[1])
    : []

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 px-4 sm:px-6 lg:px-8 pt-16 lg:pt-6 pb-6 max-w-[1100px] space-y-5">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Download size={20} className="text-accent" />
            Exporter mes donnees
          </h1>
          <p className="text-sm text-ink-400 mt-1">
            Droit d&apos;acces self-applique — Loi 25 (Quebec) / RGPD (UE).
            Telecharge l&apos;integralite du hub en 1 ZIP (CSV + manifest.json).
          </p>
        </header>

        <section className="panel p-4 border-accent/20 bg-accent/[0.03]">
          <div className="flex items-start gap-3">
            <ShieldCheck size={18} className="text-accent shrink-0 mt-0.5" />
            <div className="text-xs text-ink-300 space-y-1">
              <p>
                <strong className="text-ink-100">Que contient le ZIP&nbsp;?</strong>{' '}
                21 tables CSV (transactions, visites, photos, emails, sante, calendrier...),
                un <code className="text-[10px] bg-ink-800 px-1 py-0.5 rounded">manifest.json</code>{' '}
                avec les counts et la date, et un <code className="text-[10px] bg-ink-800 px-1 py-0.5 rounded">README.txt</code>.
              </p>
              <p>
                <strong className="text-ink-100">Ce qui est exclu&nbsp;:</strong>{' '}
                tokens OAuth chiffres (par design — on ne les exporte pas en clair).
                Le corps des emails est exclu par defaut (taille).
              </p>
              <p className="text-ink-400">
                Stocke ce ZIP dans un endroit sur (PC perso, cloud chiffre).
                Ne le partage avec personne — c&apos;est tout ton hub.
              </p>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-sm font-semibold text-ink-200 mb-2 flex items-center gap-2">
            <span className="w-1 h-4 bg-accent/60 rounded" />
            Apercu du contenu
          </h2>

          {loading && (
            <div className="panel p-6 text-center text-ink-400 text-sm">
              <Loader2 size={16} className="inline animate-spin mr-2" />
              Calcul de l&apos;apercu...
            </div>
          )}

          {error && !loading && (
            <ErrorState error={new Error(error)} onRetry={() => window.location.reload()} />
          )}

          {preview && !loading && (
            <div className="panel p-0 overflow-hidden">
              <div className="px-4 py-3 border-b border-ink-800 flex items-center justify-between">
                <span className="text-xs text-ink-400">
                  {tableEntries.length} tables a exporter
                </span>
                <span className="text-sm font-mono font-semibold text-accent">
                  {preview.total_rows.toLocaleString('fr-CA')} lignes
                </span>
              </div>
              <div className="max-h-[300px] overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="bg-ink-900/60 sticky top-0">
                    <tr className="text-ink-500 uppercase tracking-wider">
                      <th className="text-left px-4 py-2 font-semibold">Table</th>
                      <th className="text-right px-4 py-2 font-semibold">Lignes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tableEntries.map(([name, count]) => (
                      <tr
                        key={name}
                        className="border-t border-ink-800/50 hover:bg-ink-800/30"
                      >
                        <td className="px-4 py-1.5 font-mono text-ink-300">{name}</td>
                        <td className="px-4 py-1.5 text-right font-mono tabular-nums text-ink-200">
                          {count.toLocaleString('fr-CA')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>

        <section>
          <h2 className="text-sm font-semibold text-ink-200 mb-2 flex items-center gap-2">
            <span className="w-1 h-4 bg-accent/60 rounded" />
            Options
          </h2>
          <div className="panel p-4 space-y-3">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={includeBodies}
                onChange={(e) => setIncludeBodies(e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-accent shrink-0"
              />
              <div className="min-w-0">
                <div className="text-sm text-ink-100">
                  Inclure le corps des emails
                </div>
                <div className="text-[11px] text-ink-500 mt-0.5">
                  Augmente la taille du ZIP de plusieurs MB. Garde decoche si tu
                  veux juste les metadonnees (sender, sujet, date).
                </div>
              </div>
            </label>

            <div className="border-t border-ink-800 pt-3">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                  className="mt-0.5 w-4 h-4 accent-accent shrink-0"
                />
                <div className="min-w-0">
                  <div className="text-sm text-ink-100 flex items-center gap-2">
                    <AlertTriangle size={13} className="text-warn" />
                    Je confirme vouloir exporter toutes mes donnees
                  </div>
                  <div className="text-[11px] text-ink-500 mt-0.5">
                    Le ZIP contient TOUT ton hub. Stocke-le dans un endroit sur.
                  </div>
                </div>
              </label>
            </div>
          </div>
        </section>

        <button
          onClick={handleDownload}
          disabled={!confirmed || !preview}
          className="w-full sm:w-auto px-5 py-2.5 rounded-md text-sm font-semibold bg-accent text-ink-950 hover:bg-accent-light disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2 transition-colors"
        >
          {confirmed ? <CheckCircle2 size={15} /> : <Download size={15} />}
          Telecharger le ZIP
        </button>

        <HubStatus />
      </main>
    </div>
  )
}
