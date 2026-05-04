'use client'

import { motion, AnimatePresence } from 'framer-motion'
import useSWR from 'swr'
import { useState } from 'react'
import { X, MapPin, Clock, Calendar, Hash, Home, Briefcase, Navigation, Sparkles, RefreshCw, Loader2 } from 'lucide-react'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'

const SEMANTIC_LABELS: Record<string, { label: string; hex: string; icon: React.ComponentType<{ size?: number; className?: string }> }> = {
  HOME:              { label: 'Domicile',      hex: '#5cdb95', icon: Home       },
  INFERRED_HOME:     { label: 'Domicile (inf)', hex: '#3db37a', icon: Home      },
  WORK:              { label: 'Travail',       hex: '#5fb3f4', icon: Briefcase  },
  INFERRED_WORK:     { label: 'Travail (inf)', hex: '#3a8fd6', icon: Briefcase  },
  SEARCHED_ADDRESS:  { label: 'Adresse',       hex: '#ffb84d', icon: Navigation },
  ALIASED_LOCATION:  { label: 'Favori',        hex: '#c084fc', icon: Sparkles   },
  UNKNOWN:           { label: 'Lieu inconnu',  hex: '#8b95a3', icon: MapPin     },
}

export interface ClickPopupProps {
  lat: number
  lng: number
  radius?: number
  onClose: () => void
}

