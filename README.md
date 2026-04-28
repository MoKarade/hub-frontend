# hub-frontend

UI web du Personal Data Hub — Next.js 15 + Tailwind + lucide-react + recharts.

## Direction visuelle

Tu m'as dit que le mockup 1 était "trop AI-générique, pas assez d'info, pas assez d'icônes, plat".
Cette version corrige :
- ★ **Vraies icônes** lucide-react partout (plus de glyphes texte)
- ★ **Palette plus chaleureuse** : ink (gris bleuté chaud) + accent vert terminal-y au lieu du violet AI-générique
- ★ **Plus dense** : sparklines dans les stat cards, dots d'importance sur insights, tags de version mono pour les apps
- ★ **Plus de caractère** : police mono pour les détails techniques, gradient subtil sur la search, footer status fixe en bas
- ★ **Vrai chart** (recharts) au lieu de divs alignés

À itérer encore une fois que tu pourras le voir tourner en vrai.

## Stack

- Next.js 15 (App Router) + React 19
- TypeScript
- Tailwind CSS 3
- lucide-react (icônes)
- recharts (graphiques)
- react-leaflet (carte trajets, Phase 2)
- framer-motion (animations subtiles)
- swr (data fetching avec cache)

## Démarrer en dev

```powershell
cd hub-frontend
npm install
copy .env.example .env.local
npm run dev
# → http://localhost:3000
```

Note : `npm install` prend 30s à 2 min selon ta connexion. La 1re fois Next télécharge ses outils.

## Build prod

```powershell
npm run build
npm start
# OR docker build
```

## Structure

```
hub-frontend/
├── app/
│   ├── layout.tsx               # Layout racine (fonts, html, body)
│   ├── page.tsx                 # Dashboard principal
│   ├── globals.css              # Tailwind + variables custom
│   ├── search/                  # Phase 1+ : recherche unifiée
│   ├── finances/                # Phase 1+ : page finances
│   ├── locations/               # Phase 2+ : carte trajets
│   ├── emails/                  # Phase 3+ : emails
│   ├── photos/                  # Phase 3+ : photos
│   └── apps/                    # Apps embarquées versionnées
│       └── [app]/[version]/page.tsx  # iframe vers /apps/<app>/<version>/
├── components/
│   ├── sidebar.tsx              # Nav verticale gauche
│   ├── ai-search-card.tsx       # Card "Demande à ton hub"
│   ├── stat-card.tsx            # Stat card avec sparkline
│   ├── insight-list.tsx         # Liste d'insights pro-actifs
│   ├── spending-chart.tsx       # Bar chart recharts
│   ├── app-tile.tsx             # Tile pour app versionnée
│   └── hub-status.tsx           # Footer santé du hub
├── lib/
│   ├── api.ts                   # Client HTTP vers hub-core
│   └── utils.ts                 # cn(), formatCurrency(), etc.
├── package.json
├── tailwind.config.ts
├── tsconfig.json
└── Dockerfile
```

## TODO Phase 0

- [x] Setup Next.js 15 + Tailwind + TS
- [x] Layout dashboard avec sidebar et top bar
- [x] AI search card
- [x] Stat cards avec sparklines
- [x] Liste d'insights
- [x] Spending chart (recharts)
- [x] App tiles avec versioning
- [x] Hub health footer
- [x] Client API typed
- [ ] Connexion réelle à hub-core (en attendant les endpoints data)
- [ ] Page /search avec recherche unifiée

## TODO Phase 1+

- [ ] Page /finances avec table + filtres
- [ ] Page /apps/[app]/[version] avec iframe et selector de version
- [ ] Page /search globale avec multi-source
- [ ] Mode mobile (responsive partout)
- [ ] PWA (manifest + service worker)
