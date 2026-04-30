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

  /** Helper pour les erreurs API. Affiche le status + message. */
  apiError(err: unknown, fallback = 'Erreur inattendue') {
    let msg = fallback
    if (err instanceof Error) {
      msg = err.message
    } else if (typeof err === 'string') {
      msg = err
    }
    return sonnerToast.error(msg, {
      duration: 6000,
      description: msg.includes('fetch') || msg.includes('Failed')
        ? 'Le hub-core ne répond pas. Vérifie qu il est bien lancé.'
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
