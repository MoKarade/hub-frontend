'use client'

/**
 * Page /oauth/error - rendu quand Google redirige vers le callback avec une erreur
 * (au lieu d'un code valide).
 *
 * Cas courants :
 * - access_denied : l'user a clique "Annuler" sur l'ecran consent
 * - redirect_uri_mismatch : URI pas declaree dans Google Cloud Console
 * - invalid_client : client_id/secret faux ou manquants
 * - scope_invalid : scope mal forme
 *
 * NB : si Google bloque AVANT le redirect (ex: "Access blocked: not verified" car
 * email pas dans test users), l'user reste sur la page Google. Cette page-ci ne
 * couvre QUE le cas ou Google nous redirige avec un code d'erreur.
 */

import { Sidebar } from '@/components/sidebar'
import {
  AlertTriangle,
  ArrowLeft,
  ExternalLink,
  RefreshCw,
  CheckSquare,
  type LucideIcon,
} from 'lucide-react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { cn } from '@/lib/utils'

interface ErrorMeta {
  title: string
  desc: string
  fixSteps: { icon: LucideIcon; label: string; href?: string }[]
}

const ERROR_MAP: Record<string, ErrorMeta> = {
  access_denied: {
    title: 'Connexion annulée',
    desc: 'Tu as cliqué "Annuler" sur l\'écran de consentement Google.',
    fixSteps: [
      { icon: RefreshCw, label: 'Réessayer en cliquant Connecter', href: '/settings' },
    ],
  },
  redirect_uri_mismatch: {
    title: 'URI de redirection invalide',
    desc: 'L\'URI http://localhost:8000/v1/oauth/callback n\'est pas déclarée dans ton OAuth Client Google.',
    fixSteps: [
      {
        icon: ExternalLink,
        label: 'Ajouter dans Google Cloud Console',
        href: 'https://console.cloud.google.com/apis/credentials',
      },
      { icon: RefreshCw, label: 'Réessayer après config', href: '/settings' },
    ],
  },
  invalid_client: {
    title: 'Client OAuth invalide',
    desc: 'GOOGLE_OAUTH_CLIENT_ID ou GOOGLE_OAUTH_CLIENT_SECRET manquant/erroné dans hub-core/.env.',
    fixSteps: [
      {
        icon: ExternalLink,
        label: 'Vérifier dans Google Cloud Console',
        href: 'https://console.cloud.google.com/apis/credentials',
      },
    ],
  },
  invalid_scope: {
    title: 'Scope OAuth refusé',
    desc: 'Un scope demandé n\'est pas activé pour ton projet Google. Active les APIs nécessaires.',
    fixSteps: [
      {
        icon: ExternalLink,
        label: 'Activer les APIs',
        href: 'https://console.cloud.google.com/apis/library',
      },
    ],
  },
}

const DEFAULT_FIX_STEPS: ErrorMeta['fixSteps'] = [
  {
    icon: CheckSquare,
    label: 'Ton email est-il dans "Test users" sur la consent screen ?',
    href: 'https://console.cloud.google.com/apis/credentials/consent',
  },
  {
    icon: CheckSquare,
    label: 'L\'URI redirect http://localhost:8000/v1/oauth/callback est-elle déclarée ?',
    href: 'https://console.cloud.google.com/apis/credentials',
  },
  { icon: RefreshCw, label: 'Réessayer la connexion', href: '/settings' },
]

export default function OAuthErrorPage() {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <Suspense fallback={null}>
        <Content />
      </Suspense>
    </div>
  )
}

function Content() {
  const params = useSearchParams()
  const errorCode = params.get('error') ?? params.get('oauth_error') ?? 'unknown'
  const detail = params.get('error_description') ?? params.get('detail')
  const meta = ERROR_MAP[errorCode]

  return (
    <main className="flex-1 px-4 sm:px-6 lg:px-8 pt-16 lg:pt-6 pb-6 max-w-[800px]">
      <Link
        href="/settings"
        className="inline-flex items-center gap-1.5 text-sm text-ink-400 hover:text-ink-100 mb-4"
      >
        <ArrowLeft size={14} />
        Retour aux Réglages
      </Link>

      <div className="ga-card p-5 border-data-negative/30 bg-data-negative/5">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-data-negative/10 border border-data-negative/40 flex items-center justify-center shrink-0">
            <AlertTriangle size={18} className="text-data-negative" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold text-ink-100">
              {meta?.title ?? 'Erreur de connexion OAuth'}
            </h1>
            <code className="text-[11px] font-mono text-ink-500 break-all">{errorCode}</code>
          </div>
        </div>

        {meta && <p className="text-sm text-ink-300 mb-4">{meta.desc}</p>}

        {detail && (
          <div className="text-xs font-mono text-ink-400 bg-ink-900 border border-ink-700 rounded p-2 mb-4 break-all">
            {detail}
          </div>
        )}

        <div className="space-y-2">
          <div className="text-xs font-semibold text-ink-200 uppercase tracking-wider">
            Solutions
          </div>
          {(meta?.fixSteps ?? DEFAULT_FIX_STEPS).map((step, i) => (
            <FixStep key={i} step={step} />
          ))}
        </div>
      </div>

      {/* Diagnostic complet pour les cas non identifies */}
      {!meta && (
        <div className="ga-card p-4 mt-3">
          <div className="text-xs font-semibold text-ink-200 uppercase tracking-wider mb-2">
            Diagnostic complet
          </div>
          <ul className="text-xs text-ink-400 space-y-1.5 list-disc pl-5">
            <li>
              Email <code className="text-[11px] font-mono">marc.richard4@gmail.com</code> dans
              les <strong>Test users</strong> de la consent screen
            </li>
            <li>
              URI <code className="text-[11px] font-mono">http://localhost:8000/v1/oauth/callback</code>
              {' '}dans les <strong>Authorized redirect URIs</strong>
            </li>
            <li>
              <code className="text-[11px] font-mono">GOOGLE_OAUTH_CLIENT_ID</code> et
              <code className="text-[11px] font-mono ml-1">GOOGLE_OAUTH_CLIENT_SECRET</code>
              {' '}corrects dans hub-core <code className="text-[11px] font-mono">.env</code>
            </li>
            <li>
              APIs activées : Gmail, Photos Library, Drive, Calendar, Fitness, People, Tasks, YouTube
            </li>
          </ul>
        </div>
      )}
    </main>
  )
}

function FixStep({ step }: { step: { icon: LucideIcon; label: string; href?: string } }) {
  const Icon = step.icon
  const isExternal = step.href?.startsWith('http')
  const className = cn(
    'flex items-center gap-2 p-2 rounded-md border border-ink-700/50 hover:border-ink-700 hover:bg-ink-800/30 text-sm transition-colors',
    step.href && 'cursor-pointer'
  )
  const content = (
    <>
      <Icon size={13} className="text-accent shrink-0" />
      <span className="flex-1 text-ink-300">{step.label}</span>
      {isExternal && <ExternalLink size={11} className="text-ink-500 shrink-0" />}
    </>
  )
  if (!step.href) {
    return <div className={className}>{content}</div>
  }
  if (isExternal) {
    return (
      <a href={step.href} target="_blank" rel="noopener noreferrer" className={className}>
        {content}
      </a>
    )
  }
  return (
    <Link href={step.href} className={className}>
      {content}
    </Link>
  )
}
