import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: ['class'],
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  theme: {
    container: {
      center: true,
      padding: '1rem',
    },
    extend: {
      colors: {
        // Palette dark riche, inspirée Google Analytics dark mode.
        // Sprint C : moins de saturation, plus de hiérarchie typographique.
        ink: {
          950: '#0a0e14',
          900: '#0f1419',
          800: '#171c25',
          700: '#1f2630',
          600: '#2a323e',
          500: '#3a4453',
          400: '#5a6572',
          300: '#8b95a3',
          200: '#c5cdd6',
          100: '#e6ecf2',
        },
        // Tokens sémantiques pour la donnée (Sprint C).
        // À utiliser POUR LES VALEURS uniquement, pas pour l'UI générale.
        data: {
          positive: '#34a853',  // Google green — gain, solde positif, statut ok
          negative: '#ea4335',  // Google red — perte, dépassement, alerte
          neutral:  '#e6ecf2',  // = ink-100, valeur sans charge sémantique
          muted:    '#8b95a3',  // = ink-300, valeur secondaire
        },
        // Accent UI (boutons, liens, focus). Utilisation parcimonieuse.
        accent: {
          DEFAULT: '#5cdb95',
          dark:    '#3aa370',
          light:   '#7ee8b3',
        },
        warn:   '#ffb84d',
        danger: '#ff6b6b',
        info:   '#5fb3f4',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        // Sprint A — widget interactions
        'ring-pulse': 'ringPulse 1.5s ease-out',      // SSE event reçu (Sprint B)
        'shimmer': 'shimmer 2s linear infinite',       // skeleton loading
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        // Pulse ring vert quand un widget reçoit un event SSE
        ringPulse: {
          '0%':   { boxShadow: '0 0 0 0 rgba(92,219,149,0.45)' },
          '70%':  { boxShadow: '0 0 0 10px rgba(92,219,149,0)' },
          '100%': { boxShadow: '0 0 0 0 rgba(92,219,149,0)' },
        },
        // Skeleton shimmer
        shimmer: {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      // Tokens de spacing widget
      spacing: {
        'widget': '1rem',       // gap entre widgets
        'widget-sm': '0.75rem',
      },
    },
  },
  plugins: [],
}

export default config
