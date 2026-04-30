'use client'

/**
 * BulkPasswordChecker — scan TOUS tes mots de passe Google contre HIBP.
 *
 * Workflow:
 *  1. Marc va sur https://passwords.google.com → Paramètres → Exporter
 *  2. Télécharge un CSV (5 colonnes: name, url, username, password, note)
 *  3. Drag-drop le CSV ici
 *  4. Pour chaque ligne : SHA-1(password) côté client, query HIBP k-anonymity
 *  5. Affiche tableau interactif: site / username / status / count
 *
 * 100% privacy-preserving:
 *  - Le CSV n'est JAMAIS envoyé à un serveur (parsé localement)
 *  - Seuls les 5 premiers chars du SHA-1 partent à api.pwnedpasswords.com
 *  - Les passwords ne quittent jamais le browser
 *  - Le CSV est en mémoire uniquement (jamais en localStorage)
 *
 * Recommandation: après le scan, supprimer le fichier CSV téléchargé.
 */

import { useRef, useState } from 'react'
import {
  Upload,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Loader2,
  ExternalLink,
  X,
  AlertTriangle,
  Search,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const HIBP_API = 'https://api.pwnedpasswords.com/range'

interface PasswordEntry {
  name: string
  url: string
  username: string
  password: string
  note: string
  // Filled after check
  status: 'pending' | 'safe' | 'pwned' | 'error'
  count?: number
  error?: string
}

async function sha1HexUpper(text: string): Promise<string> {
  const encoded = new TextEncoder().encode(text)
  const buffer = await crypto.subtle.digest('SHA-1', encoded)
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()
}

async function checkOne(password: string, signal?: AbortSignal): Promise<{ count: number } | { error: string }> {
  if (!password) return { error: 'empty' }
  try {
    const hash = await sha1HexUpper(password)
    const prefix = hash.slice(0, 5)
    const suffix = hash.slice(5)
    const resp = await fetch(`${HIBP_API}/${prefix}`, {
      headers: { 'Add-Padding': 'true' },
      signal,
    })
    if (!resp.ok) return { error: `HIBP ${resp.status}` }
    const text = await resp.text()
    for (const line of text.split('\n')) {
      const [s, c] = line.trim().split(':')
      if (s === suffix) {
        const count = parseInt(c, 10)
        if (Number.isFinite(count)) return { count }
      }
    }
    return { count: 0 }
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') return { error: 'aborted' }
    return { error: err instanceof Error ? err.message : 'unknown' }
  }
}

/** Parse CSV simple (RFC4180 partiel). Suffit pour Google export. */
function parseCSV(text: string): PasswordEntry[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim())
  if (lines.length < 2) return []

  // Header line
  const headers = parseCSVLine(lines[0]).map((h) => h.toLowerCase())
  const idx = (key: string) => headers.findIndex((h) => h.includes(key))
  const iName = idx('name')
  const iUrl = idx('url')
  const iUser = idx('username')
  const iPass = idx('password')
  const iNote = idx('note')

  const entries: PasswordEntry[] = []
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i])
    if (cols.length < 4) continue
    entries.push({
      name: cols[iName] ?? '',
      url: cols[iUrl] ?? '',
      username: cols[iUser] ?? '',
      password: cols[iPass] ?? '',
      note: cols[iNote] ?? '',
      status: 'pending',
    })
  }
  return entries
}

function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i++ } else { inQuotes = !inQuotes }
    } else if (c === ',' && !inQuotes) {
      result.push(cur); cur = ''
    } else {
      cur += c
    }
  }
  result.push(cur)
  return result
}

