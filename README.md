# Hôm nay nấu gì? (rebuild)

A meal-planning assistant for a Vietnamese family: every day it suggests a **Bữa cơm 3 món**
(Xào/Luộc/Salad + Canh + Món mặn) or a **Bữa 1 món** (phở/bún/nui…), with step-by-step recipes and a
merged shopping list. No accounts. Personal data stays on the device.

This is a ground-up rebuild of the original single-file app
([nhson/hom-nay-nau-gi](https://github.com/nhson/hom-nay-nau-gi), still live and untouched until the
rebuild reaches parity).

- **Spec:** [issue #1](https://github.com/nhson/hom-nay-nau-gi-next/issues/1)
- **Vocabulary:** [CONTEXT.md](CONTEXT.md) — use these terms exactly (Hộ gia đình, Nhóm món, Kiểu bữa ăn, Chay, Vùng miền)
- **Decisions:** [docs/adr](docs/adr)

## Stack

Next.js (App Router, TypeScript) · Tailwind CSS · Zod · Drizzle + Neon Postgres · Vitest · Playwright · Vercel.

## Architecture in one paragraph

All business rules live in a **framework-free domain core** (`src/domain`) that runs unchanged in the
browser and in tests. An ESLint rule forbids it from importing React, Next.js, the DB, Zod, the
browser, or anything outside the folder. The server will only serve a read-only dish catalog; user
data (custom dishes, history, favorites, today's menu, shopping ticks) lives on the device and is
merged with the catalog by dish `id`.

## Develop

```bash
corepack enable        # pnpm is pinned via package.json "packageManager"
pnpm install
pnpm test              # Vitest: domain core, seed integrity, API contract (in-memory Postgres)
pnpm lint && pnpm typecheck && pnpm build
```

### Database (catalog API)

The catalog lives in Postgres (Neon via the Vercel Marketplace). Copy `.env.example` to `.env.local`
(or run `vercel env pull .env.local`) and set `DATABASE_URL`. The seed in `src/seed/dishes.ts` is the
single source of truth.

```bash
pnpm db:migrate        # apply drizzle/ migrations
pnpm db:seed           # idempotent: upsert by id, retire missing ids, bump version only on change
pnpm db:generate       # after editing src/server/db/schema.ts
pnpm dev               # http://localhost:3000, GET /api/v1/catalog, GET /api/v1/health
```

Changing a dish is a data change: edit `src/seed/dishes.ts`, merge, run `pnpm db:seed` against
production. Clients pick up the new catalog version on their next background refresh.

Tests never need a database server: the API contract tests run the real migrations on PGlite
(in-memory Postgres).

### Installable and offline (PWA)

A service worker (Serwist) precaches the app shell, pages and static assets, so the whole app works
offline once opened; personal data and the cached catalog live in IndexedDB, not in the worker's cache.
It only runs in production builds. To try it: `pnpm build && pnpm start`, open the app, then stop the
server and reload. A new build installs a new worker in the background; the app shows an "Cập nhật"
prompt and reloads only when the user accepts (data is never cleared).

Icons are rendered from `public/icons/*.svg`; after changing the artwork run `pnpm icons` and commit the PNGs.

## Status

| Slice | Scope | State |
|---|---|---|
| 1 | Repo, CI, domain core with ported tests | done |
| 2 | Seed source, Postgres, catalog API + contract tests | done |
| 3 | Static shell, on-device store, Hôm nay | done |
| 4 | Dish bank and favorites | done |
| 5 | PWA and offline | in review |
| 6 | Analytics, accessibility, Playwright, parity checklist | — |
