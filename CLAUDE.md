# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Start Vite dev server with HMR
npm run build     # Production build
npm run lint      # ESLint check
npm run preview   # Preview production build locally
```

## Architecture Overview

**SoccerSticker** – Digital sticker album organizer for the 2026 World Cup. Freemium model: free tier is limited to the default theme and no chat; Pro unlocks all themes, profile customization, and chat for a one-time $2.99 Stripe payment.

**Stack**: React 19 + Vite, React Router v7, Supabase (auth + database), Stripe (payment), PWA (vite-plugin-pwa + Workbox), Leaflet for the trades map, Vercel Analytics.

## Routing & Pages (`src/App.jsx`)

All routes except `/auth` and `/verificado` require authentication via `<ProtectedRoute>`.

| Path | Page | Notes |
|---|---|---|
| `/` | Dashboard | Stats, streaks, rare card highlights |
| `/auth` | Auth | Login/signup |
| `/coleccion` | CollectionPage | Browse all 800 cards; +/− quantity per card |
| `/duplicados` | DuplicatesPage | Cards with quantity > 1 |
| `/intercambios` | TradesPage | Post/browse trades; Leaflet proximity map |
| `/chat` | ChatPage | Pro feature: messaging with trade partners |
| `/premium` | PremiumPage | $2.99 upgrade, theme picker |
| `/perfil` | ProfilePage | Avatar, title, theme (Pro-gated) |
| `/verificado` | VerificadoPage | Email verification callback |

## State & Data Flow

**Global context** (wrap entire app):
- `AuthContext` – `user`, `loading`, `signOut()`. Subscribes to `supabase.auth.onAuthStateChange`.
- `LangContext` – `lang` (es/en), `t(key, {params})` translation function, `locale`. Persists to localStorage. Auto-detects browser language.

**Custom hooks** (`src/hooks/`):
- `useProfile` – Fetches/updates `profiles` table row for current user.
- `useTheme` – Applies one of 12 CSS-variable themes to `:root`; persists to localStorage + `profiles.tema`. Pro users only can switch themes.
- `useProStatuses` – Batch-fetches pro status for multiple user IDs (used in trades/chat).
- `useUserProfiles` – Fetches display info for a list of user IDs.
- `useAuth` – Thin wrapper over AuthContext.

## Supabase Tables

| Table | Key columns |
|---|---|
| `profiles` | `id` (= auth uid), `is_pro`, `pro_since`, `titulo`, `avatar_emoji`, `tema` |
| `user_cards` | `user_id`, `card_number` (1–800), `quantity` |
| `trade_postings` | `user_id`, `offer_card`, `want_card`, `active` |
| `conversations` | `participant_small`, `participant_large`, `messages` (jsonb array) |

Cards 1–600 are common; 601–800 are rare/special.

## Stripe Payment Flow

1. User clicks upgrade on `PremiumPage`.
2. Frontend POSTs to `/api/create-checkout` with `Authorization: Bearer <supabase-jwt>`.
3. Backend creates a Stripe Checkout Session and returns `{ url }`.
4. Frontend redirects to Stripe; on success redirects back to `/premium?success=true`.
5. `PremiumPage` detects `?success=true`, shows banner, and refreshes `is_pro` from `profiles`.

## i18n Pattern

Translations live in `src/i18n/es.js` and `src/i18n/en.js`. Use `useLang()` to get `t(key, {params})`. String interpolation uses `{variableName}` placeholders. Spanish is the default.

## Theme System

12 themes (`default`, `gold`, `green`, `galaxy`, `mexico`, `brasil`, `argentina`, `alemania`, `francia`, `españa`, `usa`, `rainbow`). Themes are applied as CSS custom properties (`--wc-red`, `--wc-blue`, etc.) on `document.documentElement` by `useTheme`. Free users are locked to `default`.

## PWA & Caching

Workbox service worker (auto-update on new deploy) caches:
- Supabase API responses: NetworkFirst, 5-min TTL, max 50 entries.
- Map tiles: CacheFirst, 7-day TTL.

## Environment Variables

```
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
VITE_STRIPE_PUBLIC_KEY
VITE_STRIPE_PRICE_ID   # $2.99 one-time price
STRIPE_SECRET_KEY      # server-side only
```

## Supabase Table Reference (canonical column names)

| Table | Columns |
|---|---|
| `user_cards` | `id`, `user_id`, `carta_numero`, `cantidad` |
| `trade_posts` | `id`, `user_id`, `carta_ofrezco`, `carta_busco`, `lat`, `lng`, `activo` |
| `conversations` | `id`, `participant_small`, `participant_large` |
| `messages` | `id`, `conversation_id`, `sender_id`, `body` |
| `profiles` | `id`, `is_pro`, `titulo`, `avatar_emoji`, `tema`, `pro_since` |

> Note: some hooks reference legacy column names (`card_number`, `quantity`, `offer_card`, `want_card`). Use the canonical names above for any new queries.

## Upcoming Features (Roadmap)

1. **Dashboard stats cards** – Clickable cards showing: completado%, total, me faltan, tengo, repetidas, brillantes (Pro-only stat).
2. **Mark cards from home** – Quick toggle to mark cards directly from the Dashboard without going to `/coleccion`.
3. **Notes tab** – Per-card notes for cards the user specifically wants to find/trade for.
4. **Special card types** – Brillantes, oro, bronce with rarity tiers (affects display and stats).
5. **Pro lock UI** – Blurred card previews with a padlock overlay to gate Pro-only features visually.
