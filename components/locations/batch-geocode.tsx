'use client'

import { useState, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import useSWR, { mutate } from 'swr'
import { MapPin, Play, StopCircle, RefreshCw, CheckCircle, AlertTriangle, Globe2 } from 'lucide-react'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'

export function BatchGeocodeButton() {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [onlyUnknown, setOnlyUnknown] = useState(false)

  // Poll progress toutes les 2s quand running
  const { data: progress } = useSWR(
    'geocode-progress',
    () => api.locations.geocodeProgress(),
    { refreshInterval: 2000 },
  )

  const { data: addresses } = useSWR(
    'addresses-index',
    () => api.locations.addresses(),
    { refreshInterval: progress?.running ? 5000 : 0 },
  )

  const handleStart = useCallback(async () => {
    setSubmitting(true); setError(null)
    try {
      const res = await api.locations.geocodeBatch({
        only_unknown: onlyUnknown,
        max_cells: 50000,
      })
      if (!res.started) {
        setError(res.message)
      }
      mutate('geocode-progress')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    } finally { setSubmitting(false) }
  }, [onlyUnknown])

  const handleStop = useCallback(async () => {
    try {
      await api.locations.geocodeStop()
      mutate('geocode-progress')
    } catch {/* ignore */}
  }, [])

  // Mutate addresses when progress finishes
  useEffect(() => {
    if (progress && !progress.running && progress.processed > 0) {
      mutate('addresses-index')
    }
  }, [progress?.running, progress?.processed])

  return (
    <div className="panel p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Globe2 size={14} className="text-accent" />
        <span className="text-sm font-semibold">Géocoder tous les lieux</span>
        <span className="ml-auto text-[10px] font-mono text-ink-500">
          {addresses ? `${addresses.total.toLocaleString('fr-CA')} cellules en cache` : '…'}
        </span>
      </div>

      <p className="text-xs text-ink-500">
        Trouve l'adresse exacte (rue, ville, pays) de chaque lieu visité via OpenStreetMap.
        Rate-limit : 1 req/sec → environ <strong className="text-ink-300">50 min pour ~3000 cellules</strong>.
      </p>

      <label className="flex items-center gap-2 text-xs cursor-pointer hover:text-ink-200">
        <input type="checkbox" checked={onlyUnknown} onChange={(e) => setOnlyUnknown(e.target.checked)}
          className="accent-accent" />
        <span className="text-ink-400">Uniquement les visites <span className="font-mono text-amber-400">UNKNOWN</span> (les autres ont déjà un type)</span>
      </label>

      {/* Progress bar */}
      <AnimatePresence>
        {progress?.running && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
            className="space-y-1.5 p-3 rounded-md bg-accent/5 border border-accent/30">
            <div className="flex items-center justify-between text-xs">
              <span className="text-accent font-semibold">
                {progress.processed.toLocaleString('fr-CA')} / {progress.total.toLocaleString('fr-CA')} cellules
              </span>
              <span className="font-mono text-ink-300">
                {progress.pct.toFixed(1)}%
                {progress.eta_seconds !== null && (
                  <span className="text-ink-500 ml-2">
                    ETA {fmtETA(progress.eta_seconds)}
                  </span>
                )}
              </span>
            </div>
            <div className="h-2 bg-ink-800 rounded-full overflow-hidden">
              <motion.div
                animate={{ width: `${progress.pct}%` }}
                transition={{ duration: 0.5 }}
                className="h-full bg-accent" />
            </div>
            <div className="flex items-center justify-between text-[10px] font-mono">
              <span className="text-ink-500">
                ✓ {progress.successes} · ✗ {progress.errors}
              </span>
              {progress.last_address && (
                <span className="text-ink-400 truncate ml-2 max-w-[60%]">
                  → {progress.last_address}
                </span>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Actions */}
      <div className="flex gap-2">
        {!progress?.running ? (
          <button onClick={handleStart} disabled={submitting}
            className={cn('flex-1 py-2 rounded-md text-sm font-semibold border transition-all flex items-center justify-center gap-1.5',
              submitting ? 'opacity-50 cursor-not-allowed border-ink-700 text-ink-400'
                         : 'border-accent/40 text-accent hover:bg-accent/10 active:scale-[0.99]')}>
            {submitting ? <RefreshCw size={13} className="animate-spin" /> : <Play size={13} />}
            {submitting ? 'Démarrage…' : 'Lancer le géocodage'}
          </button>
        ) : (
          <button onClick={handleStop}
            className="flex-1 py-2 rounded-md text-sm font-semibold border border-red-500/40 text-red-400 hover:bg-red-500/10 active:scale-[0.99] transition-all flex items-center justify-center gap-1.5">
            <StopCircle size={13} /> Arrêter
          </button>
        )}
      </div>

      {error && (
        <p className="text-xs text-red-400 font-mono flex items-center gap-1">
          <AlertTriangle size={12} /> {error}
        </p>
      )}

      {/* Sample of geocoded results */}
      {addresses && addresses.total > 0 && (
        <div className="space-y-1 pt-2 border-t border-ink-800/60">
          <div className="text-[10px] uppercase tracking-wider font-semibold text-ink-500 mb-1">
            Derniers lieux trouvés
          </div>
          <div className="space-y-1 max-h-[180px] overflow-y-auto pr-1">
            {addresses.addresses.slice(-10).reverse().map((a) => (
              <div key={`${a.lat_e4}-${a.lng_e4}`} className="flex items-center gap-2 text-xs">
                <MapPin size={9} className="text-ink-500 shrink-0" />
                <span className="text-ink-300 truncate">{a.label ?? '(no address)'}</span>
                {a.country_code && (
                  <span className="ml-auto text-[9px] font-mono text-ink-500 uppercase shrink-0">
                    {a.country_code}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function fmtETA(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`
  return `${Math.floor(seconds / 3600)}h${String(Math.floor((seconds % 3600) / 60)).padStart(2, '0')}`
}
