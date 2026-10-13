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
pnpm dev               # http://localhost:3000
pnpm test              # Vitest (domain core)
pnpm lint && pnpm typecheck && pnpm build
```

## Status

| Slice | Scope | State |
|---|---|---|
| 1 | Repo, CI, domain core with ported tests | in review |
| 2 | Seed source, Postgres, catalog API + contract tests | — |
| 3 | Static shell, on-device store, Hôm nay | — |
| 4 | Dish bank and favorites | — |
| 5 | PWA and offline | — |
| 6 | Analytics, accessibility, Playwright, parity checklist | — |
