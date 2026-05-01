/**
 * toast — helper centralisé pour les notifications Sonner.
 *
 * Wraps `sonner.toast()` avec :
 *  - Icônes lucide-react cohérentes
 *  - Durées par défaut adaptées (success short, error long)
 *  - Helpers métier: toast.apiError(), toast.commingSoon()
 */

import { toast as sonnerToast, type ExternalToast } from 'sonner'

interface ToastOptions extends ExternalToast {
  description?: string
}

export const toast = {
  success(message: string, options?: ToastOptions) {
    return sonnerToast.success(message, { duration: 3000, ...options })
  },

  error(message: string, options?: ToastOptions) {
    return sonnerToast.error(message, { duration: 6000, ...options })
  },

  info(message: string, options?: ToastOptions) {
    return sonnerToast.info(message, { duration: 4000, ...options })
  },

  warning(message: string, options?: ToastOptions) {
    return sonnerToast.warning(message, { duration: 5000, ...options })
  },

  /** Promise toast — affiche loading puis success/error selon le résultat. */
  promise<T>(
    promise: Promise<T>,
    msgs: { loading: string; success: string | ((data: T) => string); error: string | ((err: unknown) => string) }
  ) {
    return sonnerToast.promise(promise, msgs)
  },

  /** Helper pour les erreurs API. Distingue serveur down vs erreur applicative. */
  apiError(err: unknown, fallback = 'Erreur inattendue') {
    let msg = fallback
    let status = 0
    if (err instanceof Error) {
      msg = err.message
      // ApiError exposes status as numeric prefix in message ("500 Internal Server Error on ...")
      const match = msg.match(/^(\d{3})\s/)
      if (match) status = parseInt(match[1], 10)
    } else if (typeof err === 'string') {
      msg = err
    }

    // Vraiment "down" : pas de status (= no response received) OU TypeError fetch.
    // Si status >= 400 : serveur OK, juste erreur applicative.
    const isNetworkDown =
      status === 0 && (msg.toLowerCase().includes('fetch') || msg.toLowerCase().includes('failed'))

    return sonnerToast.error(msg, {
      duration: 6000,
      description: isNetworkDown
        ? 'Le hub-core ne répond pas (serveur down).'
        : status >= 500
          ? 'Erreur côté serveur — check les logs hub-core'
          : status >= 400
            ? 'Erreur de requête — paramètres invalides ou ressource introuvable'
            : undefined,
    })
  },

  /** Helper pour features pas encore livrées. */
  comingSoon(featureName: string) {
    return sonnerToast.info(`${featureName} arrive bientôt`, {
      description: 'Cette fonctionnalité est en développement.',
      duration: 3000,
    })
  },

  /** Dismiss tous les toasts (ex: au logout). */
  dismiss() {
    sonnerToast.dismiss()
  },
}
