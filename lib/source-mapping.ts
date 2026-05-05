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
  Newspaper,
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
  {
    tables: ['news_articles'],
    source: {
      id: 'news',
      label: 'Actualites',
      href: '/news',
      icon: Newspaper,
      idColumns: ['id'],
      dateColumn: 'published_at',
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
 *
 * Cas special locations : si la row contient `lat` et `lng`, on les ajoute
 * pour centrer la carte directement sur la position. Marc 2026-05-05 :
 * "quand je clique sur un truc du hub ou insight qui touche la localisation
 *  je veux que ca me mette la carte a la bonne localisation directement
 *  et la bonne date aussi".
 */
export function rowLink(
  source: SourceMapping,
  row: Record<string, unknown>,
): string | null {
  // Helper : extrait des coords numeriques depuis la row si dispo
  const coords = extractCoords(row)

  if (!source.idColumns) {
    // Pas d'ID specifique : on combine date + coords si on les a
    const params = new URLSearchParams()
    if (source.dateColumn) {
      const v = row[source.dateColumn]
      if (v) params.set('date', String(v).slice(0, 10))
    }
    if (coords && source.id === 'locations') {
      params.set('lat', coords.lat.toFixed(6))
      params.set('lng', coords.lng.toFixed(6))
    }
    return params.toString() ? `${source.href}?${params.toString()}` : null
  }

  // Source avec ID : prefere id, mais on enrichit avec coords pour locations
  for (const col of source.idColumns) {
    const v = row[col]
    if (v != null && v !== '') {
      const params = new URLSearchParams()
      params.set('id', String(v))
      if (coords && source.id === 'locations') {
        params.set('lat', coords.lat.toFixed(6))
        params.set('lng', coords.lng.toFixed(6))
      }
      return `${source.href}?${params.toString()}`
    }
  }
  // Fallback : date + coords
  const params = new URLSearchParams()
  if (source.dateColumn) {
    const v = row[source.dateColumn]
    if (v) params.set('date', String(v).slice(0, 10))
  }
  if (coords && source.id === 'locations') {
    params.set('lat', coords.lat.toFixed(6))
    params.set('lng', coords.lng.toFixed(6))
  }
  return params.toString() ? `${source.href}?${params.toString()}` : null
}

/**
 * Extrait des coordonnees depuis une row si les colonnes lat/lng/latitude/longitude
 * existent ET sont des nombres valides. Les rows location_visits utilisent lat/lng,
 * les rows photos utilisent latitude/longitude. On supporte les deux + leurs variantes.
 */
function extractCoords(row: Record<string, unknown>): { lat: number; lng: number } | null {
  const latRaw =
    row.lat ?? row.latitude ?? row.start_lat ?? row.end_lat ?? null
  const lngRaw =
    row.lng ?? row.longitude ?? row.lon ?? row.start_lng ?? row.end_lng ?? null
  if (latRaw == null || lngRaw == null) return null
  const lat = typeof latRaw === 'number' ? latRaw : parseFloat(String(latRaw))
  const lng = typeof lngRaw === 'number' ? lngRaw : parseFloat(String(lngRaw))
  if (isNaN(lat) || isNaN(lng)) return null
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null
  return { lat, lng }
}
