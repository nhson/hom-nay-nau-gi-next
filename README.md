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

## Status

| Slice | Scope | State |
|---|---|---|
| 1 | Repo, CI, domain core with ported tests | done |
| 2 | Seed source, Postgres, catalog API + contract tests | in review |
| 3 | Static shell, on-device store, Hôm nay | — |
| 4 | Dish bank and favorites | — |
| 5 | PWA and offline | — |
| 6 | Analytics, accessibility, Playwright, parity checklist | — |
