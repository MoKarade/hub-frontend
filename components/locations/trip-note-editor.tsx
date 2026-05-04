'use client'

import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { mutate } from 'swr'
import { X, Save, Star, Edit3 } from 'lucide-react'
import { api, type TripNote } from '@/lib/api'
import { cn } from '@/lib/utils'

export function TripNoteButton({ startDate, endDate, existingNote }: {
  startDate: string
  endDate: string
  existingNote?: TripNote | null
}) {
  const [open, setOpen] = useState(false)

  const hasNote = !!existingNote && existingNote.content.trim().length > 0

  return (
    <>
      <button onClick={(e) => { e.stopPropagation(); setOpen(true) }}
        className={cn('flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono transition-all',
          hasNote
            ? 'bg-amber-500/15 border border-amber-500/40 text-amber-300 hover:bg-amber-500/25'
            : 'bg-ink-800 border border-ink-700 text-ink-400 hover:border-ink-500 hover:text-ink-200')}>
        <Edit3 size={9} />
        {hasNote ? '✎ Note' : 'Ajouter note'}
        {existingNote?.rating && (
          <span className="text-amber-400">{'★'.repeat(existingNote.rating)}</span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <TripNoteModal startDate={startDate} endDate={endDate}
            existing={existingNote ?? null}
            onClose={() => setOpen(false)} />
        )}
      </AnimatePresence>
    </>
  )
}

function TripNoteModal({ startDate, endDate, existing, onClose }: {
  startDate: string; endDate: string
  existing: TripNote | null
  onClose: () => void
}) {
  const [title, setTitle] = useState(existing?.title ?? '')
  const [content, setContent] = useState(existing?.content ?? '')
  const [rating, setRating] = useState<number | null>(existing?.rating ?? null)
  const [saving, setSaving] = useState(false)

  const handleSave = useCallback(async () => {
    if (!content.trim() && !title.trim() && rating === null) {
      onClose(); return
    }
    setSaving(true)
    try {
      await api.locations.tripNotes.upsert({
        start_date: startDate, end_date: endDate,
        title: title.trim() || undefined, content: content,
        rating: rating ?? undefined,
      })
      mutate('trip-notes-all')
      onClose()
    } finally { setSaving(false) }
  }, [title, content, rating, startDate, endDate, onClose])

  const handleDelete = useCallback(async () => {
    if (!existing || !confirm('Supprimer cette note ?')) return
    setSaving(true)
    try {
      await api.locations.tripNotes.delete(startDate)
      mutate('trip-notes-all')
      onClose()
    } finally { setSaving(false) }
  }, [existing, startDate, onClose])

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={(e) => { e.stopPropagation(); if (e.target === e.currentTarget) onClose() }}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
        className="panel w-full max-w-lg p-5 space-y-3 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-wider font-semibold text-accent mb-0.5">
              Note de voyage
            </div>
            <div className="text-xs font-mono text-ink-400">
              {new Date(startDate).toLocaleDateString('fr-CA', { day: 'numeric', month: 'short', year: 'numeric' })}
              {' → '}
              {new Date(endDate).toLocaleDateString('fr-CA', { day: 'numeric', month: 'short', year: 'numeric' })}
            </div>
          </div>
          <button onClick={onClose} className="text-ink-500 hover:text-ink-200">
            <X size={16} />
          </button>
        </div>

        <input type="text" placeholder="Titre (ex: Vacances Provence)"
          value={title} onChange={(e) => setTitle(e.target.value)}
          className="w-full bg-ink-800 border border-ink-700 rounded-md px-3 py-2 text-sm focus:border-accent/50 outline-none" />

        <div>
          <label className="block text-[10px] uppercase tracking-wider font-semibold text-ink-400 mb-1">Note</label>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} onClick={() => setRating(rating === n ? null : n)}
                className="text-2xl transition-colors"
                style={{ color: (rating ?? 0) >= n ? '#fbbf24' : '#374151' }}>
                ★
              </button>
            ))}
            {rating !== null && (
              <button onClick={() => setRating(null)} className="text-xs text-ink-500 ml-2 hover:text-ink-200">
                effacer
              </button>
            )}
          </div>
        </div>

        <div>
          <label className="block text-[10px] uppercase tracking-wider font-semibold text-ink-400 mb-1">
            Souvenirs, anecdotes, todo, etc.
          </label>
          <textarea placeholder="Ce qui s'est passé, qui tu as vu, ce que tu as fait, retours..."
            value={content} onChange={(e) => setContent(e.target.value)}
            rows={8}
            className="w-full bg-ink-800 border border-ink-700 rounded-md px-3 py-2 text-sm focus:border-accent/50 outline-none resize-none font-mono leading-relaxed" />
          <div className="flex justify-end mt-1">
            <span className="text-[10px] font-mono text-ink-600">{content.length} caractères</span>
          </div>
        </div>

        <div className="flex gap-2 pt-2 border-t border-ink-800/60">
          {existing && (
            <button onClick={handleDelete} disabled={saving}
              className="px-3 py-2 rounded text-xs font-semibold border border-red-500/30 text-red-400 hover:bg-red-500/10 disabled:opacity-40">
              🗑 Supprimer
            </button>
          )}
          <button onClick={onClose}
            className="px-4 py-2 rounded text-xs font-semibold border border-ink-700 text-ink-400 hover:border-ink-500 ml-auto">
            Annuler
          </button>
          <button onClick={handleSave} disabled={saving}
            className={cn('px-4 py-2 rounded text-xs font-semibold border transition-all flex items-center gap-1.5',
              saving ? 'opacity-40 cursor-not-allowed border-ink-700 text-ink-400'
                     : 'border-accent/40 text-accent hover:bg-accent/10 active:scale-[0.99]')}>
            <Save size={11} />
            {saving ? 'Sauvegarde…' : 'Enregistrer'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}
