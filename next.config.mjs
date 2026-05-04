/** @type {import('next').NextConfig} */
const nextConfig = {
  // Standalone output pour Docker
  output: 'standalone',

  // Si le hub est servi sous /app/ via Caddy, sinon laisser vide
  // basePath: '/app',

  reactStrictMode: true,

  experimental: {
    // Pour SWR + React 19
    optimizePackageImports: ['lucide-react', 'recharts'],
  },

  // Proxy API server-side : /v1/* → hub-core (localhost:8000).
  // Permet l'accès distant via Cloudflare Tunnel sans exposer le port 8000.
  // Le navigateur ne parle qu'au domaine du hub (pas à localhost:8000 directement).
  // HUB_API_INTERNAL_URL = variable serveur (non NEXT_PUBLIC) → non exposée au client.
  async rewrites() {
    // Quand le hub est accédé via Cloudflare Tunnel (hostname ≠ localhost),
    // getBaseUrl() dans api.ts retourne `https://<tunnel>/api`.
    // Les appels arrivent donc sur /api/v1/... → on les forward vers hub-core.
    // Couvre aussi les SSE (/api/v1/events/*) qui passent en streaming.
    const apiBase = process.env.HUB_API_INTERNAL_URL || 'http://localhost:8000'
    return [
      {
        source: '/api/:path*',
        destination: `${apiBase}/:path*`,
      },
    ]
  },

  // CSP headers — rendre strict en prod
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ]
  },
}

export default nextConfig
