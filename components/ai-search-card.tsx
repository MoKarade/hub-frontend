'use client'

import { Sparkles, ArrowUp } from 'lucide-react'
import { useState } from 'react'

const SUGGESTIONS = [
  'Combien j\'ai dépensé en restos en mars ?',
  'Mes abonnements doublons',
  'Email du syndic l\'an dernier',
  'Photos prises à la mer cette année',
  'Où étais-je le 12 mars ?',
]

export function AiSearchCard() {
  const [value, setValue] = useState('')

  return (
    <div className="panel p-5 bg-gradient-to-br from-ink-900 to-ink-900/50 border-ink-700/60">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 rounded-lg bg-accent/15 flex items-center justify-center">
          <Sparkles size={14} className="text-accent" />
        </div>
        <div>
          <div className="text-xs font-semibold text-accent uppercase tracking-wider">
            Demande à ton hub
          </div>
          <div className="text-[10px] text-ink-400 font-mono">qwen 2.5 14b · local</div>
        </div>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          // TODO: appel API /v1/ai/ask
          console.log('ask:', value)
        }}
        className="relative"
      >
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Pose ta question en français…"
          className="w-full bg-ink-800/60 border border-ink-700 rounded-lg px-4 py-3 text-base text-ink-100 placeholder:text-ink-400 focus:outline-none focus:border-accent/60 focus:ring-1 focus:ring-accent/30 transition-colors pr-12"
        />
        <button
          type="submit"
          disabled={!value.trim()}
          className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-md bg-accent text-ink-950 flex items-center justify-center hover:bg-accent-light transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          aria-label="Demander"
        >
          <ArrowUp size={16} strokeWidth={2.5} />
        </button>
      </form>

      <div className="flex flex-wrap gap-1.5 mt-3">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => setValue(s)}
            className="text-[11px] px-2.5 py-1 rounded-full bg-ink-800/60 border border-ink-700 text-ink-300 hover:text-ink-100 hover:border-ink-600 transition-colors"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  )
}