export function BulkPasswordChecker() {
  const [entries, setEntries] = useState<PasswordEntry[] | null>(null)
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [filter, setFilter] = useState<'all' | 'pwned' | 'safe'>('pwned')
  const [searchQuery, setSearchQuery] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  async function handleFile(file: File) {
    if (!file.name.endsWith('.csv')) {
      alert('Le fichier doit être un .csv (export Google passwords)')
      return
    }
    const text = await file.text()
    const parsed = parseCSV(text)
    if (parsed.length === 0) {
      alert('Aucune ligne valide dans le CSV. Format attendu : name, url, username, password, note')
      return
    }
    setEntries(parsed)
    setProgress({ done: 0, total: parsed.length })

    // Cancel previous run
    abortRef.current?.abort()
    const ac = new AbortController()
    abortRef.current = ac

    // Process en parallèle limité (5 concurrent pour pas spam HIBP)
    const concurrency = 5
    let done = 0
    const queue = [...parsed.entries()]
    async function worker() {
      while (queue.length > 0 && !ac.signal.aborted) {
        const next = queue.shift()
        if (!next) break
        const [idx, entry] = next
        const result = await checkOne(entry.password, ac.signal)
        if (ac.signal.aborted) return
        setEntries((prev) => {
          if (!prev) return prev
          const updated = [...prev]
          if ('count' in result) {
            updated[idx] = { ...entry, status: result.count > 0 ? 'pwned' : 'safe', count: result.count }
          } else {
            updated[idx] = { ...entry, status: 'error', error: result.error }
          }
          return updated
        })
        done++
        setProgress({ done, total: parsed.length })
      }
    }
    await Promise.all(Array.from({ length: concurrency }, () => worker()))
  }

  function handleClear() {
    abortRef.current?.abort()
    setEntries(null)
    setProgress({ done: 0, total: 0 })
    setSearchQuery('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // Filter + search
  const visibleEntries = entries?.filter((e) => {
    if (filter === 'pwned' && e.status !== 'pwned') return false
    if (filter === 'safe' && e.status !== 'safe') return false
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      return (e.url + e.username + e.name).toLowerCase().includes(q)
    }
    return true
  }) ?? []

  const stats = entries ? {
    total: entries.length,
    pwned: entries.filter((e) => e.status === 'pwned').length,
    safe: entries.filter((e) => e.status === 'safe').length,
    pending: entries.filter((e) => e.status === 'pending').length,
  } : null

  if (!entries) {
    return (
      <div className="ga-card p-6">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-9 h-9 rounded-lg bg-info/10 border border-info/30 flex items-center justify-center shrink-0">
            <Shield size={16} className="text-info" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-ink-100">Scanner tous tes mots de passe Google</h3>
            <p className="text-xs text-ink-400 leading-relaxed">
              Importe ton export Google Passwords pour voir d&apos;un coup quels mdps sont compromis.
              <strong className="text-ink-200"> 100% local</strong> : le CSV est analysé dans ton browser, jamais envoyé.
            </p>
          </div>
        </div>

        {/* Étapes */}
        <ol className="text-xs text-ink-300 space-y-2 mb-4 ml-2">
          <li className="flex items-start gap-2">
            <span className="font-mono text-accent shrink-0">1.</span>
            <span>
              Va sur{' '}
              <a
                href="https://passwords.google.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent hover:text-accent-light inline-flex items-center gap-1"
              >
                passwords.google.com <ExternalLink size={10} />
              </a>
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-mono text-accent shrink-0">2.</span>
            <span>Clique l&apos;icône <strong>Paramètres</strong> (engrenage en haut à droite) → <strong>&laquo; Exporter les mots de passe &raquo;</strong></span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-mono text-accent shrink-0">3.</span>
            <span>Authentifie-toi · télécharge le CSV</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-mono text-accent shrink-0">4.</span>
            <span>Drag-drop le CSV ici-dessous</span>
          </li>
          <li className="flex items-start gap-2 text-warn">
            <span className="font-mono shrink-0">!</span>
            <span><strong>Supprime le CSV téléchargé</strong> après le scan (sécurité)</span>
          </li>
        </ol>

        {/* Drop zone */}
        <label
          className="block border-2 border-dashed border-ink-700 hover:border-accent/40 rounded-lg p-6 text-center cursor-pointer transition-colors group"
          onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('border-accent/40') }}
          onDragLeave={(e) => e.currentTarget.classList.remove('border-accent/40')}
          onDrop={(e) => {
            e.preventDefault()
            e.currentTarget.classList.remove('border-accent/40')
            const file = e.dataTransfer.files[0]
            if (file) void handleFile(file)
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void handleFile(file)
            }}
          />
          <Upload size={24} className="mx-auto text-ink-500 group-hover:text-accent transition-colors mb-2" />
          <div className="text-sm text-ink-300 mb-1">Glisse-dépose le CSV ici</div>
          <div className="text-[11px] text-ink-500 font-mono">ou clique pour parcourir</div>
        </label>
      </div>
    )
  }

  // Results view
  return (
    <div className="ga-card p-4">
      {/* Header avec stats + clear */}
      <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
        <div>
          <h3 className="text-sm font-semibold text-ink-100 mb-0.5">
            Scan terminé · {stats!.total} mots de passe analysés
          </h3>
          <div className="text-xs text-ink-400">
            {progress.done < progress.total
              ? <span className="inline-flex items-center gap-1.5"><Loader2 size={11} className="animate-spin" /> Analyse {progress.done}/{progress.total}…</span>
              : 'Tous vérifiés contre 700M+ fuites HIBP'}
          </div>
        </div>
        <button
          onClick={handleClear}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-ink-800 border border-ink-700 hover:border-ink-600 text-xs text-ink-300 transition-colors"
        >
          <X size={12} /> Effacer
        </button>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <FilterTile
          label="Compromis"
          value={stats!.pwned}
          icon={ShieldAlert}
          color="data-negative"
          active={filter === 'pwned'}
          onClick={() => setFilter('pwned')}
        />
        <FilterTile
          label="Safe"
          value={stats!.safe}
          icon={ShieldCheck}
          color="data-positive"
          active={filter === 'safe'}
          onClick={() => setFilter('safe')}
        />
        <FilterTile
          label="Tous"
          value={stats!.total}
          icon={Shield}
          color="text-ink-300"
          active={filter === 'all'}
          onClick={() => setFilter('all')}
        />
      </div>

      {/* Search filter */}
      <div className="relative mb-3">
        <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-500" />
        <input
          type="text"
          placeholder="Filtrer par site ou username…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-ink-800 border border-ink-700 rounded-md pl-7 pr-3 py-1.5 text-xs focus:outline-none focus:border-accent/60"
        />
      </div>

      {/* Results table */}
      {visibleEntries.length === 0 ? (
        <div className="text-center py-6 text-xs text-ink-500">
          {filter === 'pwned' && stats!.pwned === 0
            ? '🎉 Aucun mot de passe compromis trouvé !'
            : 'Aucun résultat pour ce filtre.'}
        </div>
      ) : (
        <div className="space-y-1 max-h-[500px] overflow-y-auto -mx-1 px-1">
          {visibleEntries.map((e, i) => (
            <ResultRow key={`${e.url}-${e.username}-${i}`} entry={e} />
          ))}
        </div>
      )}

      {/* Phase 5+ teaser */}
      {stats!.pwned > 0 && progress.done === progress.total && (
        <div className="mt-4 p-3 rounded-md border border-warn/30 bg-warn/5 flex items-start gap-2">
          <AlertTriangle size={14} className="text-warn shrink-0 mt-0.5" />
          <div className="text-xs text-ink-300 leading-relaxed">
            <strong>Action recommandée :</strong> change tes mots de passe compromis en priorité ceux avec le plus de comptes affectés.{' '}
            <span className="text-ink-500">(Phase 5+ : bouton &laquo; Régénérer auto &raquo; qui crée un nouveau mdp + le sauvegarde dans ton gestionnaire.)</span>
          </div>
        </div>
      )}
    </div>
  )
}

