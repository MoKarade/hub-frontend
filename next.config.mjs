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
