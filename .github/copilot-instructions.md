# Project Guidelines

## Stack and Architecture
- This is a Next.js App Router project. `app/page.tsx` renders the main `DuelPage` UI from `components/duel-page.tsx`.
- Keep API handlers in `app/api/**/route.ts`, shared browser helpers in `lib/`, and reusable domain types in `types/`.
- Use TypeScript strict mode and the `@/` path alias from `tsconfig.json` instead of long relative imports.

## Build and Test
- Install dependencies with `npm install`.
- Use `npm run dev` for local development.
- Run `npm run lint` before finishing code changes.
- Run `npm run build` when changing app structure, API behavior, or shared types.

## Conventions
- Preserve the existing French UI copy and error messages unless the task explicitly asks for another language.
- Add `"use client"` only when a component needs hooks or browser-only APIs.
- Keep `window` and `localStorage` access SSR-safe by following the guard pattern in `lib/storage.ts`; never access them at module scope.
- Reuse `Series` and `StoredSeriesScore` from `types/series.ts` and extend shared types rather than duplicating inline shapes.
- Follow the existing Tailwind + Framer Motion style in `components/duel-page.tsx` for interactive UI changes.
- For TMDB-backed data, keep French-language responses and avoid returning incomplete series entries without posters or genres when possible.

## Environment Notes
- TMDB features require `TMDB_API_KEY` in `.env.local` (see `.env.local.example`).
- Remote poster images are loaded from `image.tmdb.org`; update `next.config.ts` if a new image host is introduced.
