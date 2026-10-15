# Feature list and status

Everything the legacy app did (F-numbers), plus what the rebuild added (N-numbers), with where each
stands today. Evidence per item is in [parity-checklist.md](parity-checklist.md). The scope and 77
user stories are in issue #1.

**Status key:** ✅ done and verified · 🟡 done with a caveat · ⏸ deferred by decision (not in v1) · ⛔ not built

## Thực đơn hôm nay

| ID | Feature | Status |
|---|---|---|
| F1 | Random Bữa cơm 3 món (one dish per Nhóm món, avoids the last 4 days) | ✅ |
| F2 | Reroll one slot; fixed order Xào → Canh → Món mặn | ✅ |
| F3 | Bữa 1 món (phở, bún, nui…) via its own button, never from Random | ✅ |
| F4 | Món chay filter for both meal types; names the group with no Chay dish | ✅ |
| F5 | "Đã nấu hôm nay" → history (keeps 60, shows 7, 🍜 for Bữa 1 món) | ✅ |
| — | New day regenerates the menu on open (deliberate change from legacy) | ✅ |

## Nấu và đi chợ

| ID | Feature | Status |
|---|---|---|
| F6 | Step-by-step recipe | ✅ |
| F7 | Shopping list: merged duplicates, tick-off, remembered across reloads and offline | ✅ |
| F8 | Chay and Vùng miền badges (region is display only) | ✅ |

## Món ăn (dish bank)

| ID | Feature | Status |
|---|---|---|
| F9 | Dish library: search, filter and read any dish's recipe. **Add / edit / delete / reset / restore were removed on purpose** (ADR-0003); an admin page comes in a later phase | ✅ changed |
| F10 | Filter by Nhóm món / Bữa 1 món / Chay | ✅ |
| F11 | 73 seed dishes (Xào 20, Canh 23, Mặn 21, Bữa 1 món 9; 27 chay, no tỏi) | ✅ stored in Neon, bundled as offline fallback |
| F12 | Catalog updates reach every device | ✅ versioned + ETag; devices hold no dish edits any more, so a correction always shows |

## Yêu thích

| ID | Feature | Status |
|---|---|---|
| F13 | Save a named favorite menu | ✅ |
| F14 | Reuse a favorite | ✅ |
| F15 | Delete a favorite | ✅ |

## Hộ gia đình (Household)

| ID | Feature | Status |
|---|---|---|
| F16 | Create / leave a household, shared `/h/<code>` link | ⏸ |
| F17 | Sync once on open, debounced write | ⏸ |
| F18 | Sync status | ⏸ |
| F19 | Copy link | ⏸ |
| F20 | Read/write API with code check and size limit | ⏸ |

Deferred together by decision (the legacy UI was already hidden); see ADR-0001.

## Nền tảng

| ID | Feature | Status |
|---|---|---|
| F21 | Dark / light follows the system | ✅ |
| F22 | Mobile-first (~400px), centered column on larger screens | ✅ |
| F23 | Fraunces + Be Vietnam Pro fonts | ✅ |
| F24 | Toasts | ✅ |
| F25 | Analytics: 12 events with the legacy names and properties | 🟡 sent correctly; **custom events are not visible on the Vercel Hobby plan** (page views are). Owner chose to stay on Hobby |
| F26 | CI/CD on Vercel + GitHub | ✅ CI (lint, typecheck, unit + contract, build, Playwright); preview per PR; `main` deploys to production |
| F27 | Automated tests (legacy had 32) | ✅ 200+ unit/contract tests, 16 Playwright journeys, axe accessibility scans |
| F28 | Weekly menu planner (Phase 3) | ⏸ paused before the rebuild |

## Added in the rebuild

| ID | Feature | Status |
|---|---|---|
| N1 | Installable PWA, works offline | ✅ offline covered by Playwright; install confirmed on a real phone |
| N2 | Structured data on Postgres | ✅ Neon via the Vercel Marketplace; Drizzle migrations |
| N3 | Typed, validated, versioned API | 🟡 Zod schemas on both sides, typed errors, ETag + catalog version. ⛔ **No rate limiting** (read-only, CDN-cached endpoint) |
| N4 | Official Household feature | ⏸ |
| N5 | Import the legacy `localStorage` data | ⏸ |
| N6 | Seed lives in the database (fix a dish without redeploying) | ✅ `pnpm db:seed` |
| N7 | Server-side tracking of the north-star metric | ⏸ |
| N8 | Tests: unit + API contract + E2E on a phone viewport | ✅ |
| N9 | Weekly planner | ⏸ |
| N10 | i18n vi/en | ⏸ |

## Infrastructure and operations

| Item | Status |
|---|---|
| Production: https://hom-nay-nau-gi-next.vercel.app | ✅ live, `/api/v1/health` reports `ok` |
| Neon Postgres connected, migrated and seeded (73 dishes, catalog version 1) | ✅ |
| Preview deployment per pull request | ✅ (protected: team login required) |
| Production deploy on merge to `main` | ✅ verified |
| Web Analytics enabled, page views | ✅ |
| Branch protection requiring CI before merge | ⛔ not set; Vercel deploys in parallel with CI |
| Legacy app (hom-nay-nau-gi.vercel.app) | Live and unchanged until the owner retires it |
