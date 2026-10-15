# CLAUDE.md

"Hôm nay nấu gì?": a Vietnamese family meal planner (random 3-dish meals, dish bank, shopping list,
favorites). Next.js 16 App Router + TypeScript, Tailwind/shadcn, Neon Postgres + Drizzle, an
installable offline PWA. Live: https://hom-nay-nau-gi-next.vercel.app. **Phase 1 is complete; new work is Phase 2.**
Phase 1 spec and 77 user stories: issue #1. Status: `docs/phase-1.md`, `docs/features.md`, `docs/parity-checklist.md`.

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

## Agent skills

### Issue tracker

GitHub Issues for `nhson/hom-nay-nau-gi-next`, via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

The five default roles (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). Only `ready-for-agent` exists in the repo so far; create the others when first needed. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `CONTEXT.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.

## Feature workflow (idea → grill → spec → implement → docs)

New work follows this loop; the harness files carry state between steps and sessions. Full playbook with
example prompts: `docs/workflow.md`.

1. **Start**: run `./init.sh`, read `progress.md` / `feature_list.json`. Baseline must be green.
2. **Grill**: for any new idea, interview the owner first (skills `grilling` + `domain-modeling`, i.e. `/grill-with-docs`).
   One question at a time, recommended answer included, explore the code instead of asking when the code can answer.
   Update `CONTEXT.md` and `docs/adr/` inline as terms and decisions are settled. Do not write code in this step.
3. **Spec**: the owner runs `/to-spec` to publish the PRD as a GitHub issue labelled `ready-for-agent`. Then add a
   feature to `feature_list.json` (next `feat-NNN`, `status: not-started`, issue number in the description).
   If the spec is large, `/to-tickets` splits it into vertical slices, one feature entry per slice.
4. **Implement**: on a branch, `/implement` the spec: `/tdd` at the seams the spec names (domain core first), typecheck often,
   full `./init.sh` once at the end, then `/code-review`. Set the feature `in-progress` while working.
5. **Docs**: update `docs/features.md` (and `docs/parity-checklist.md` if parity changed), `CONTEXT.md`/ADRs if language or decisions
   changed, `feature_list.json` (`done` + evidence), `progress.md`, `session-handoff.md`.
6. **Ship**: open a PR that links the spec issue (`Closes #N`). Merge only when the owner says so. At the end of a phase, add `docs/phase-N.md` and tag/release `phase-N`.

Rules: the owner types `/to-spec`, `/to-tickets` and `/implement` (they are user-invoked); the agent proposes the next step
and, when asked for a new idea, starts at step 2 rather than coding. Small tweaks (copy, a bug fix, a style change) may skip steps 2 to 3
but still get a `feature_list.json` entry and the checks in the definition of done.

## Architecture rules (enforced where noted)

- `src/domain/` is the primary test seam: pure TypeScript, injected rng/clock/ids, **no** React, Next,
  DB, Zod, browser globals or imports from outside the folder (**lint-enforced**). All logic changes go
  here first with tests. UI components stay thin and only dispatch actions and render selectors.
- Second seam: the catalog API contract (`src/server/catalog/*.contract.test.ts`, real migrations on PGlite).
  Playwright (`e2e/`) is verification only. No component tests, no service-worker unit tests.
- **Personal data never leaves the device** (history, favorites, custom/edited dishes, ticks) and lives in
  IndexedDB (`src/lib/idb.ts`). The server only publishes the shared catalog. Analytics events carry
  no personal content (see `src/domain/analytics.ts`).
- Dish enum values and ids are identical to the legacy app (`buacom`/`buatomonuoc`, `xao|canh|man`,
  `bac|trung|nam`, `x*`/`c*`/`m*`/`t*`); custom dishes are `custom:<uuid>`. Chay dishes contain no tỏi.
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
