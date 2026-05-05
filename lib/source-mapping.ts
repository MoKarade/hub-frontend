/**
 * Mapping SQL/colonnes -> page hub correspondante.
 *
 * Quand l'IA repond avec des rows, on detecte la table source via le SQL
 * pour proposer un CTA "Voir tout dans X" + (optionnel) lien direct par row
 * si on reconnait une colonne ID.
 */

import type { LucideIcon } from 'lucide-react'
import {
  Wallet,
  MapPin,
  Mail,
  Image as ImageIcon,
  Calendar,
  FileText,
  Heart,
  Users,
  CheckSquare,
  Youtube,
  Database,
} from 'lucide-react'

export interface SourceMapping {
  id: string
  /** Label affiche dans le CTA "Voir dans X" */
  label: string
  /** Page de destination */
  href: string
  icon: LucideIcon
  /** Colonnes qui peuvent servir d'ID pour un lien direct par row (optionnel) */
  idColumns?: string[]
  /** Colonne date pour filtrer la page (optionnel) */
  dateColumn?: string
}

const MAPPINGS: Array<{
  /** Tables SQL qui matchent ce mapping */
  tables: string[]
  source: SourceMapping
}> = [
  {
    tables: ['transactions', 'credit_card_transactions', 'investment_transactions', 'investment_positions', 'accounts'],
    source: {
      id: 'finance',
      label: 'Finances',
      href: '/finances',
      icon: Wallet,
      dateColumn: 'transaction_date',
    },
  },
  {
    tables: ['location_visits', 'location_activities', 'location_points', 'location_addresses', 'named_places', 'trip_notes'],
    source: {
      id: 'locations',
      label: 'Localisation',
      href: '/locations',
      icon: MapPin,
      dateColumn: 'start_time',
    },
  },
  {
    tables: ['emails'],
    source: {
      id: 'emails',
      label: 'Emails',
      href: '/emails',
      icon: Mail,
      // Prefere `id` (UUID DB) car la page /emails utilise l'API /v1/emails/{uuid}
      idColumns: ['id', 'gmail_id', 'thread_id'],
      dateColumn: 'sent_at',
    },
  },
  {
    tables: ['photos'],
    source: {
      id: 'photos',
      label: 'Photos',
      href: '/photos',
      icon: ImageIcon,
      idColumns: ['id', 'media_id'],
      dateColumn: 'creation_time',
    },
  },
  {
    tables: ['calendar_events'],
    source: {
      id: 'calendar',
      label: 'Calendrier',
      href: '/calendar',
      icon: Calendar,
      idColumns: ['id', 'gcal_id'],
      dateColumn: 'start_at',
    },
  },
  {
    tables: ['drive_files'],
    source: {
      id: 'documents',
      label: 'Documents',
      href: '/documents',
      icon: FileText,
      idColumns: ['id', 'drive_id'],
      dateColumn: 'modified_time',
    },
  },
  {
    tables: ['health_metrics'],
    source: {
      id: 'health',
      label: 'Sante',
      href: '/health',
      icon: Heart,
      dateColumn: 'date',
    },
  },
  {
    tables: ['contacts'],
    source: {
      id: 'contacts',
      label: 'Contacts',
      href: '/contacts',
      icon: Users,
      idColumns: ['id', 'person_id'],
    },
  },
  {
    tables: ['tasks'],
    source: {
      id: 'tasks',
      label: 'Taches',
      href: '/tasks',
      icon: CheckSquare,
      idColumns: ['id', 'task_id'],
      dateColumn: 'due_at',
    },
  },
  {
    tables: ['youtube_activities'],
    source: {
      id: 'youtube',
      label: 'YouTube',
      href: '/youtube',
      icon: Youtube,
      idColumns: ['id', 'video_id'],
    },
  },
]

const FALLBACK: SourceMapping = {
  id: 'data',
  label: 'Donnees',
  href: '/',
  icon: Database,
}

/**
 * Detecte la source primaire d'un SQL en cherchant la premiere table apres FROM.
 * Si plusieurs tables joinées, on prend la premiere (c'est generalement la table principale).
 */
export function sourceForSql(sql: string | null | undefined): SourceMapping {
  if (!sql) return FALLBACK
  // Cherche tous les FROM <table> (case-insensitive)
  const matches = Array.from(
    sql.matchAll(/\bFROM\s+([a-z_][a-z0-9_]*)/gi),
  )
  for (const m of matches) {
    const tbl = m[1].toLowerCase()
    for (const map of MAPPINGS) {
      if (map.tables.includes(tbl)) return map.source
    }
  }
  return FALLBACK
}

/**
 * Tente d'extraire un lien direct depuis une row.
 * Retourne null si pas d'ID exploitable -> on link vers la page generale.
 *
 * Convention : /<page>?id=<id> ouvert par la page concernee si supporte,
 * sinon la page ignore le param (no-op gracieux).
 */
export function rowLink(
  source: SourceMapping,
  row: Record<string, unknown>,
): string | null {
  if (!source.idColumns) {
    // Pas d'ID specifique : si on a une date, filtre par date sur la page
    if (source.dateColumn) {
      const v = row[source.dateColumn]
      if (v) {
        const dateStr = String(v).slice(0, 10) // YYYY-MM-DD
        return `${source.href}?date=${dateStr}`
      }
    }
    return null
  }
  for (const col of source.idColumns) {
    const v = row[col]
    if (v != null && v !== '') {
      return `${source.href}?id=${encodeURIComponent(String(v))}`
    }
  }
  // Fallback : si on a un date, link filtre
  if (source.dateColumn) {
    const v = row[source.dateColumn]
    if (v) {
      const dateStr = String(v).slice(0, 10)
      return `${source.href}?date=${dateStr}`
    }
  }
  return null
}
