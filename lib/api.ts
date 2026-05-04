// Client typed pour appeler hub-core depuis le frontend.
//
// Strategie RUNTIME PURE : on detecte l'hostname dans window.location.
// Aucune dependance a un env var de build (qui foire pour des raisons obscures).
//
// - localhost:3000 -> http://localhost:8000 (hub-core direct)
// - autre hostname (deploiement futur) -> /api (Caddy proxy)

export function getBaseUrl(): string {
  // Cote serveur (SSR/build) : fallback dev local hardcode.
  if (typeof window === 'undefined') return 'http://localhost:8000'
  // Cote client : detection runtime depuis window.location uniquement.
  // Pas de process.env (le minifier le tree-shake n'importe comment).
  const { protocol, hostname, host } = window.location
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'http://localhost:8000'
  }
  return `${protocol}//${host}/api`
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
    this.name = 'ApiError'
  }
}

// Timeout par defaut : certains endpoints (sync, picker import, enrich-gps,
// AI ask) peuvent prendre 1-3 minutes. On utilise 5 min pour couvrir tout
// sans laisser pendre indefiniment si hub-core est down.
const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${getBaseUrl()}${path}`
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        // Header custom = simple-CSRF defense : toute requête CSRF cross-origin
        // déclencherait un preflight OPTIONS, que le backend peut bloquer si
        // l'origine n'est pas dans CORS_ALLOWED_ORIGINS.
        'X-Hub-Client': 'web',
        ...(init?.headers || {}),
      },
      credentials: 'include',
      signal: init?.signal ?? controller.signal,
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      // Messages user-friendly pour les statuts courants
      if (res.status === 401) {
        throw new ApiError(401, 'Session expirée — reconnecte-toi via /settings')
      }
      if (res.status === 403) {
        throw new ApiError(403, 'Accès refusé')
      }
      if (res.status === 429) {
        throw new ApiError(429, 'Trop de requêtes — réessaie dans quelques secondes')
      }
      throw new ApiError(
        res.status,
        `${res.status} ${res.statusText} on ${path}${text ? ' — ' + text.slice(0, 200) : ''}`
      )
    }
    return (await res.json()) as T
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new ApiError(0, `Timeout (${DEFAULT_TIMEOUT_MS / 1000}s) sur ${path}`)
    }
    throw err
  } finally {
    clearTimeout(timeoutId)
  }
}

function qs(params: Record<string, unknown>): string {
  const cleaned: Record<string, string> = {}
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') {
      cleaned[k] = String(v)
    }
  }
  const s = new URLSearchParams(cleaned).toString()
  return s ? `?${s}` : ''
}

// ============================================================================
// Types DB (miroir des modèles SQLAlchemy / Pydantic *Read)
// ============================================================================

export type Account = {
  id: string
  institution: string
  account_type: 'checking' | 'savings' | 'credit_card' | 'investment' | string
  account_number_masked: string
  nickname: string | null
  currency: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export type Transaction = {
  id: string
  account_id: string
  transaction_date: string
  description: string
  debit: string | null
  credit: string | null
  balance_after: string | null
  source_format: string
  source_file: string | null
  source_seq_num: number | null
  dedup_hash: string
  created_at: string
}

export type CreditCardTransaction = {
  id: string
  account_id: string
  card_number_masked: string
  transaction_date: string
  posting_date: string
  description: string
  amount: string
  cashback_rate: string | null
  section: 'transactions_courantes' | 'operations_au_compte' | string
  source_format: string
  source_file: string | null
  statement_date: string | null
  dedup_hash: string
  created_at: string
}

export type InvestmentTransaction = {
  id: string
  account_id: string
  sub_account_code: string | null
  transaction_date: string
  settlement_date: string | null
  operation: string
  description: string
  symbol: string | null
  quantity: string | null
  unit_price: string | null
  amount: string | null
  currency: string | null
  statement_date: string
  source_format: string
  source_file: string | null
  dedup_hash: string
  created_at: string
}

export type InvestmentPosition = {
  id: string
  account_id: string
  sub_account_code: string
  statement_date: string
  description: string
  symbol: string | null
  quantity: string
  average_unit_cost: string | null
  book_cost: string | null
  market_price: string
  market_value: string
  currency: string
  portfolio_pct: string | null
  source_format: string
  source_file: string | null
  dedup_hash: string
  created_at: string
}

export type LocationPoint = {
  id: string
  timestamp_utc: string
  latitude: string
  longitude: string
  accuracy_m: number | null
  altitude_m: number | null
  activity_type: string | null
  source: string
  source_file: string | null
  dedup_hash: string
  created_at: string
}

export type LocationVisit = {
  id: string
  start_time: string
  end_time: string
  lat: string
  lng: string
  semantic_type: string | null
  place_id: string | null
  probability: number | null
  tz_offset_minutes: number | null
  source: string
  created_at: string
}

export type LocationStats = {
  total_visits: number
  unique_places: number
  home_visits: number
  work_visits: number
  earliest_date: string | null
  latest_date: string | null
  total_path_points: number
  total_activities: number
}

export type LocationIngestResponse = {
  visits_inserted: number
  visits_skipped: number
  points_inserted: number
  points_skipped: number
  activities_inserted: number
  activities_skipped: number
  segments_total: number
  duration_seconds: number
  format_detected: string
}

export type LocationVisitFilters = {
  start_date?: string
  end_date?: string
  semantic_type?: string
  min_lat?: number
  max_lat?: number
  min_lng?: number
  max_lng?: number
  limit?: number
  offset?: number
}

export type ReadyResponse = {
  status: 'ok' | 'degraded'
  checks: Record<string, { status: string; [key: string]: unknown }>
}

export type AskResponse = {
  answer: string
  sql: string
  rows: Record<string, unknown>[]
  row_count: number
}

export type PingResponse = {
  status: string
  model: string
  backend: string
  sample_response: string | null
}

export type OsintHit = {
  service: string
  url: string | null
  status: 'found' | 'not_found' | 'rate_limited' | 'error'
  extra?: Record<string, string>
}

export type OsintScanResponse = {
  tool: 'holehe' | 'sherlock'
  target: string
  duration_seconds: number
  total_checked: number
  found_count: number
  hits: OsintHit[]
}

export type EmailListItem = {
  id: string
  gmail_id: string
  thread_id: string
  subject: string | null
  sender: string
  sender_email: string
  sent_at: string
  snippet: string | null
  labels: string[]
  has_attachments: boolean
  is_unread: boolean
  size_estimate: number | null
}

export type EmailDetail = EmailListItem & {
  recipients: string[]
  body_text: string | null
  body_html: string | null
}

export type EmailSyncResponse = {
  ingested: number
  updated: number
  errors: number
  duration_seconds: number
}

export type EmailStatsResponse = {
  total: number
  unread: number
  with_attachments: number
  top_senders: { sender_email: string; count: number; last_seen: string | null }[]
  by_month: { month: string; count: number }[]
}

export type EmailFilters = {
  sender_email?: string
  since?: string
  until?: string
  q?: string
  label?: string
  is_unread?: boolean
  limit?: number
  offset?: number
}

// Calendar
export type CalEventItem = {
  id: string
  gcal_id: string
  calendar_id: string
  summary: string | null
  location: string | null
  start_at: string
  end_at: string
  all_day: boolean
  organizer_email: string | null
  attendees: string[]
  status: string | null
  html_link: string | null
}

export type CalSyncResponse = {
  calendars_synced: number
  events_ingested: number
  events_updated: number
  errors: number
  duration_seconds: number
}

export type CalStatsResponse = {
  total: number
  upcoming: number
  past_30d: number
  by_calendar: { calendar_id: string; count: number }[]
}

export type CalEventFilters = {
  since?: string
  until?: string
  q?: string
  limit?: number
  offset?: number
}

// Health data
export type HealthMetricItem = {
  id: string
  date: string
  metric: string
  value: number
  source: string
}

export type HealthSyncResponse = {
  metrics_ingested: number
  metrics_updated: number
  errors: number
  duration_seconds: number
}

export type HealthSummaryResponse = {
  total_datapoints: number
  by_metric: {
    metric: string
    count: number
    last_date: string | null
    last_value: number | null
    avg_90d: number | null
    max_90d: number | null
    min_90d: number | null
    avg_7d: number | null
    avg_prev_7d: number | null
    avg_30d: number | null
  }[]
}

export type HealthMetricFilters = {
  metric?: string
  since?: string
  until?: string
  limit?: number
}

// Photos
export type PhotoItem = {
  id: string
  media_id: string
  filename: string | null
  mime_type: string | null
  creation_time: string
  width: number | null
  height: number | null
  is_video: boolean
  base_url: string | null
  product_url: string | null
  latitude?: number | null
  longitude?: number | null
  location_name?: string | null
  camera_make?: string | null
  camera_model?: string | null
}

export type PhotosSyncResponse = {
  ingested: number
  updated: number
  errors: number
  duration_seconds: number
}

export type PhotosStatsResponse = {
  total: number
  photos: number
  videos: number
  total_pixels: number
  by_year: { year: string; count: number }[]
  by_camera: { camera: string; count: number }[]
}

export type PhotoFilters = {
  since?: string
  until?: string
  is_video?: boolean
  limit?: number
  offset?: number
}

// Drive
export type DriveFileItem = {
  id: string
  drive_id: string
  name: string | null
  mime_type: string
  size_bytes: number | null
  starred: boolean
  is_shared: boolean
  owner_email: string | null
  modified_time: string | null
  web_view_link: string | null
  parents?: string | null
}

export type DriveSyncResponse = {
  ingested: number
  updated: number
  errors: number
  duration_seconds: number
}

export type DriveStatsResponse = {
  total: number
  starred: number
  shared: number
  total_size_bytes: number
  by_mime: { mime_type: string; count: number }[]
}

export type DriveFilters = {
  mime_type?: string
  q?: string
  starred?: boolean
  parent_id?: string
  limit?: number
  offset?: number
}

// Contacts (People API)
export type ContactItem = {
  id: string
  person_id: string
  display_name: string | null
  given_name: string | null
  family_name: string | null
  emails: string[]
  phones: string[]
  organizations: string[]
  birthday: string | null
  photo_url: string | null
}

export type ContactsSyncResponse = {
  ingested: number
  updated: number
  errors: number
  duration_seconds: number
}

export type ContactsStatsResponse = {
  total: number
  with_email: number
  with_phone: number
  with_organization: number
}

// Tasks (Google Tasks)
export type TaskItem = {
  id: string
  task_id: string
  tasklist_id: string
  tasklist_title: string | null
  title: string | null
  notes: string | null
  is_completed: boolean
  due_at: string | null
  completed_at: string | null
}

export type TasksSyncResponse = {
  tasklists_synced: number
  tasks_ingested: number
  tasks_updated: number
  errors: number
  duration_seconds: number
}

export type TasksStatsResponse = {
  total: number
  pending: number
  completed: number
  overdue: number
  by_tasklist: { tasklist: string; count: number }[]
}

// YouTube
export type YTActivityItem = {
  id: string
  activity_id: string
  activity_type: string
  video_id: string | null
  video_title: string | null
  channel_title: string | null
  thumbnail_url: string | null
  published_at: string
}

export type YTSyncResponse = {
  activities_ingested: number
  activities_updated: number
  errors: number
  duration_seconds: number
}

export type YTStatsResponse = {
  total: number
  by_type: { type: string; count: number }[]
  top_channels: { channel: string; count: number }[]
}

// ============================================================================
// Filters typés (alignés sur les query params de l'API)
// ============================================================================

export type TransactionFilters = {
  account_id?: string
  start_date?: string
  end_date?: string
  limit?: number
  offset?: number
}

export type CreditCardFilters = TransactionFilters & {
  card_number_masked?: string
  section?: string
  statement_date?: string
}

export type InvestmentTransactionFilters = {
  account_id?: string
  sub_account_code?: string
  symbol?: string
  operation?: string
  statement_date?: string
  limit?: number
  offset?: number
}

export type InvestmentPositionFilters = {
  account_id?: string
  sub_account_code?: string
  symbol?: string
  statement_date?: string
  limit?: number
  offset?: number
}

export type LocationFilters = {
  start?: string
  end?: string
  start_date?: string
  end_date?: string
  min_lat?: number
  max_lat?: number
  min_lng?: number
  max_lng?: number
  activity_type?: string
  source?: string
  limit?: number
  offset?: number
}

// ============================================================================
// API client
// ============================================================================

export const api = {
  health: () => request<{ status: string }>('/v1/health'),
  ready: () => request<ReadyResponse>('/v1/ready'),

  ai: {
    ping: () => request<PingResponse>('/v1/ai/ping'),
    ask: (question: string) =>
      request<AskResponse>('/v1/ai/ask', {
        method: 'POST',
        body: JSON.stringify({ question }),
      }),
    chat: (
      message: string,
      history: { role: 'user' | 'assistant'; content: string }[] = []
    ) =>
      request<{ answer: string; model: string }>('/v1/ai/chat', {
        method: 'POST',
        body: JSON.stringify({ message, history }),
      }),
  },

  photos: {
    sync: (opts: { max_results?: number; user_email?: string } = {}) =>
      request<PhotosSyncResponse>('/v1/photos/sync', {
        method: 'POST',
        body: JSON.stringify({
          user_email: opts.user_email ?? 'marc.richard4@gmail.com',
          max_results: opts.max_results ?? 2000,
        }),
      }),
    list: (filters: PhotoFilters = {}) =>
      request<PhotoItem[]>('/v1/photos' + qs(filters)),
    stats: () => request<PhotosStatsResponse>('/v1/photos/stats'),
    // Picker API (2025+) : nouveau workflow user-pick pour les apps non verifiees
    pickerStart: () =>
      request<{ session_id: string; picker_uri: string; expire_time: string | null }>(
        '/v1/photos/picker/start',
        { method: 'POST' }
      ),
    pickerStatus: (sessionId: string) =>
      request<{
        session_id: string
        media_items_set: boolean
        picker_uri: string | null
        expire_time: string | null
      }>(`/v1/photos/picker/status/${sessionId}`),
    pickerImport: (sessionId: string) =>
      request<{
        session_id: string
        ingested: number
        updated: number
        errors: number
        duration_seconds: number
      }>(`/v1/photos/picker/import/${sessionId}`, { method: 'POST' }),
    enrichGps: (opts: { max_photos?: number; do_geocode?: boolean } = {}) =>
      request<{
        processed: number
        with_gps: number
        geocoded: number
        errors: number
        duration_seconds: number
      }>('/v1/photos/enrich-gps', {
        method: 'POST',
        body: JSON.stringify({
          user_email: 'marc.richard4@gmail.com',
          max_photos: opts.max_photos ?? 100,
          do_geocode: opts.do_geocode ?? true,
        }),
      }),
  },

  drive: {
    sync: (opts: { max_results?: number; user_email?: string } = {}) =>
      request<DriveSyncResponse>('/v1/drive/sync', {
        method: 'POST',
        body: JSON.stringify({
          user_email: opts.user_email ?? 'marc.richard4@gmail.com',
          max_results: opts.max_results ?? 2000,
        }),
      }),
    files: (filters: DriveFilters = {}) =>
      request<DriveFileItem[]>('/v1/drive/files' + qs(filters)),
    file: (driveId: string) => request<DriveFileItem>(`/v1/drive/file/${driveId}`),
    stats: () => request<DriveStatsResponse>('/v1/drive/stats'),
    wipe: () =>
      request<{ deleted: number }>('/v1/drive/wipe?user_email=marc.richard4@gmail.com', {
        method: 'DELETE',
      }),
  },

  calendar: {
    sync: (opts: { days_back?: number; days_forward?: number; user_email?: string } = {}) =>
      request<CalSyncResponse>('/v1/calendar/sync', {
        method: 'POST',
        body: JSON.stringify({
          user_email: opts.user_email ?? 'marc.richard4@gmail.com',
          days_back: opts.days_back ?? 365,
          days_forward: opts.days_forward ?? 180,
        }),
      }),
    events: (filters: CalEventFilters = {}) =>
      request<CalEventItem[]>('/v1/calendar/events' + qs(filters)),
    stats: () => request<CalStatsResponse>('/v1/calendar/stats'),
  },

  healthData: {
    sync: (opts: { days_back?: number; user_email?: string } = {}) =>
      request<HealthSyncResponse>('/v1/health-data/sync', {
        method: 'POST',
        body: JSON.stringify({
          user_email: opts.user_email ?? 'marc.richard4@gmail.com',
          days_back: opts.days_back ?? 90,
        }),
      }),
    metrics: (filters: HealthMetricFilters = {}) =>
      request<HealthMetricItem[]>('/v1/health-data/metrics' + qs(filters)),
    summary: () => request<HealthSummaryResponse>('/v1/health-data/summary'),
    timeseries: (metric: string, days = 90) =>
      request<{ date: string; value: number }[]>(
        `/v1/health-data/timeseries?metric=${encodeURIComponent(metric)}&days=${days}`
      ),
  },

  contacts: {
    sync: () =>
      request<ContactsSyncResponse>('/v1/contacts/sync', {
        method: 'POST',
        body: JSON.stringify({ user_email: 'marc.richard4@gmail.com' }),
      }),
    list: (filters: { q?: string; sort?: 'name' | 'recent' | 'family'; limit?: number } = {}) =>
      request<ContactItem[]>('/v1/contacts' + qs(filters)),
    stats: () => request<ContactsStatsResponse>('/v1/contacts/stats'),
  },

  tasks: {
    sync: () =>
      request<TasksSyncResponse>('/v1/tasks/sync', {
        method: 'POST',
        body: JSON.stringify({ user_email: 'marc.richard4@gmail.com' }),
      }),
    list: (filters: { completed?: boolean; tasklist_id?: string; limit?: number } = {}) =>
      request<TaskItem[]>('/v1/tasks' + qs(filters)),
    lists: () =>
      request<{ id: string; title: string | null; count: number }[]>('/v1/tasks/lists'),
    stats: () => request<TasksStatsResponse>('/v1/tasks/stats'),
    toggle: (taskId: string, completed: boolean) =>
      request<TaskItem>(`/v1/tasks/${taskId}/toggle`, {
        method: 'POST',
        body: JSON.stringify({ user_email: 'marc.richard4@gmail.com', completed }),
      }),
    create: (data: { tasklist_id: string; title: string; notes?: string; due_at?: string }) =>
      request<TaskItem>('/v1/tasks/create', {
        method: 'POST',
        body: JSON.stringify({ user_email: 'marc.richard4@gmail.com', ...data }),
      }),
    update: (
      taskId: string,
      data: { title?: string; notes?: string; due_at?: string; clear_due?: boolean }
    ) =>
      request<TaskItem>(`/v1/tasks/${taskId}/update`, {
        method: 'PATCH',
        body: JSON.stringify({ user_email: 'marc.richard4@gmail.com', ...data }),
      }),
    remove: (taskId: string) =>
      request<{ deleted: string }>(`/v1/tasks/${taskId}?user_email=marc.richard4@gmail.com`, {
        method: 'DELETE',
      }),
  },

  youtube: {
    sync: (opts: { days_back?: number } = {}) =>
      request<YTSyncResponse>('/v1/youtube/sync', {
        method: 'POST',
        body: JSON.stringify({
          user_email: 'marc.richard4@gmail.com',
          days_back: opts.days_back ?? 90,
        }),
      }),
    activities: (filters: { activity_type?: string; limit?: number } = {}) =>
      request<YTActivityItem[]>('/v1/youtube/activities' + qs(filters)),
    stats: () => request<YTStatsResponse>('/v1/youtube/stats'),
  },

  emails: {
    sync: (opts: { max_results?: number; since_days?: number; user_email?: string } = {}) =>
      request<EmailSyncResponse>('/v1/emails/sync', {
        method: 'POST',
        body: JSON.stringify({
          user_email: opts.user_email ?? 'marc.richard4@gmail.com',
          max_results: opts.max_results ?? 200,
          since_days: opts.since_days ?? 30,
        }),
      }),
    list: (filters: EmailFilters = {}) =>
      request<EmailListItem[]>('/v1/emails' + qs(filters)),
    get: (id: string) => request<EmailDetail>(`/v1/emails/${id}`),
    stats: () => request<EmailStatsResponse>('/v1/emails/stats'),
  },

  osint: {
    status: () =>
      request<{
        holehe_installed: boolean
        sherlock_installed: boolean
        install_instructions: Record<string, string>
      }>('/v1/osint/status'),
    holehe: (email: string) =>
      request<OsintScanResponse>('/v1/osint/holehe', {
        method: 'POST',
        body: JSON.stringify({ email }),
      }),
    sherlock: (username: string) =>
      request<OsintScanResponse>('/v1/osint/sherlock', {
        method: 'POST',
        body: JSON.stringify({ username }),
      }),
  },

  finance: {
    accounts: {
      list: (filters: { is_active?: boolean } = {}) =>
        request<Account[]>('/v1/finance/accounts' + qs(filters)),
      get: (id: string) => request<Account>(`/v1/finance/accounts/${id}`),
    },
    transactions: {
      list: (filters: TransactionFilters = {}) =>
        request<Transaction[]>('/v1/finance/transactions' + qs(filters)),
    },
    creditCard: {
      list: (filters: CreditCardFilters = {}) =>
        request<CreditCardTransaction[]>(
          '/v1/finance/credit-card-transactions' + qs(filters)
        ),
    },
    investmentTransactions: {
      list: (filters: InvestmentTransactionFilters = {}) =>
        request<InvestmentTransaction[]>(
          '/v1/finance/investment-transactions' + qs(filters)
        ),
    },
    investmentPositions: {
      list: (filters: InvestmentPositionFilters = {}) =>
        request<InvestmentPosition[]>(
          '/v1/finance/investment-positions' + qs(filters)
        ),
    },
  },

  locations: {
    points: {
      list: (filters: LocationFilters = {}) =>
        request<LocationPoint[]>('/v1/locations/points' + qs(filters)),
      get: (id: string) => request<LocationPoint>(`/v1/locations/points/${id}`),
    },
    visits: {
      list: (filters: LocationVisitFilters = {}) =>
        request<LocationVisit[]>('/v1/locations/visits' + qs(filters)),
    },
    stats: () => request<LocationStats>('/v1/locations/stats'),
    ingestFile: (filePath: string) =>
      request<LocationIngestResponse>('/v1/locations/ingest-file', {
        method: 'POST',
        body: JSON.stringify({ file_path: filePath }),
      }),
  },

  security: {
    /**
     * Proxy HIBP Pwned Passwords k-anonymity.
     * Backend retourne {ranges: "SUFFIX:COUNT\nSUFFIX:COUNT\n..."} (format text HIBP).
     * Ne jamais appeler api.pwnedpasswords.com directement (CSP + perf + révèle l'IP).
     */
    hibpPasswords: (prefix: string) =>
      request<{ ranges: string }>(`/v1/security/hibp/passwords/${encodeURIComponent(prefix)}`),
    /** Proxy HIBP /breaches (full list ou filtré par domaine). */
    hibpBreaches: (domain?: string) =>
      request<HibpBreach[]>('/v1/security/hibp/breaches' + qs({ domain })),
  },

  garmin: {
    status: () => request<GarminStatusResponse>('/v1/garmin/status'),
    sync: (opts: { days_back?: number } = {}) =>
      request<GarminSyncResponse>('/v1/garmin/sync', {
        method: 'POST',
        body: JSON.stringify({ days_back: opts.days_back ?? 90 }),
      }),
    connect: (payload: { email: string; password?: string; mfa_code?: string; session_id?: string }) =>
      request<{ status: string; message: string; session_id?: string }>('/v1/garmin/connect', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
  },

  oauth: {
    /** URL absolue pour rediriger le browser (pas un fetch). */
    startUrl: (service: string) =>
      `${getBaseUrl()}/v1/oauth/google/start?service=${encodeURIComponent(service)}`,
    /** Liste les tokens OAuth en DB (jamais les valeurs en clair). */
    status: () => request<OAuthStatusResponse>('/v1/oauth/status'),
    /** Révoque le token d'un service. */
    revoke: (service: string) =>
      request<{ status: string; service: string }>(
        `/v1/oauth/google/${encodeURIComponent(service)}/revoke`,
        { method: 'POST' }
      ),
  },
}

// Garmin Connect
export type GarminStatusResponse = {
  connected: boolean
  last_sync_date: string | null
  total_datapoints: number
  metrics_available: string[]
}

export type GarminSyncResponse = {
  metrics_ingested: number
  metrics_updated: number
  days_processed: number
  duration_seconds: number
}

export type HibpBreach = {
  Name: string
  Title: string
  Domain: string
  BreachDate: string
  PwnCount: number
  Description: string
  DataClasses: string[]
  IsVerified: boolean
  IsSensitive: boolean
  IsRetired: boolean
  IsSpamList: boolean
  LogoPath: string
}

export type OAuthStatusItem = {
  provider: string
  service: string
  user_email: string
  connected: boolean
  expired: boolean
  revoked: boolean
  scopes: string[]
  expires_at: string
  last_refreshed_at: string | null
}

export type OAuthStatusResponse = {
  tokens: OAuthStatusItem[]
  available_services: string[]
}
