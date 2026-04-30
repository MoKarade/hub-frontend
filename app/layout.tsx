import type { ReactNode } from 'react'
import type { Metadata, Viewport } from 'next'
import { Inter, JetBrains_Mono } from 'next/font/google'
import { Providers } from '@/components/providers'
import { InstallPrompt } from '@/components/install-prompt'
import { Toaster } from '@/components/toaster'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Hub perso — Personal Data Hub',
  description: 'Hub privé qui agrège toutes tes données personnelles avec une IA locale',
  robots: 'noindex, nofollow', // pas indexable
  manifest: '/manifest.json',
  applicationName: 'Hub perso',
  appleWebApp: {
    capable: true,
    title: 'Hub perso',
    statusBarStyle: 'black-translucent',
  },
  icons: {
    icon: '/icon.svg',
    apple: '/icon.svg',
    shortcut: '/icon.svg',
  },
  formatDetection: {
    telephone: false,
  },
}

export const viewport: Viewport = {
  themeColor: '#0f1419',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  // Permet le zoom utilisateur (accessibilité), interdit le zoom auto sur input focus iOS
  userScalable: true,
  colorScheme: 'dark',
}

export default function RootLayout({
  children,
}: {
  children: ReactNode
}) {
  return (
    <html lang="fr" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="font-sans">
        <Providers>
          {children}
          <InstallPrompt />
          <Toaster />
        </Providers>
      </body>
    </html>
  )
}