export function ClickPopup({ lat, lng, radius = 200, onClose }: ClickPopupProps) {
  const [searchRadius, setSearchRadius] = useState(radius)

  const { data: stats, isLoading } = useSWR(
    ['place-stats', lat, lng, searchRadius],
    () => api.locations.placeStats(lat, lng, searchRadius)
  )

  const [addressLoading, setAddressLoading] = useState(false)
  const [address, setAddress] = useState<string | null>(null)
  const [addressError, setAddressError] = useState<string | null>(null)

  const fetchAddress = async () => {
    setAddressLoading(true); setAddressError(null)
    try {
      const r = await api.locations.reverseGeocode(lat, lng)
      setAddress(r.address ?? 'Adresse inconnue')
    } catch (e: unknown) {
      setAddressError(e instanceof Error ? e.message : String(e))
    } finally { setAddressLoading(false) }
  }

  return (
    <AnimatePresence>
      <motion.div
        key="click-popup"
        initial={{ x: 380, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 380, opacity: 0 }}
        transition={{ type: 'spring', damping: 22, stiffness: 220 }}
        className="absolute top-3 right-3 bottom-3 w-[360px] max-w-[calc(100%-1.5rem)] z-[1000] panel border-accent/30 shadow-2xl flex flex-col overflow-hidden"
        style={{ backgroundColor: 'rgba(13, 17, 23, 0.96)', backdropFilter: 'blur(8px)' }}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-4 pb-3 border-b border-ink-800/60">
          <div>
            <div className="text-[10px] font-mono text-ink-500 mb-0.5">CLIC SUR LA CARTE</div>
            <div className="font-mono text-sm text-ink-100">
              {lat.toFixed(5)}°, {lng.toFixed(5)}°
            </div>
            {address && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="text-xs text-accent mt-1.5 leading-tight">
                📍 {address}
              </motion.div>
            )}
            {!address && (
              <button
                onClick={fetchAddress}
                disabled={addressLoading}
                className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-accent/80 hover:text-accent disabled:opacity-50 transition-colors">
                {addressLoading ? <Loader2 size={10} className="animate-spin" /> : <MapPin size={10} />}
                {addressLoading ? 'Géocodage…' : 'Voir l\'adresse'}
              </button>
            )}
            {addressError && <p className="text-[10px] text-red-400 mt-1">{addressError}</p>}
          </div>
          <button onClick={onClose}
            className="text-ink-400 hover:text-ink-100 transition-colors p-1 rounded hover:bg-ink-800">
            <X size={16} />
          </button>
        </div>

        {/* Rayon picker */}
        <div className="px-4 py-3 border-b border-ink-800/60">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] uppercase tracking-wider font-semibold text-ink-400">Rayon de recherche</span>
            <span className="text-[10px] font-mono text-accent">{searchRadius} m</span>
          </div>
          <input
            type="range" min="50" max="2000" step="50"
            value={searchRadius} onChange={(e) => setSearchRadius(Number(e.target.value))}
            className="w-full accent-accent"
          />
        </div>

        {/* Stats body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw size={18} className="animate-spin text-ink-400" />
            </div>
          ) : !stats || stats.total_visits === 0 ? (
            <div className="text-center py-8">
              <div className="text-3xl mb-2 opacity-50">🚫</div>
              <p className="text-sm text-ink-400">Aucune visite dans ce rayon</p>
              <p className="text-[10px] text-ink-600 font-mono mt-1">Essaie d'augmenter le rayon</p>
            </div>
          ) : (
            <>
              {/* Big numbers */}
              <div className="grid grid-cols-3 gap-2">
                <BigStat icon={Hash}     label="Visites"    value={stats.total_visits.toString()} hex="#5cdb95" />
                <BigStat icon={Clock}    label="Total"      value={fmtMinutes(stats.total_duration_minutes)} hex="#5fb3f4" />
                <BigStat icon={Calendar} label="Moy."       value={fmtMinutes(stats.avg_duration_minutes)} hex="#ffb84d" />
              </div>

              {/* Période */}
              {stats.first_visit && stats.last_visit && (
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-ink-500">Première visite :</span>
                    <span className="font-mono text-ink-200">
                      {new Date(stats.first_visit).toLocaleDateString('fr-CA', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-ink-500">Dernière visite :</span>
                    <span className="font-mono text-ink-200">
                      {new Date(stats.last_visit).toLocaleDateString('fr-CA', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                </div>
              )}

              {/* Breakdown sémantique */}
              {Object.keys(stats.semantic_type_breakdown).length > 0 && (
                <div>
                  <div className="text-[10px] uppercase tracking-wider font-semibold text-ink-400 mb-2">Types détectés</div>
                  <div className="space-y-1.5">
                    {Object.entries(stats.semantic_type_breakdown)
                      .sort(([, a], [, b]) => b - a)
                      .map(([type, count]) => {
                        const meta = SEMANTIC_LABELS[type] ?? SEMANTIC_LABELS.UNKNOWN
                        const Icon = meta.icon
                        const pct = Math.round((count / stats.total_visits) * 100)
                        return (
                          <div key={type} className="flex items-center gap-2">
                            <div className="w-5 h-5 rounded flex items-center justify-center shrink-0"
                              style={{ backgroundColor: meta.hex + '22' }}>
                              <Icon size={11} style={{ color: meta.hex }} />
                            </div>
                            <span className="text-xs flex-1" style={{ color: meta.hex }}>{meta.label}</span>
                            <span className="text-[10px] font-mono text-ink-500">{count} · {pct}%</span>
                          </div>
                        )
                      })}
                  </div>
                </div>
              )}

              {/* Liste des visites */}
              {stats.visits.length > 0 && (
                <div>
                  <div className="text-[10px] uppercase tracking-wider font-semibold text-ink-400 mb-2">
                    Dernières visites ({stats.visits.length})
                  </div>
                  <div className="space-y-1 max-h-[280px] overflow-y-auto pr-1">
                    {stats.visits.map((v) => {
                      const meta = SEMANTIC_LABELS[v.semantic_type ?? 'UNKNOWN'] ?? SEMANTIC_LABELS.UNKNOWN
                      const start = new Date(v.start_time)
                      const end = new Date(v.end_time)
                      const durMin = Math.round((end.getTime() - start.getTime()) / 60000)
                      return (
                        <div key={v.id}
                          className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-ink-800/30 hover:bg-ink-800/60 transition-colors text-xs">
                          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: meta.hex }} />
                          <span className="font-mono text-ink-300 shrink-0">
                            {start.toLocaleDateString('fr-CA', { day: '2-digit', month: 'short', year: '2-digit' })}
                          </span>
                          <span className="text-ink-600">·</span>
                          <span className="font-mono text-ink-400">
                            {start.toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          <span className="ml-auto text-[10px] font-mono text-ink-500 shrink-0">
                            {fmtMinutes(durMin)}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  )
}

function BigStat({ icon: Icon, label, value, hex }: {
  icon: React.ComponentType<{ size?: number; className?: string }>
  label: string; value: string; hex: string
}) {
  return (
    <div className={cn('flex flex-col items-center gap-1 p-2 rounded-lg border')}
      style={{ backgroundColor: hex + '15', borderColor: hex + '40' }}>
      <Icon size={11} style={{ color: hex }} />
      <span className="text-base font-bold font-mono leading-none" style={{ color: hex }}>{value}</span>
      <span className="text-[9px] uppercase tracking-wider font-semibold text-ink-400">{label}</span>
    </div>
  )
}

function fmtMinutes(min: number): string {
  if (min < 60)   return `${Math.round(min)}m`
  if (min < 1440) return `${Math.floor(min / 60)}h${String(Math.round(min % 60)).padStart(2, '0')}`
  return `${Math.round(min / 1440)}j`
}
