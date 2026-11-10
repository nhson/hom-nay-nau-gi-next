# Session Progress Log

## Current State

**Last Updated:** 2026-11-10
**Active Feature:** feat-021 Nhập từ file moves into Thêm món (small tweak, no spec issue): built on `feat/add-tabs`, committed, not pushed

## Status

### What's Done

- [x] Phase 1 rebuild shipped and live (slices 1 to 6, production setup, food/recipe UI refresh); see `feature_list.json` for evidence
- [x] Neon database connected to the new Vercel project only, migrated and seeded (catalog v1, 73 dishes); the unused second database was deleted
- [x] Git-triggered deploys verified: PR gets a preview, merge to `main` deploys to production
- [x] Món ăn is a read-only recipe library (PR #16, issue #15, ADR-0003); live
- [x] Phase 1 documentation merged (PR #10) and tagged/released `phase-1`: `docs/phase-1.md`, `docs/features.md`, `docs/parity-checklist.md`
- [x] Admin page decisions grilled and recorded (PR #18): ADR-0004 (database is the catalog source of truth), ADR-0005 (personal data stays on the device; Hộ gia đình dropped), glossary Quản trị viên / Món đã ẩn
- [x] feat-014 admin page live (PR #23, issue #22): sign-in, list, add/edit, hide/show, export; migration 0001 applied; the owner saved a real edit and the public catalog went to v2
- [x] feat-015 Giao diện switch live (PR #26, issue #25): Sáng / Tối / Theo thiết bị in the app header, the admin top bar and the sign-in page
- [x] Phase 2 ideas grilled (PR #29): Món chờ duyệt, Nguồn công thức, Tác nhân thu thập; ADR-0006 (AI dishes wait for review), ADR-0007 (allowed sources, free models via OpenRouter); specs #30 (A) and #31 (B)
- [x] feat-016 live (PR #32, spec #30): Chờ duyệt tab, photo upload read by a free OpenRouter model, warnings, Lưu / Duyệt / Bỏ; `./init.sh` green (395 unit, 94 Playwright); two-axis code review with no blocking findings; migration 0002 applied to production; `OPENROUTER_API_KEY` set
- [x] feat-018 Next.js 16.4.0 → 16.4.5 (PR #33): clears the security advisory that stopped `next build` every other run
- [x] feat-019 Ảnh thực đơn live (PR #37, spec #36); migration 0003 applied to production
- [x] feat-017 Tác nhân thu thập live (PR #38, spec #31): migration 0004 applied to production, `CRON_SECRET` set and production redeployed. First Chạy ngay on 2026-11-09: 10 pages read, 3 dishes added to Chờ duyệt, status partial (vnexpress source error, one reader error)
- [x] feat-020 built (spec #41, branch `feat/admin-nav-import`): admin sidebar / phone drawer, Tổng quan at `/admin` (list now at `/admin/dishes`), Thêm món page, agent on `/admin/agent`, Nhập từ file (JSON, preview, template, migration 0005 `file` source kind), bulk Duyệt; `./init.sh` green; awaiting merge and the production migration
- [x] feat-020 merged (PR #42, `dde5951`); migration 0005 applied to production and verified
- [x] feat-021 built (`feat/add-tabs`): Nhập từ file left the admin menu and is a tab of Thêm món (`/admin/add?cach=file`, Back works); "Tự nhập công thức" is a separate button; `/admin/import` redirects; "Cách viết file" folded; `./init.sh` green (offline flake passed on re-run)
- [x] Harness added in PR #12 (this file, `CLAUDE.md`, `feature_list.json`, `session-handoff.md`, `init.sh`); `./init.sh` ran green

### What's In Progress

- [ ] Known choices (feat-017): page text is extracted with a small regex-based domain function (no HTML library); the pre-skip uses the URL slug, not the page title; the run lock is a column on the settings row; history keeps 30 runs (spec said "for example 14"); a Chạy ngay waits for the whole run (up to ~4 min)

### What's Next

0. Owner reviews and merges the feat-020 PR; then run migration `0005_file_source_kind` on production (ask first). Until it runs, Nhập từ file fails on production with a CHECK violation (the rest of the admin works)
1. Owner checks Ảnh thực đơn on a phone and raises enhancements
2. Watch the first nightly run (22:00 UTC) in Lần chạy gần nhất; it proves `CRON_SECRET` reaches the cron route
3. Prove the single-statement saves are fine on the real Neon driver beyond the first edit (they worked for one real save); nothing further needed unless something fails
4. Owner picks a custom domain (see `docs/phase-1.md` for the data-reset caveat when the address changes)
5. Later: run `/grill-with-docs` for the owner's next idea (candidates: sort and preview toggle on /admin, which were deferred)
6. **Low priority: push notifications (spec C)** (owner, 2026-11-10). Parked after the first grill: one mass notification to all users, sent by cron or by hand. Not specced; grill the rest first
7. **Low priority: Langfuse integration** (owner, 2026-11-09). Not grilled yet: run `/grill-with-docs` first. Likely scope: trace each OpenRouter call (Ảnh thực đơn, photo upload, Tác nhân thu thập) with model, latency, tokens and outcome, so free-model quality and failures are visible. Open questions: which calls, prompt/page text sent or redacted (no personal data reaches the server anyway), Langfuse Cloud vs self-hosted, keys as Vercel env

## Blockers / Risks

- [ ] Admin sign-in lock key is the first X-Forwarded-For address; on Vercel the platform sets it. Off Vercel a client could choose its own key, and a missing header shares one bucket
- [ ] The admin redirect to sign-in happens in the browser after a session check (the page shell is static), not as a server redirect; nothing private is in the shell
- [ ] One-off: the admin accessibility check "edit form after a failed submit (light)" failed once during a full `./init.sh` right after a build and then passed 10/10 reruns; if it recurs, capture the violation text
- [ ] The offline Playwright journey (`works offline once opened`) is flaky in CI (failed twice on one run, passed on re-run): re-run before suspecting the change

- [ ] Code review follow-ups on feat-016 (judgement calls, not blocking): the chay/tỏi warning also checks the name while the Duyệt rule checks only ingredients/steps; an exact-name duplicate is refused on Duyệt (add-dish rule), only near matches can be approved; warnings refresh on load/Lưu, not while editing; enum lists repeated in `pending-dish.ts`; `dish-form-screen.tsx` has many review-mode branches
- [ ] Tác nhân thu thập: vnexpress gives a `source` error from Vercel although robots.txt and the listing answer 200 with the agent's User-Agent from a home connection (possibly a datacenter-IP block or a timeout); the run entry does not record the HTTP status, so add it before digging further
- [ ] One of the first three agent dishes was read by the `openrouter/free` fallback, which routed to a 1.7B model (`liquid/lfm-3-1.7b:free`; no Nhóm món set). Check its quality in Chờ duyệt; consider dropping the generic fallback for page reading
- [ ] feat-020 judgement calls: parser field gaps show in review as "missing" warnings derived from the dish as it is now (only for file dishes; an unrecognised value becomes a missing one); Nhập từ file accepts a few more yes/no and meal-type words and "1 giờ 30 phút" times than the spec listed; a file name is kept in `source_url` (Duyệt/Bỏ now mark seen pages only for agent rows); server error messages stay English like the rest of the admin API
- [ ] Free OpenRouter models change often and are capped (about 50 calls a day without credit); a model id can disappear. Change `OPENROUTER_MODELS` or the default list in `openrouter-reader.ts`

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
