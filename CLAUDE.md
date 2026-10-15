# CLAUDE.md

"Hôm nay nấu gì?": a Vietnamese family meal planner (random 3-dish meals, dish bank, shopping list,
favorites). Next.js 16 App Router + TypeScript, Tailwind/shadcn, Neon Postgres + Drizzle, an
installable offline PWA. Live: https://hom-nay-nau-gi-next.vercel.app. **Phase 1 is complete; new work is Phase 2.**
Spec and 77 user stories: issue #1. Status: `docs/phase-1.md`, `docs/features.md`, `docs/parity-checklist.md`.

## Startup Workflow (every session)

1. `pwd` must be this repo (`hom-nay-nau-gi-next`). **Never edit** the sibling legacy repo `../hom-nay-nau-gi` (the old app stays live and untouched).
2. Read this file, then `progress.md` and `feature_list.json` (current state), then `session-handoff.md`.
3. Read `CONTEXT.md` (glossary) before touching domain code or UI copy; `docs/adr/` for decisions.
4. `git status`, `git log --oneline -5`, `gh pr list` to see what is in flight.
5. Run `./init.sh` (lint, typecheck, unit/contract tests, build, Playwright). Fix a red baseline before adding scope.

## Commands

pnpm is **not on PATH**: use `corepack pnpm <script>`.

| Need | Command |
|---|---|
| Unit + API contract tests | `corepack pnpm test` (Vitest; PGlite, no DB needed) |
| Lint / types | `corepack pnpm lint` · `corepack pnpm typecheck` |
| Production build | `corepack pnpm build` |
| Browser journeys + axe a11y | `corepack pnpm build && corepack pnpm test:e2e` (needs `pnpm exec playwright install chromium` once) |
| Dev server | `corepack pnpm dev -p 3100` (port 3000 on this machine is another app) |
| DB (needs `.env.local` from `vercel env pull`) | `db:migrate`, `db:seed`, `db:generate` |

## Architecture rules (enforced where noted)

- `src/domain/` is the primary test seam: pure TypeScript, injected rng/clock/ids, **no** React, Next,
  DB, Zod, browser globals or imports from outside the folder (**lint-enforced**). All logic changes go
  here first with tests. UI components stay thin and only dispatch actions and render selectors.
- Second seam: the catalog API contract (`src/server/catalog/*.contract.test.ts`, real migrations on PGlite).
  Playwright (`e2e/`) is verification only. No component tests, no service-worker unit tests.
- **Personal data never leaves the device** (history, favorites, today's menu, ticks) and lives in
  IndexedDB (`src/lib/idb.ts`). The server only publishes the shared catalog. Analytics events carry
  no personal content (see `src/domain/analytics.ts`).
- Dish enum values and ids are identical to the legacy app (`buacom`/`buatomonuoc`, `xao|canh|man`,
  `bac|trung|nam`, `x*`/`c*`/`m*`/`t*`). Chay dishes contain no tỏi.
- **The Danh mục món is read-only on devices** (ADR-0003): no add, edit, delete, restore or reset of dishes. Dish content changes only via the seed (later an admin page). Old per-device dish data is not read but is carried through untouched in storage (`user` in the personal state): never interpret it, never drop it.
- Use the glossary terms (Nhóm món, Kiểu bữa ăn, Bữa cơm 3 món, Bữa 1 món, Chay, Vùng miền) in code and copy. UI copy is Vietnamese.
- Seed content lives only in `src/seed/dishes.ts` (changing a dish = edit seed + `db:seed`).

## Working rules

- One feature at a time, taken from `feature_list.json`; keep changes in scope.
- Work on a branch; open a PR; **merge only when the user says so** (squash). Never push to `main`.
  CI = lint, typecheck, unit tests, build, Playwright. Vercel builds a preview per PR and deploys `main` to production.
- Ask before: deploying by CLI, running `db:migrate`/`db:seed` against production, deleting resources,
  changing Vercel/Neon/GitHub settings, or touching the legacy repo.
- Never print or commit secrets (`.env.local`, tokens). `.claude/`, `.vercel/`, `.env*`, `test-results/` are ignored.

## Gotchas

- `next dev`/`next start` writes an untracked `AGENTS.md`; delete it, do not commit it.
- A stale `next start` on a port keeps serving an old build: kill it before re-testing.
- The built-in browser pane cannot register service workers; verify offline/PWA with Playwright.
- A service worker serves the previous build until the user accepts the update prompt; unregister it when screenshotting.
- Tests that reload right after a tap must call `flushWrites(page)` (`e2e/helpers.ts`) so IndexedDB writes commit.
- axe scans run with reduced motion, otherwise they read colours mid-fade.
- Vercel is on the Hobby plan: custom analytics events are sent but not visible (owner decision).

## Definition of done

- [ ] Behaviour implemented; logic changes covered by domain tests
- [ ] `./init.sh` (or the relevant subset) actually ran green; failures reported, not hidden
- [ ] UI changes checked in a browser at phone width, light and dark; axe still clean
- [ ] `feature_list.json` status + evidence and `progress.md` updated; `docs/features.md` if scope changed
- [ ] Committed on a branch and a PR opened (not merged unless asked)

## End of session

Update `progress.md`, `feature_list.json` and `session-handoff.md`; list open PRs and blockers; leave the tree clean.
