# Session Handoff

## Current Objective

- Goal: feat-016 (spec #30), Món chờ duyệt + tải ảnh công thức: AI-read recipe photos wait on a Chờ duyệt tab until the Quản trị viên approves them.
- Current status: built and verified on `feat/review-queue`; PR open with base `grill/recipe-review-queue` (it retargets to `main` once PR #29 merges). Not merged.
- Branch / commit: `feat/review-queue`

## Completed This Session

- [x] Domain: `src/domain/pending-dish.ts` reads the model's reply into a dish draft (or not_a_recipe / unreadable / invalid_shape), repairs common model quirks, derives warnings (chay with tỏi, possible duplicates by Vietnamese-aware name similarity), and holds the model instructions
- [x] Server: `pending_dishes` table (migration `0002_pending_dishes`), `pending-repository.ts` (Duyệt is ONE SQL statement: delete pending + insert dish + bump version), `RecipeReader` port with an OpenRouter adapter (free model fallback list), admin API under `/api/v1/admin/pending`
- [x] UI: Chờ duyệt tab with count badge, photo picker (shrunk to JPEG on the device), review mode of the dish form (Lưu / Duyệt / Bỏ, warnings box)

## Verification Evidence

| Check | Command | Result | Notes |
|---|---|---|---|
| Unit + contract | `corepack pnpm test` | 395 passed | 25 new domain tests, 43 new contract tests with a fake RecipeReader |
| Browser + a11y | `corepack pnpm test:e2e` | 94 passed | 13 new in `e2e/review.spec.ts` (journey, failures, axe light + dark at phone width) |
| Lint / types / build | `./init.sh` | all green | the build needed a retry because of the Next.js security nudge (see progress.md) |

## Decisions Made

- No AI SDK dependency: the OpenRouter adapter is a plain `fetch` with the `models` fallback list and `response_format: json_object`; every answer is checked by `readRecipeReply` and, on Duyệt, `validateDish`
- Warnings are derived on every read, never stored; Lưu allows an incomplete proposal (only an impossible time is refused)
- Remembering discarded sources is spec B (#31): only agent items have a source URL

## Blockers / Risks

- Owner must add `OPENROUTER_API_KEY` in Vercel (optional `OPENROUTER_MODELS`, comma separated) before photo reading works anywhere but tests
- Migration `0002_pending_dishes` must be applied to production after merge (`db:migrate`, ask first)
- The free model has not been tried on a real Vietnamese recipe photo yet
- See `progress.md` for the Next.js security advisory and the older risks

## Next Session Startup

1. Read `CLAUDE.md`, then `progress.md` and `feature_list.json`, then this handoff.
2. `gh pr list` and `git status`.
3. Run `./init.sh` before editing.

## Recommended Next Step

- After the owner merges PR #29 and the feat-016 PR: apply migration 0002, add the key, read one real photo on a phone. Then `/implement` spec #31 (feat-017), reusing the Món chờ duyệt table and the RecipeReader port.
