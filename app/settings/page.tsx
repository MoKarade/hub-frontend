'use client'

/**
 * Page Réglages — gestion des connexions OAuth (Google services) + future config.
 *
 * Sections :
 *  - Connexions Google : bouton Connect/Revoke par service (Gmail, Photos, etc.)
 *  - (futur) Préférences UI, modèles Ollama, sources data, notifications
 */

import { Sidebar } from '@/components/sidebar'
import { HubStatus } from '@/components/hub-status'
import { PasswordChecker } from '@/components/password-checker'
import { BulkPasswordChecker } from '@/components/bulk-password-checker'
import {
  Mail,
  Image as ImageIcon,
  Calendar,
  FileText,
  Heart,
  Users,
  CheckSquare,
  Youtube,
  CheckCircle2,
  XCircle,
  Link2,
  Unlink,
  AlertTriangle,
  Settings as SettingsIcon,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import useSWR from 'swr'
import { api, ApiError, type OAuthStatusItem } from '@/lib/api'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'

interface ServiceMeta {
  id: string
  name: string
  icon: LucideIcon
  description: string
}

const GOOGLE_SERVICES: ServiceMeta[] = [
  { id: 'all', name: 'Tous les services Google', icon: SettingsIcon, description: 'Consent unique pour Gmail + Photos + Drive + Calendar + Fit + People + Tasks + YouTube' },
  { id: 'gmail', name: 'Gmail', icon: Mail, description: 'Lecture des emails (read-only)' },
  { id: 'photos', name: 'Google Photos', icon: ImageIcon, description: 'Lecture de la bibliothèque photos' },
  { id: 'drive', name: 'Google Drive', icon: FileText, description: 'Lecture des fichiers Drive' },
  { id: 'calendar', name: 'Google Calendar', icon: Calendar, description: 'Lecture des événements' },
  { id: 'fitness', name: 'Google Fit', icon: Heart, description: 'Sommeil, activité, fréquence cardiaque' },
  { id: 'people', name: 'Contacts (People)', icon: Users, description: 'Lecture du carnet d\'adresses' },
  { id: 'tasks', name: 'Google Tasks', icon: CheckSquare, description: 'Lecture des tâches' },
  { id: 'youtube', name: 'YouTube', icon: Youtube, description: 'Historique de visionnage' },
]

export default function SettingsPage() {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 px-4 sm:px-6 lg:px-8 pt-16 lg:pt-6 pb-6 max-w-[1400px] flex flex-col">
        <header className="mb-4">
          <h1 className="text-2xl font-semibold tracking-tight">Réglages</h1>
          <p className="text-sm text-ink-400">
            Connexions externes · préférences · modèles IA
          </p>
        </header>

        <Suspense fallback={<div className="text-sm text-ink-400">Chargement…</div>}>
          <SettingsContent />
        </Suspense>

        <div className="mt-auto pt-4">
          <HubStatus />
        </div>
      </main>
    </div>
  )
}

function SettingsContent() {
  const searchParams = useSearchParams()
  const oauthSuccess = searchParams.get('oauth_success')
  const oauthError = searchParams.get('oauth_error')

  // Toast feedback après redirection OAuth callback
  useEffect(() => {
    if (oauthSuccess) {
      toast.success(`Connexion Google ${oauthSuccess === 'all' ? 'tous services' : oauthSuccess} réussie`, {
        description: 'Le token est sauvegardé chiffré en DB.',
      })
    }
    if (oauthError) {
      toast.error('Connexion Google échouée', { description: oauthError })
    }
  }, [oauthSuccess, oauthError])

  return (
    <div className="space-y-6">
      <GoogleConnectionsSection />
      <SecuritySection />
      <PreferencesSection />
    </div>
  )
}

function SecuritySection() {
  return (
    <section>
      <header className="mb-3 flex items-center gap-2">
        <ShieldCheck size={18} className="text-accent" />
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Sécurité des mots de passe</h2>
          <p className="text-sm text-ink-400">
            Vérification contre Have I Been Pwned · 700M+ fuites · 100% local + gratuit
          </p>
        </div>
      </header>
      <div className="space-y-4">
        <BulkPasswordChecker />
        <details className="ga-card p-3 group">
          <summary className="cursor-pointer text-sm text-ink-300 hover:text-ink-100 transition-colors flex items-center gap-2">
            <span className="text-accent">+</span>
            Vérifier un mot de passe individuel (sans CSV)
          </summary>
          <div className="mt-3">
            <PasswordChecker />
          </div>
        </details>
      </div>
    </section>
  )
}