function FilterTile({
  label, value, icon: Icon, color, active, onClick,
}: {
  label: string; value: number; icon: LucideIcon; color: string; active: boolean; onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'ga-card ga-card-hover p-2.5 text-left transition-all',
        active && 'ring-1 ring-accent/30 bg-ink-800/40'
      )}
    >
      <div className="flex items-center gap-1.5 mb-1">
        <Icon size={11} className={color} />
        <div className="metric-label">{label}</div>
      </div>
      <div className={cn('metric truncate', color)}>{value}</div>
    </button>
  )
}

function ResultRow({ entry }: { entry: PasswordEntry }) {
  const isPwned = entry.status === 'pwned'
  const isSafe = entry.status === 'safe'
  const isPending = entry.status === 'pending'

  let domain = entry.url
  try {
    domain = new URL(entry.url).hostname.replace(/^www\./, '')
  } catch { /* not a valid URL, keep as is */ }

  return (
    <div className={cn(
      'flex items-center gap-3 p-2 rounded-md text-xs',
      isPwned && 'bg-data-negative/5 border border-data-negative/20',
      isSafe && 'hover:bg-ink-800/50',
      isPending && 'opacity-50'
    )}>
      <div className="shrink-0">
        {isPending && <Loader2 size={14} className="animate-spin text-ink-500" />}
        {isSafe && <ShieldCheck size={14} className="text-data-positive" />}
        {isPwned && <ShieldAlert size={14} className="text-data-negative" />}
        {entry.status === 'error' && <AlertTriangle size={14} className="text-warn" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 truncate">
          <span className="font-medium text-ink-100 truncate">{domain || entry.name || '—'}</span>
          {entry.username && (
            <span className="text-ink-500 text-[11px] truncate font-mono">{entry.username}</span>
          )}
        </div>
      </div>
      {isPwned && entry.count !== undefined && (
        <div className="shrink-0 text-[10px] font-mono font-semibold text-data-negative bg-data-negative/10 px-1.5 py-0.5 rounded border border-data-negative/30">
          {entry.count.toLocaleString('fr-CA')} fuites
        </div>
      )}
      {isSafe && (
        <div className="shrink-0 text-[10px] font-mono text-data-positive">OK</div>
      )}
    </div>
  )
}
