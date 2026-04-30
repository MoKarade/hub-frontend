'use client'

/**
 * InstallPrompt — bannière "Installer l'app" pour PWA.
 *
 * Comportement :
 *   - Capture le `beforeinstallprompt` event dispatché par Chrome/Edge/Brave.
 *   - Affiche une bannière discrète en bas droite quand le navigateur signale que l'app est installable.
 *   - Si l'user clique "Installer", déclenche le prompt natif.
 *   - Si l'user clique "Plus tard", masqué pour 7 jours (localStorage).
 *   - Auto-cache si déjà installée (window.matchMedia('(display-mode: standalone)')).
 */

import { useEffect, useState } from 'react'
import { Download, X } from 'lucide-react'

const SNOOZE_KEY = 'hub-install-snooze-until'
const SNOOZE_DAYS = 7

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function isSnoozed(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const until = localStorage.getItem(SNOOZE_KEY)
    if (!until) return false
    return Date.now() < parseInt(until, 10)
  } catch {
    return false
  }
}

function snooze() {
  if (typeof window === 'undefined') return
  try {
    const until = Date.now() + SNOOZE_DAYS * 24 * 60 * 60 * 1000
    localStorage.setItem(SNOOZE_KEY, String(until))
  } catch {
    // ignore
  }
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // iOS Safari
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // Si déjà installée ou snoozée, on ne montre rien
    if (isStandalone() || isSnoozed()) return

    function onBeforeInstallPrompt(e: Event) {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      setVisible(true)
    }

    function onAppInstalled() {
      setVisible(false)
      setDeferredPrompt(null)
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
    window.addEventListener('appinstalled', onAppInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
      window.removeEventListener('appinstalled', onAppInstalled)
    }
  }, [])

  async function handleInstall() {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    await deferredPrompt.userChoice
    setDeferredPrompt(null)
    setVisible(false)
  }

  function handleDismiss() {
    snooze()
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div
      role="dialog"
      aria-label="Installer Hub perso"
      className="fixed bottom-4 right-4 z-50 max-w-sm bg-ink-900 border border-ink-700 rounded-lg shadow-2xl p-4 animate-slide-up"
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-accent/15 border border-accent/20 flex items-center justify-center shrink-0">
          <Download size={18} className="text-accent" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-ink-100 mb-0.5">
            Installer Hub perso
          </div>
          <p className="text-xs text-ink-400 leading-relaxed mb-3">
            Accès rapide depuis ton bureau · fonctionne hors ligne
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleInstall}
              className="text-xs px-3 py-1.5 rounded-md bg-accent text-ink-950 font-semibold hover:bg-accent-light transition-colors"
            >
              Installer
            </button>
            <button
              onClick={handleDismiss}
              className="text-xs px-3 py-1.5 rounded-md text-ink-400 hover:text-ink-100 hover:bg-ink-800 transition-colors"
            >
              Plus tard
            </button>
          </div>
        </div>
        <button
          onClick={handleDismiss}
          aria-label="Fermer"
          className="shrink-0 p-1 text-ink-500 hover:text-ink-200 transition-colors"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  )
}
