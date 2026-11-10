# Session Handoff

## Current Objective

- Goal: feat-020 (spec #41): admin menu (sidebar / phone drawer), Tổng quan home, Thêm món page, agent page, Nhập từ file (JSON) and bulk Duyệt.
- Current status: built and verified on `feat/admin-nav-import` (./init.sh green; two-axis code review run and fixed). PR open, not merged.
- Branch: `feat/admin-nav-import`

## Completed This Session

- [x] Domain `src/domain/dish-file.ts`: `readDishFile` (Xuất JSON shape or bare list, codes or Vietnamese words, chay yes/no, lines as list or text, skips: no name / duplicate / repeated in file, warnings: missing / unrecognised / name cut / chay-tỏi / possible duplicate, 200-dish limit), `dishFileTemplate`; `catalogCounts` in `catalog.ts`; file dishes get "missing" review warnings in `pendingWarnings`
- [x] Server: `POST /api/v1/admin/pending/import` (one-statement insert, 413 over 1 MB, refusal codes), `POST /api/v1/admin/pending/approve` (each through the single-approve path); migration `0005_file_source_kind`
- [x] UI: `AdminFrame` sidebar + Radix drawer; `/admin` Tổng quan, `/admin/dishes`, `/admin/add`, `/admin/import`, `/admin/agent`; Chờ duyệt checkboxes, Chọn tất cả, summary
- [x] Docs: CONTEXT.md (Nhập từ file, Tổng quan, Món chờ duyệt widened), docs/features.md A21–A25

## Verification Evidence

| Check | Command | Result | Notes |
|---|---|---|---|
| Full gate | `./init.sh` | green | lint, typecheck, unit/contract, build, Playwright |
| Import + bulk contract | `corepack pnpm vitest run src/server/admin/import.contract.test.ts` | passed | PGlite, real migrations |
| Browser + a11y | `e2e/admin-nav.spec.ts` | passed | sidebar, drawer, journeys, axe light/dark |

## Blockers / Owner actions

- Production migration `0005_file_source_kind` after merge (ask first)
- PR #40 (docs: spec C low priority) still open

## Next Session Startup

1. Read `CLAUDE.md`, then `progress.md` and `feature_list.json`, then this handoff.
2. `gh pr list` and `git status`.
3. Run `./init.sh` before editing.

## Recommended Next Step

- Merge the feat-020 PR when the owner says so, then run migration 0005 on production with approval. Spec C and Langfuse remain low priority.
