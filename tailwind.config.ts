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
        // Palette dark riche, pas le générique violet
        // Inspirée d'un IDE/terminal mais plus chaleureuse
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
        accent: {
          // Vert plutôt que violet, plus terminal-y, moins startup-AI
          DEFAULT: '#5cdb95',
          dark: '#3aa370',
          light: '#7ee8b3',
        },
        warn: '#ffb84d',
        danger: '#ff6b6b',
        info: '#5fb3f4',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
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
      },
    },
  },
  plugins: [],
}

export default config
