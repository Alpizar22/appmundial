# whatif.lat

Viral generator of alternate football history. Type a "what if…?" scenario and Gemini Flash writes the story. Free, no signup required.

## Stack

- React 19 + Vite + React Router v7
- Supabase (optional auth + story storage)
- Google Gemini 2.5 Flash (free tier) via Vercel serverless function
- PWA (vite-plugin-pwa + Workbox)

## Dev

```bash
npm run dev       # Vite dev server
npm run build     # Production build
npm run lint      # ESLint
npm run preview   # Preview production build
```

## Environment

```
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
GEMINI_API_KEY          # server-side only
```
