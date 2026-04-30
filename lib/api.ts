// Client typed pour appeler hub-core depuis le frontend.
// En dev : NEXT_PUBLIC_HUB_API_URL=http://localhost:8000 → direct sur :8000.
// En prod via Caddy : (vide) → /api (réécrit par Caddy).

const BASE_URL = process.env.NEXT_PUBLIC_HUB_API_URL || '/api'

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
    this.name = 'ApiError'
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${BASE_URL}${path}`
  const res = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
    credentials: 'include',
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new ApiError(res.status, `${res.status} ${res.statusText} on ${path}${text ? ' — ' + text.slice(0, 200) : ''}`)
  }
  return res.json() as Promise<T>
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
  },

  oauth: {
    /** URL absolue pour rediriger le browser (pas un fetch). */
    startUrl: (service: string) =>
      `${BASE_URL}/v1/oauth/google/start?service=${encodeURIComponent(service)}`,
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