function GoogleConnectionsSection() {
  const { data, error, mutate } = useSWR(
    '/v1/oauth/status',
    () => api.oauth.status().catch(() => null),
    { refreshInterval: 0 }
  )

  const tokens = data?.tokens ?? []
  const tokensByService = new Map(tokens.map((t) => [t.service, t]))

  function handleConnect(service: string) {
    // Redirige le browser vers le start endpoint qui redirige Google
    window.location.href = api.oauth.startUrl(service)
  }

  async function handleRevoke(service: string) {
    try {
      await api.oauth.revoke(service)
      toast.success(`Connexion ${service} révoquée`)
      void mutate()
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : String(err)
      toast.apiError(msg, 'Révocation échouée')
    }
  }

  return (
    <section>
      <header className="mb-3">
        <h2 className="text-lg font-semibold tracking-tight">Connexions Google</h2>
        <p className="text-sm text-ink-400">
          Autoriser le hub à lire (read-only) tes services Google. Tokens chiffrés en DB.
        </p>
      </header>

      {error && (
        <div className="ga-card p-4 mb-3 border-warn/30 bg-warn/5 flex items-start gap-3">
          <AlertTriangle size={16} className="text-warn shrink-0 mt-0.5" />
          <div className="text-xs text-ink-300">
            Hub-core ne répond pas. Lance <code className="text-xs bg-ink-800 px-1.5 py-0.5 rounded">docker compose up</code>.
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {GOOGLE_SERVICES.map((svc) => {
          const token = tokensByService.get(svc.id)
          return (
            <ServiceCard
              key={svc.id}
              service={svc}
              token={token}
              onConnect={() => handleConnect(svc.id)}
              onRevoke={() => handleRevoke(svc.id)}
            />
          )
        })}
      </div>
    </section>
  )
}

function ServiceCard({
  service,
  token,
  onConnect,
  onRevoke,
}: {
  service: ServiceMeta
  token: OAuthStatusItem | undefined
  onConnect: () => void
  onRevoke: () => void
}) {
  const Icon = service.icon
  const isConnected = token?.connected === true
  const isExpired = token?.expired === true
  const isRevoked = token?.revoked === true

  return (
    <div className={cn(
      'ga-card ga-card-hover p-4 transition-colors',
      isConnected && 'border-data-positive/20',
    )}>
      <div className="flex items-start gap-3">
        <div className={cn(
          'w-10 h-10 rounded-lg border flex items-center justify-center shrink-0',
          isConnected ? 'bg-data-positive/10 border-data-positive/30 text-data-positive' : 'bg-ink-800 border-ink-700 text-ink-400'
        )}>
          <Icon size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h3 className="text-sm font-semibold text-ink-100 truncate">{service.name}</h3>
            <StatusBadge connected={isConnected} expired={isExpired} revoked={isRevoked} />
          </div>
          <p className="text-xs text-ink-400 leading-relaxed mb-3">{service.description}</p>

          {token && (
            <div className="text-[10px] text-ink-500 font-mono mb-3 space-y-0.5">
              <div className="truncate">📧 {token.user_email}</div>
              <div>🔑 {token.scopes.length} scope{token.scopes.length > 1 ? 's' : ''} accordé{token.scopes.length > 1 ? 's' : ''}</div>
              <div>⏱ Expire : {new Date(token.expires_at).toLocaleString('fr-CA')}</div>
            </div>
          )}

          <div className="flex gap-2 flex-wrap">
            {!isConnected ? (
              <button
                type="button"
                onClick={onConnect}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-accent text-ink-950 text-xs font-semibold hover:bg-accent-light transition-colors"
              >
                <Link2 size={12} />
                Connecter
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={onConnect}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-ink-800 border border-ink-700 hover:border-ink-600 text-xs text-ink-300 transition-colors"
                  title="Re-consent (refresh tokens)"
                >
                  <Link2 size={12} />
                  Re-connecter
                </button>
                <button
                  type="button"
                  onClick={onRevoke}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-ink-800 border border-ink-700 hover:border-data-negative/40 hover:text-data-negative text-xs text-ink-400 transition-colors"
                >
                  <Unlink size={12} />
                  Révoquer
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function StatusBadge({ connected, expired, revoked }: { connected: boolean; expired: boolean; revoked: boolean }) {
  if (revoked) {
    return (
      <span className="text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-data-negative/10 text-data-negative border border-data-negative/30 inline-flex items-center gap-1">
        <XCircle size={10} /> Révoqué
      </span>
    )
  }
  if (connected) {
    return (
      <span className="text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-data-positive/10 text-data-positive border border-data-positive/30 inline-flex items-center gap-1">
        <CheckCircle2 size={10} /> Connecté
      </span>
    )
  }
  if (expired) {
    return (
      <span className="text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-warn/10 text-warn border border-warn/30 inline-flex items-center gap-1">
        Expiré
      </span>
    )
  }
  return (
    <span className="text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-ink-800 text-ink-500 border border-ink-700">
      Non connecté
    </span>
  )
}

function PreferencesSection() {
  return (
    <section>
      <header className="mb-3">
        <h2 className="text-lg font-semibold tracking-tight">Préférences</h2>
        <p className="text-sm text-ink-400">Personnalisation (à venir)</p>
      </header>
      <div className="ga-card p-4 text-sm text-ink-400">
        <p>Les préférences (modèle IA, langue, fuseau, notifications) seront disponibles dans une prochaine version.</p>
        <p className="mt-2 text-xs text-ink-500">
          Pour l&apos;instant : modifier directement <code className="text-xs bg-ink-800 px-1.5 py-0.5 rounded">.env.local</code> (frontend) ou <code className="text-xs bg-ink-800 px-1.5 py-0.5 rounded">hub-deploy/.env</code> (backend).
        </p>
      </div>
    </section>
  )
}
