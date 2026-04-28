# hub-frontend — Contexte pour Claude Code

> **Avant de commencer, lis aussi :** `../../CLAUDE.md` (handoff projet global) et `~/.claude/CLAUDE.md` (profil Marc + règles).

## Rôle du repo

UI web du Personal Data Hub. Next.js 15 + Tailwind. Communique avec hub-core via HTTP. Embed les apps versionnées via iframes.

## Stack

- Next.js 15 (App Router) + React 19
- TypeScript strict
- Tailwind CSS 3 (palette custom dans tailwind.config.ts)
- lucide-react (icônes — IMPORTANT, pas de glyphes texte)
- recharts (graphiques)
- react-leaflet (carte trajets, Phase 2)
- framer-motion (animations subtiles)
- swr (data fetching avec cache + revalidation)

## Direction visuelle (IMPORTANT)

Marc a explicitement dit que le mockup initial était **"trop AI-générique, pas assez d'info, pas assez d'icônes, c'est plat"**.

**À respecter :**
- ✅ Palette ink (gris bleuté chaud) + accent **vert terminal-y** (#5cdb95). PAS de violet/purple AI-generic.
- ✅ Vraies icônes lucide-react PARTOUT (jamais de glyphes texte type ★ comme placeholder)
- ✅ Densité élevée : sparklines dans stat cards, dots d'importance sur insights, tags de version mono
- ✅ Vrais charts recharts, jamais des divs alignés
- ✅ Détails techniques en font-mono pour le caractère
- ✅ Animations subtiles (pulse-slow sur status, fade-in sur load)

**À éviter :**
- ❌ Palette violet/blue gradient générique
- ❌ Beaucoup de blanc/vide ("startup landing page" feel)
- ❌ Glyphes ASCII en placeholder d'icônes
- ❌ Charts en CSS pur

## État actuel (2026-04-28)

✅ Setup Next.js 15 + Tailwind + TS
✅ Layout dashboard avec sidebar et top bar
✅ Composants : `sidebar`, `ai-search-card`, `stat-card` (avec sparkline), `insight-list`, `spending-chart` (recharts), `app-tile`, `hub-status`
✅ Page d'accueil `/` complète
✅ Client API typed dans `lib/api.ts`
✅ Helpers `lib/utils.ts` (cn, formatCurrency, formatRelative)
✅ Dockerfile multi-stage (output standalone)

❌ Pas encore tourné en vrai (`npm install` jamais lancé)
❌ Aucune connexion réelle à hub-core (les composants montrent des data demo en attendant)
❌ Pages autres que `/` à créer : `/finances`, `/locations`, `/emails`, `/photos`, `/search`, `/insights`, `/system/health`, `/settings`, `/apps/[app]/[version]`

## Conventions de code

- Composants en TSX, exports nommés
- Server Components par défaut, `'use client'` uniquement si nécessaire
- État client : useState, useReducer, swr
- Pas de Redux ni Zustand (over-engineering pour ce projet)
- Imports : `@/components/...`, `@/lib/...` (alias définis dans tsconfig)
- Tailwind classes ordonnées : layout → flex/grid → spacing → typo → colors → effects
- `cn()` pour combiner classes conditionnelles

## TODO Phase 0

- [ ] `npm install` réussit sur le PC de Marc
- [ ] `npm run dev` démarre sur :3000
- [ ] La page d'accueil affiche correctement
- [ ] `HubStatus` component fetch `/v1/ready` et affiche les dots correctement
- [ ] Build prod réussit (`npm run build`)

## TODO Phase 1

- [ ] Page `/finances` avec table (TanStack Table ?), filtres date+catégorie+montant
- [ ] Page `/search` avec input + résultats (call `/v1/ai/ask`)
- [ ] Wiring AI search card sur la home : appel API + display réponse
- [ ] PWA manifest + service worker
- [ ] Mode mobile responsive (sidebar en hamburger)

## TODO Phase 2+

- [ ] Page `/locations` avec carte react-leaflet
- [ ] Page `/apps/[app]/[version]` avec iframe + selector de version
- [ ] Page `/emails` avec recherche full-text + filters
- [ ] Page `/photos` avec grid + recherche CLIP

## Règles spécifiques

- ❌ Ne JAMAIS hardcoder des données fictives en prod (uniquement les composants demo qui seront branchés sur l'API)
- ❌ Ne JAMAIS appeler une API externe (Google Maps, etc.) côté frontend — tout passe par hub-core
- ❌ Ne JAMAIS commit `.env.local`
- ✅ Toujours typed les responses API via `lib/api.ts`
- ✅ Loading states avec skeletons (pas de spinners moches)
- ✅ Errors states user-friendly (pas de stack traces affichés)

## Démarrer en dev

```powershell
cd C:\hub\hub-frontend
npm install
copy .env.example .env.local
npm run dev
# → http://localhost:3000
```

Note : `NEXT_PUBLIC_HUB_API_URL` doit pointer sur hub-core (en dev: `http://localhost:8000`, en prod via Caddy: `/api`).

## Liens

- Mockups originaux : `../../mockups/index.html`
- Master plan UI : `../../04_master_plan.md` (sections Phase 1 et Phase 2)
