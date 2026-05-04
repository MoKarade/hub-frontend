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
    const apiBase = process.env.HUB_API_INTERNAL_URL || 'http://localhost:8000'
    return [
      {
        source: '/v1/:path*',
        destination: `${apiBase}/v1/:path*`,
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
