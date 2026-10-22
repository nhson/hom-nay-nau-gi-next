# Session Handoff

## Current Objective

- Goal: feat-014, the admin page for the Danh mục món (issue #22), implemented and reviewed; the owner still has to merge and configure it.
- Current status: `main` is live and healthy; branch `feat/admin-page` holds the admin page (PR to open); the iPhone install hint (feat-013) is live and awaits a real-device check.
- Branch / commit: `feat/admin-page`

## Completed This Session

- [x] Scanned the codebase (no prior harness; `CONTEXT.md` + 2 ADRs existed) and wrote `CLAUDE.md`, `feature_list.json`, `progress.md`, `session-handoff.md`, `init.sh` with this project's real commands, rules and evidence

## Verification Evidence

| Check | Command | Result | Notes |
|---|---|---|---|
| Unit + contract | `corepack pnpm test` | 327 passed | on `feat/admin-page` |
| Browser + a11y | `corepack pnpm test:e2e` | 61 passed | needs a prior build; admin journeys use a fake admin API (CI has no database) |
| Lint / types / build | `./init.sh` | all green | run before relying on this |

## Files Changed

- Admin: `src/domain/dish-rules.ts`, `src/server/admin/*`, `src/app/api/v1/admin/*`, `src/app/(admin)/*`, `src/components/admin/*`, `src/lib/admin-api.ts`, migration `0001_admin_login_attempts`; user app moved into `src/app/(app)`; `e2e/admin*.ts`; docs (README, CLAUDE.md, ADR-0003 note, features)

## Decisions Made

- The database is the catalog source of truth (ADR-0004); each save is one SQL statement (dish + version bump) so it is atomic on the Neon HTTP driver
- Harness file is `CLAUDE.md` (Claude Code); no `AGENTS.md` because Next.js dev writes its own untracked one

## Blockers / Risks

- See `progress.md` (analytics visibility on Hobby, no branch protection, no rate limit, per-origin data)

## Next Session Startup

1. Read `CLAUDE.md`, then `progress.md` and `feature_list.json`, then this handoff.
2. `gh pr list` and `git status`.
3. Run `./init.sh` before editing.

## Recommended Next Step

- Open the admin PR if not open, wait for the owner to merge, then help configure ADMIN_PASSPHRASE / ADMIN_SESSION_SECRET and verify one real edit end to end.
