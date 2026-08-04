# CLAUDE.md

Guidance for Claude Code working in this repo.

## Commands

```bash
npm run dev       # Vite dev server with HMR
npm run build     # Production build
npm run lint      # ESLint
npm run preview   # Preview build
```

## Architecture Overview

**whatif.lat** — Viral generator of alternate football history stories. User types a "¿qué pasaría si…?" scenario, backend calls Google Gemini 2.5 Flash (free tier), and returns a short narrative. Anyone can generate and share; signup is optional and only used to save personal history.

**Stack**: React 19 + Vite, React Router v7, Supabase (optional auth + `stories` table), Google Gemini Flash via Vercel serverless function, PWA (vite-plugin-pwa + Workbox), react-helmet-async for SEO, Vercel Analytics.

## Routes (`src/App.jsx`)

| Path | Page | Auth |
|---|---|---|
| `/` | GeneratorPage | none |
| `/historia/:id` | StoryPage (view shared) | none |
| `/mis-historias` | MyStoriesPage | required |
| `/acerca` | AboutPage | none |
| `/auth` | AuthPage (login/register) | optional |
| `/verificado` | VerificadoPage (email callback) | none |

No `ProtectedRoute` — auth is fully optional. `MyStoriesPage` gates itself and prompts login when needed.

## State & Data Flow

**Global context**:
- `AuthContext` — `user`, `loading`, `signOut()`. Subscribes to `supabase.auth.onAuthStateChange`. User may be null.
- `LangContext` — `lang` (es/en), `t(key, {params})`, `locale`. Persists to localStorage, auto-detects browser language, Spanish default.

## Story Generation Flow

1. User types scenario on `/`, clicks "Generar historia".
2. Frontend POSTs `{ scenario, lang }` to `/api/generate-story`.
3. Serverless function calls Gemini 2.5 Flash with system prompt requesting structured JSON `{ title, story, hashtags[] }`.
4. Frontend renders the story locally. If the user clicks "Compartir", it's inserted into `stories` (user_id may be null for anonymous) and navigates to `/historia/:id`.
5. `/historia/:id` is publicly readable and share-friendly (OG tags via Helmet).

## Supabase Tables

| Table | Key columns |
|---|---|
| `stories` | `id` (uuid), `user_id` (nullable), `prompt` (jsonb), `title` (text), `content` (text), `views` (int), `created_at` |

RLS: anyone can insert (including anon), anyone can read; only owner can delete.

## Gemini Config

- Model: `gemini-2.5-flash` (free tier)
- `responseMimeType: 'application/json'` for reliable parsing
- `temperature: 0.9` for creative variance
- `maxOutputTokens: 1200`
- API key in server env var `GEMINI_API_KEY` — never exposed to client

## i18n

Translations in `src/i18n/es.js` and `src/i18n/en.js`. Use `useLang()` → `t(key, {params})` with `{placeholder}` interpolation.

## PWA & Caching

Workbox service worker (autoUpdate) caches Supabase API responses (NetworkFirst, 5-min TTL).

## Environment Variables

```
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
GEMINI_API_KEY          # server-side, in Vercel env
```
