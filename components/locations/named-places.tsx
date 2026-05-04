'use client'

import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import useSWR, { mutate } from 'swr'
import {
  Star, Home, Briefcase, Trees, Dumbbell, Coffee, ShoppingCart, Building2,
  Plane, Heart, Plus, Trash2, Edit2, X, Save, MapPin, Sparkles,
} from 'lucide-react'
import { api, type NamedPlace } from '@/lib/api'
import { cn } from '@/lib/utils'

const ICON_OPTIONS = [
  { id: 'home',     icon: Home,         label: 'Maison'    },
  { id: 'work',     icon: Briefcase,    label: 'Travail'   },
  { id: 'family',   icon: Heart,        label: 'Famille'   },
  { id: 'cabin',    icon: Trees,        label: 'Chalet'    },
  { id: 'gym',      icon: Dumbbell,     label: 'Sport'     },
  { id: 'cafe',     icon: Coffee,       label: 'Resto'     },
  { id: 'shop',     icon: ShoppingCart, label: 'Course'    },
  { id: 'office',   icon: Building2,    label: 'Bureau'    },
  { id: 'travel',   icon: Plane,        label: 'Voyage'    },
  { id: 'star',     icon: Star,         label: 'Favori'    },
  { id: 'sparkle',  icon: Sparkles,     label: 'Spécial'   },
  { id: 'pin',      icon: MapPin,       label: 'Lieu'      },
]

const COLOR_OPTIONS = ['#5cdb95', '#5fb3f4', '#ffb84d', '#c084fc', '#fb923c', '#ef4444', '#34d399', '#fbbf24']

function getIconComponent(iconName: string | null) {
  return ICON_OPTIONS.find(o => o.id === iconName)?.icon ?? MapPin
}

