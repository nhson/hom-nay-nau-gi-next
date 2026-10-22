# Session Progress Log

## Current State

**Last Updated:** 2026-10-22
**Active Feature:** feat-015 Giao diện switch (issue #25, branch `feat/theme-switch`): implemented and reviewed; screenshots shown for approval, then PR

## Status

### What's Done

- [x] Phase 1 rebuild shipped and live (slices 1 to 6, production setup, food/recipe UI refresh); see `feature_list.json` for evidence
- [x] Neon database connected to the new Vercel project only, migrated and seeded (catalog v1, 73 dishes); the unused second database was deleted
- [x] Git-triggered deploys verified: PR gets a preview, merge to `main` deploys to production
- [x] Món ăn is a read-only recipe library (PR #16, issue #15, ADR-0003); live
- [x] Phase 1 documentation merged (PR #10) and tagged/released `phase-1`: `docs/phase-1.md`, `docs/features.md`, `docs/parity-checklist.md`
- [x] Admin page decisions grilled and recorded (PR #18): ADR-0004 (database is the catalog source of truth), ADR-0005 (personal data stays on the device; Hộ gia đình dropped), glossary Quản trị viên / Món đã ẩn
- [x] feat-014 admin page live (PR #23, issue #22): sign-in, list, add/edit, hide/show, export; migration 0001 applied; the owner saved a real edit and the public catalog went to v2
- [x] feat-015 implemented on `feat/theme-switch`: Sáng / Tối / Theo thiết bị switch in the app header, the admin top bar and the sign-in page (glossary: Giao diện); `./init.sh` green
- [x] Harness added in PR #12 (this file, `CLAUDE.md`, `feature_list.json`, `session-handoff.md`, `init.sh`); `./init.sh` ran green

### What's In Progress

- [ ] Owner checks still open: the install hint on a real iPhone (Safari and Chrome), and a short VoiceOver pass on /admin

### What's Next

1. Prove the single-statement saves are fine on the real Neon driver beyond the first edit (they worked for one real save); nothing further needed unless something fails
2. Owner picks a custom domain (see `docs/phase-1.md` for the data-reset caveat when the address changes)
3. Next feature: run `/grill-with-docs` for the owner's next idea (candidates: sort and preview toggle on /admin, which were deferred)

## Blockers / Risks

- [ ] Admin sign-in lock key is the first X-Forwarded-For address; on Vercel the platform sets it. Off Vercel a client could choose its own key, and a missing header shares one bucket
- [ ] The admin redirect to sign-in happens in the browser after a session check (the page shell is static), not as a server redirect; nothing private is in the shell
- [ ] One-off: the admin accessibility check "edit form after a failed submit (light)" failed once during a full `./init.sh` right after a build and then passed 10/10 reruns; if it recurs, capture the violation text
- [ ] The offline Playwright journey (`works offline once opened`) is flaky in CI (failed twice on one run, passed on re-run): re-run before suspecting the change

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
