'use client'

/**
 * PasswordChecker — vérifie si un mot de passe a fuité dans une data breach.
 *
 * Utilise l'API gratuite Pwned Passwords (no clé requise) avec k-anonymity :
 *  1. SHA-1(password) côté browser (jamais envoyé à un serveur)
 *  2. Envoie les 5 premiers chars du hash à api.pwnedpasswords.com
 *  3. L'API renvoie ~800 suffixes de hash matching
 *  4. On cherche notre suffix complet dans la réponse → count
 *
 * Le password lui-même reste 100% côté client. Privacy-preserving.
 *
 * Doc : https://haveibeenpwned.com/API/v3#PwnedPasswords
 */

import { useState } from 'react'
import { Eye, EyeOff, Shield, ShieldAlert, ShieldCheck, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

const HIBP_API = 'https://api.pwnedpasswords.com/range'

type CheckResult =
  | { status: 'idle' }
  | { status: 'checking' }
  | { status: 'safe' }
  | { status: 'pwned'; count: number }
  | { status: 'error'; message: string }

async function sha1HexUpper(text: string): Promise<string> {
  const encoded = new TextEncoder().encode(text)
  const buffer = await crypto.subtle.digest('SHA-1', encoded)
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()
}

async function checkPassword(password: string): Promise<CheckResult> {
  if (!password) return { status: 'idle' }

  try {
    const hash = await sha1HexUpper(password)
    const prefix = hash.slice(0, 5)
    const suffix = hash.slice(5)

    const resp = await fetch(`${HIBP_API}/${prefix}`, {
      headers: { 'Add-Padding': 'true' }, // padding pour ne pas leak la length
    })
    if (!resp.ok) {
      return { status: 'error', message: `HIBP API ${resp.status}` }
    }
    const text = await resp.text()
    // Format : SUFFIX:COUNT par ligne
    for (const line of text.split('\n')) {
      const [s, c] = line.trim().split(':')
      if (s === suffix) {
        const count = parseInt(c, 10)
        if (count > 0) {
          return { status: 'pwned', count }
        }
      }
    }
    return { status: 'safe' }
  } catch (err) {
    return { status: 'error', message: err instanceof Error ? err.message : 'Erreur inconnue' }
  }
}

export function PasswordChecker() {
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [result, setResult] = useState<CheckResult>({ status: 'idle' })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 1) return
    setResult({ status: 'checking' })
    const res = await checkPassword(password)
    setResult(res)
  }

  function handleClear() {
    setPassword('')
    setResult({ status: 'idle' })
  }

  return (
    <div className="ga-card p-4">
      <div className="flex items-start gap-3 mb-3">
        <div className="w-9 h-9 rounded-lg bg-info/10 border border-info/30 flex items-center justify-center shrink-0">
          <Shield size={16} className="text-info" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-ink-100">Vérifier un mot de passe</h3>
          <p className="text-xs text-ink-400 leading-relaxed">
            Compare avec <strong>Have I Been Pwned</strong> (700M+ mots de passe fuités).
            Le mot de passe reste 100% sur ton browser — seuls les 5 premiers chars du hash SHA-1 sont envoyés (k-anonymity).
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="relative">
          <input
            type={show ? 'text' : 'password'}
            value={password}
            onChange={(e) => {
              setPassword(e.target.value)
              if (result.status !== 'idle' && result.status !== 'checking') {
                setResult({ status: 'idle' })
              }
            }}
            placeholder="Tape un mot de passe à vérifier…"
            autoComplete="off"
            spellCheck={false}
            className="w-full bg-ink-800 border border-ink-700 rounded-md px-3 py-2 pr-20 text-sm focus:outline-none focus:border-accent/60"
          />
          <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-1">
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              className="p-1.5 text-ink-400 hover:text-ink-100 transition-colors rounded"
              aria-label={show ? 'Masquer' : 'Afficher'}
              tabIndex={-1}
            >
              {show ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={!password || result.status === 'checking'}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-accent text-ink-950 text-xs font-semibold hover:bg-accent-light transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {result.status === 'checking' ? (
              <>
                <Loader2 size={12} className="animate-spin" />
                Vérification…
              </>
            ) : (
              <>
                <Shield size={12} />
                Vérifier
              </>
            )}
          </button>
          {password && (
            <button
              type="button"
              onClick={handleClear}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-ink-800 border border-ink-700 hover:border-ink-600 text-xs text-ink-300 transition-colors"
            >
              Effacer
            </button>
          )}
        </div>
      </form>

      <ResultDisplay result={result} />
    </div>
  )
}

function ResultDisplay({ result }: { result: CheckResult }) {
  if (result.status === 'idle') return null
  if (result.status === 'checking') return null

  if (result.status === 'safe') {
    return (
      <div className="mt-3 p-3 rounded-md border border-data-positive/30 bg-data-positive/5 flex items-start gap-2">
        <ShieldCheck size={16} className="text-data-positive shrink-0 mt-0.5" />
        <div>
          <div className="text-sm font-semibold text-data-positive">Pas trouvé dans les fuites connues</div>
          <p className="text-xs text-ink-400 leading-relaxed mt-0.5">
            Bonne nouvelle, ce mot de passe ne figure pas dans la base de 700M+ fuites.
            Ça ne garantit pas qu&apos;il est fort — un mot de passe court et simple peut quand même être deviné.
          </p>
        </div>
      </div>
    )
  }

  if (result.status === 'pwned') {
    return (
      <div className="mt-3 p-3 rounded-md border border-data-negative/30 bg-data-negative/5 flex items-start gap-2">
        <ShieldAlert size={16} className="text-data-negative shrink-0 mt-0.5" />
        <div>
          <div className="text-sm font-semibold text-data-negative">
            Compromis · trouvé {result.count.toLocaleString('fr-CA')} fois
          </div>
          <p className="text-xs text-ink-300 leading-relaxed mt-0.5">
            Ce mot de passe figure dans des fuites publiques. <strong>Change-le partout où tu l&apos;utilises</strong>,
            et n&apos;utilise jamais le même sur plusieurs sites.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="mt-3 p-3 rounded-md border border-warn/30 bg-warn/5 flex items-start gap-2">
      <ShieldAlert size={16} className="text-warn shrink-0 mt-0.5" />
      <div className="text-xs text-ink-300">
        <strong className="text-warn">Erreur :</strong> {result.message}
      </div>
    </div>
  )
}