export function NamedPlacesPanel() {
  const { data: places } = useSWR('named-places', () => api.locations.namedPlaces.list())
  const [editing, setEditing] = useState<NamedPlace | null>(null)
  const [creating, setCreating] = useState(false)

  const handleSave = useCallback(async (data: Partial<NamedPlace>) => {
    if (editing) {
      await api.locations.namedPlaces.update(editing.id, {
        ...data, lat: data.lat ? parseFloat(data.lat as string) : undefined,
        lng: data.lng ? parseFloat(data.lng as string) : undefined,
      } as Parameters<typeof api.locations.namedPlaces.update>[1])
    } else {
      await api.locations.namedPlaces.create({
        name: data.name as string,
        lat: parseFloat(data.lat as string),
        lng: parseFloat(data.lng as string),
        radius_m: data.radius_m ?? 200,
        icon: data.icon ?? undefined,
        color: data.color ?? undefined,
        notes: data.notes ?? undefined,
      })
    }
    mutate('named-places')
    setEditing(null); setCreating(false)
  }, [editing])

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm('Supprimer ce lieu ?')) return
    await api.locations.namedPlaces.delete(id)
    mutate('named-places')
  }, [])

  return (
    <div className="panel p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Star size={14} className="text-amber-400" />
        <span className="text-sm font-semibold">Mes lieux nommés</span>
        <span className="ml-auto text-[10px] font-mono text-ink-500">
          {places?.length ?? 0} défini{places && places.length > 1 ? 's' : ''}
        </span>
        <button onClick={() => setCreating(true)}
          className="px-2 py-1 rounded text-[10px] font-semibold border border-accent/40 text-accent hover:bg-accent/10 flex items-center gap-1">
          <Plus size={11} /> Ajouter
        </button>
      </div>

      <p className="text-[10px] text-ink-500">
        Donne un nom à tes lieux clés (Chalet, Parents, Gym, …). Une icône custom apparaîtra sur la carte.
      </p>

      {/* Liste */}
      <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
        <AnimatePresence>
          {places?.map((p) => {
            const Icon = getIconComponent(p.icon)
            const color = p.color ?? '#5cdb95'
            return (
              <motion.div key={p.id}
                initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="p-2.5 rounded-md bg-ink-800/40 border border-ink-700/40 group flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                  style={{ backgroundColor: color + '22', border: `1px solid ${color}40` }}>
                  <Icon size={14} style={{ color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-ink-200 truncate">{p.name}</div>
                  <div className="text-[10px] text-ink-500 font-mono truncate">
                    {parseFloat(p.lat).toFixed(4)}°, {parseFloat(p.lng).toFixed(4)}° · ⌀ {p.radius_m}m
                  </div>
                  {p.notes && <div className="text-[10px] text-ink-400 truncate italic">{p.notes}</div>}
                </div>
                <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                  <button onClick={() => setEditing(p)}
                    className="w-7 h-7 rounded flex items-center justify-center bg-ink-800 border border-ink-700 hover:border-ink-500 text-ink-400 hover:text-ink-200">
                    <Edit2 size={11} />
                  </button>
                  <button onClick={() => handleDelete(p.id)}
                    className="w-7 h-7 rounded flex items-center justify-center bg-ink-800 border border-ink-700 hover:border-red-500/40 text-ink-400 hover:text-red-400">
                    <Trash2 size={11} />
                  </button>
                </div>
              </motion.div>
            )
          })}
          {places?.length === 0 && !creating && (
            <p className="text-xs text-ink-500 italic text-center py-4">
              Aucun lieu nommé. Click "+ Ajouter" pour commencer.
            </p>
          )}
        </AnimatePresence>
      </div>

      {/* Editor (creating ou editing) */}
      <AnimatePresence>
        {(creating || editing) && (
          <PlaceEditor
            place={editing}
            onSave={handleSave}
            onCancel={() => { setCreating(false); setEditing(null) }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

function PlaceEditor({ place, onSave, onCancel }: {
  place: NamedPlace | null
  onSave: (data: Partial<NamedPlace>) => Promise<void>
  onCancel: () => void
}) {
  const [name, setName] = useState(place?.name ?? '')
  const [lat, setLat] = useState(place?.lat ?? '')
  const [lng, setLng] = useState(place?.lng ?? '')
  const [radius, setRadius] = useState(place?.radius_m ?? 200)
  const [icon, setIcon] = useState(place?.icon ?? 'pin')
  const [color, setColor] = useState(place?.color ?? '#5cdb95')
  const [notes, setNotes] = useState(place?.notes ?? '')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async () => {
    if (!name.trim() || !lat || !lng) return
    setSaving(true)
    try {
      await onSave({ name: name.trim(), lat, lng, radius_m: radius, icon, color, notes: notes.trim() || null } as Partial<NamedPlace>)
    } finally { setSaving(false) }
  }

  return (
    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="p-3 rounded-md bg-ink-900/60 border border-accent/30 space-y-2 overflow-hidden">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wider font-semibold text-accent">
          {place ? 'Modifier' : 'Nouveau lieu'}
        </span>
        <button onClick={onCancel} className="text-ink-500 hover:text-ink-200">
          <X size={14} />
        </button>
      </div>

      <input type="text" placeholder="Nom (ex: Maison parents, Chalet)"
        value={name} onChange={(e) => setName(e.target.value)}
        className="w-full bg-ink-800 border border-ink-700 rounded px-3 py-1.5 text-sm focus:border-accent/50 outline-none" />

      <div className="grid grid-cols-2 gap-2">
        <input type="number" step="0.0001" placeholder="Latitude"
          value={lat as string} onChange={(e) => setLat(e.target.value)}
          className="bg-ink-800 border border-ink-700 rounded px-2 py-1.5 text-xs font-mono focus:border-accent/50 outline-none" />
        <input type="number" step="0.0001" placeholder="Longitude"
          value={lng as string} onChange={(e) => setLng(e.target.value)}
          className="bg-ink-800 border border-ink-700 rounded px-2 py-1.5 text-xs font-mono focus:border-accent/50 outline-none" />
      </div>

      <div>
        <label className="block text-[10px] uppercase tracking-wider text-ink-500 mb-1">Rayon : {radius}m</label>
        <input type="range" min="50" max="2000" step="50" value={radius}
          onChange={(e) => setRadius(Number(e.target.value))} className="w-full accent-accent" />
      </div>

      <div>
        <label className="block text-[10px] uppercase tracking-wider text-ink-500 mb-1">Icône</label>
        <div className="grid grid-cols-6 gap-1">
          {ICON_OPTIONS.map((o) => {
            const Icon = o.icon
            return (
              <button key={o.id} onClick={() => setIcon(o.id)}
                title={o.label}
                className={cn('w-8 h-8 rounded flex items-center justify-center transition-all',
                  icon === o.id ? 'bg-accent/20 border border-accent' : 'bg-ink-800 border border-ink-700 hover:border-ink-500')}>
                <Icon size={13} className={icon === o.id ? 'text-accent' : 'text-ink-400'} />
              </button>
            )
          })}
        </div>
      </div>

      <div>
        <label className="block text-[10px] uppercase tracking-wider text-ink-500 mb-1">Couleur</label>
        <div className="flex gap-1">
          {COLOR_OPTIONS.map((c) => (
            <button key={c} onClick={() => setColor(c)}
              className={cn('w-7 h-7 rounded transition-transform',
                color === c ? 'ring-2 ring-offset-1 ring-offset-ink-900 ring-white scale-110' : 'hover:scale-105')}
              style={{ backgroundColor: c }} />
          ))}
        </div>
      </div>

      <textarea placeholder="Notes (optionnel)..."
        value={notes} onChange={(e) => setNotes(e.target.value)}
        rows={2}
        className="w-full bg-ink-800 border border-ink-700 rounded px-3 py-1.5 text-xs focus:border-accent/50 outline-none resize-none" />

      <button onClick={handleSubmit} disabled={saving || !name.trim() || !lat || !lng}
        className={cn('w-full py-2 rounded text-sm font-semibold border transition-all flex items-center justify-center gap-1.5',
          saving || !name.trim() || !lat || !lng
            ? 'opacity-40 cursor-not-allowed border-ink-700 text-ink-400'
            : 'border-accent/40 text-accent hover:bg-accent/10 active:scale-[0.99]')}>
        <Save size={13} />
        {saving ? 'Enregistrement…' : (place ? 'Mettre à jour' : 'Créer le lieu')}
      </button>
    </motion.div>
  )
}
