// Client minimal pour appeler hub-core depuis le frontend.
// En dev : direct sur :8000. En prod via Caddy : sur /api.

const BASE_URL = process.env.NEXT_PUBLIC_HUB_API_URL || '/api'

class ApiError extends Error {
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
    throw new ApiError(res.status, `${res.status} ${res.statusText} on ${path}`)
  }
  return res.json() as Promise<T>
}

export const api = {
  // Health
  health: () => request<{ status: string }>('/v1/health'),
  ready: () =>
    request<{
      status: string
      checks: Record<string, { status: string; [key: string]: unknown }>
    }>('/v1/ready'),

  // Future endpoints (placeholders typés pour autocomplete)
  // ai: {
  //   ask: (question: string) =>
  //     request('/v1/ai/ask', { method: 'POST', body: JSON.stringify({ question }) }),
  // },
  // finance: {
  //   transactions: (params: { from?: string; to?: string }) =>
  //     request<Transaction[]>('/v1/finance/transactions?' + new URLSearchParams(params)),
  // },
}

export { ApiError }
