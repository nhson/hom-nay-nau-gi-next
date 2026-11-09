# Session Handoff

## Current Objective

- Goal: feat-017 (spec #31), Tác nhân thu thập: a daily run (and Chạy ngay) reads unseen recipe pages from the Nguồn công thức, asks the free OpenRouter models, and adds the dishes that fill catalog gaps as Món chờ duyệt.
- Current status: built and verified on `feat/daily-agent` (./init.sh green; code review run and fixed). PR not merged.
- Branch: `feat/daily-agent`

## Completed This Session

- [x] Domain `src/domain/collector.ts`: robots.txt, sitemap/listing links, candidate choice (seen pages, retries, exact-name pre-skip, sources interleaved), gap ranking, run gate, settings bounds, run status and grouped reasons, page text, the read-page instructions
- [x] Server `src/server/agent/`: runner (lock, per-site delay, 3 pages at a time, 240 s deadline, stops on the free limit), real fetcher (UA, 15 s, 2 MB), repository; migration `0004_collector` (seen sources, settings + lock, runs pruned to 30); Duyệt/Bỏ mark the page approved/discarded in the same statement
- [x] Routes: `GET /api/v1/cron/collect` (Bearer `CRON_SECRET`), `GET|POST /api/v1/admin/agent/runs`, `GET|PUT /api/v1/admin/agent/settings`; `vercel.json` cron `0 22 * * *`
- [x] UI on Chờ duyệt: Tác nhân thu thập card (Chạy ngay, Lần chạy gần nhất, Các lần chạy trước, Cài đặt tác nhân), site name on agent items, "Xem trang gốc" link in the review form

## Verification Evidence

| Check | Command | Result | Notes |
|---|---|---|---|
| Full gate | `./init.sh` | green | lint, typecheck, unit/contract, build, Playwright |
| Agent contract | `corepack pnpm vitest run src/server/agent` | 26 passed | fake web + fake model + kit clock |
| Browser + a11y | `e2e/review.spec.ts` | passed | Chạy ngay journey, settings, axe light/dark |

## Blockers / Owner actions

- Production migration `0004_collector` after merge (ask first)
- `CRON_SECRET` must be added in Vercel by the owner; without it the cron route answers 401 to everyone (Chạy ngay still works)
- The free models have not read a real monngonmoingay/vnexpress page yet: try Chạy ngay on the preview

## Next Session Startup

1. Read `CLAUDE.md`, then `progress.md` and `feature_list.json`, then this handoff.
2. `gh pr list` and `git status`.
3. Run `./init.sh` before editing.

## Recommended Next Step

- Merge the feat-017 PR when the owner says so, migrate, add `CRON_SECRET`, Chạy ngay once. Then grill spec C (push notifications).
