# Session Progress Log

## Current State

**Last Updated:** 2026-10-15
**Active Feature:** feat-009 (Phase 1 documentation), then feat-010 (Phase 2, to be specified by the owner)

## Status

### What's Done

- [x] Phase 1 rebuild shipped and live (slices 1 to 6, production setup, food/recipe UI refresh); see `feature_list.json` for evidence
- [x] Neon database connected to the new Vercel project only, migrated and seeded (catalog v1, 73 dishes); the unused second database was deleted
- [x] Git-triggered deploys verified: PR gets a preview, merge to `main` deploys to production
- [x] Món ăn is a read-only recipe library (PR #16, issue #15, ADR-0003); live
- [x] Harness added in PR #12 (this file, `CLAUDE.md`, `feature_list.json`, `session-handoff.md`, `init.sh`); `./init.sh` ran green

### What's In Progress

- [ ] PR #10 "Docs: Phase 1 summary and feature list" is open, docs only, waiting for the owner to merge

### What's Next

0. Grill the admin page for dish content (`/grill-with-docs`); the dish library is read-only until it exists
1. Merge PR #10 when the owner says so; then (only if asked) tag/release "Phase 1"
2. Owner brings the first Phase 2 enhancement; capture it in `feature_list.json` (feat-010) and, if bigger than a tweak, write a spec issue first
3. Owner picks a custom domain (see `docs/phase-1.md` for the data-reset caveat when the address changes)

## Blockers / Risks

- [ ] Custom analytics events are not visible on Vercel Hobby (owner chose to stay): the north-star metric (mark_cooked/week) is unobservable
- [ ] No branch protection: Vercel deploys in parallel with CI
- [ ] No API rate limiting
- [ ] Personal data is per device and per web address (changing domain resets it); no export/import yet

## Decisions Made

- **Personal data stays on the device**: only the shared catalog is on the server
- **Domain core is the main test seam**, enforced by lint; Playwright is verification only
- **Stay on Vercel Hobby**, no own event counting for now
- **Old repo and old app untouched** until the owner retires them

## Evidence of Completion (last known)

- `corepack pnpm test`: 212 passed · Playwright: 18 passed · lint, typecheck, build clean (on `main` at 240bd79)
- Production health: `{"status":"ok","database":"up"}`

## Notes for Next Session

- pnpm is not on PATH; use `corepack pnpm`. Port 3000 is another app; use 3100+.
- Delete any untracked `AGENTS.md` that Next generates. Old repo has unrelated untracked files; leave them.
