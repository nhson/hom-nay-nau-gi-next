# Session Handoff

## Current Objective

- Goal: feat-021, a small tweak with no spec issue (grilled 2026-11-10). Nhập từ file moves from the admin menu onto Thêm món as a tab.
- Current status: built and verified on `feat/add-tabs`. It is committed locally. It is not pushed and there is no PR yet.
- Branch: `feat/add-tabs`

## Completed This Session

- [x] feat-020 merged (PR #42). Migration `0005_file_source_kind` is applied on production and verified.
- [x] Thêm món has two tabs, "Ảnh thực đơn / Gõ tên" (default) and "Nhập từ file". The chosen tab is in the address (`?cach=file`), so Back works. "Tự nhập công thức" is a separate button with "Đăng ngay, không qua Chờ duyệt.", and each panel starts with one line saying where its dishes go.
- [x] `ImportScreen` became `ImportPanel` (`import-panel.tsx`). Its "Cách viết file" guide is folded in a `<details>`.
- [x] `/admin/import` redirects to `/admin/add?cach=file`. The menu item is gone, and the empty state on Chờ duyệt links to the tab.
- [x] Docs: `CONTEXT.md` (Nhập từ file), `docs/features.md` A21, A23 and A24.

## Verification Evidence

| Check | Command | Result | Notes |
|---|---|---|---|
| Full gate | `./init.sh` | green | 533 unit/contract tests; Playwright 118 passed. The known flake `journeys.spec.ts:244` passed when re-run alone. |
| Tabs + redirect | `e2e/admin-nav.spec.ts` | passed | aria-current, `?cach=file`, goBack, redirect, folded guide, axe |
| Visual | screenshots | ok | phone light, desktop dark |

## Blockers / Owner actions

- Push feat-021 and open a PR when the owner says so. Merge only on request.
- PR #40 (docs: spec C low priority) is still open.
- Watch the first nightly agent cron run (22:00 UTC) to confirm `CRON_SECRET` works.
- The owner should review the 3 agent dishes in Chờ duyệt.

## Next Session Startup

1. Read `CLAUDE.md`, then `progress.md` and `feature_list.json`, then this handoff.
2. Run `gh pr list` and `git status`.
3. Run `./init.sh` before editing.

## Recommended Next Step

- feat-021 is merged (PR #43). Next: the owner's next idea. Possible follow-ups: record the HTTP status in agent source errors, and drop the openrouter/free fallback. Push notifications (spec C) and Langfuse integration are low priority (progress.md, What's Next 6 and 7).
