# Parity checklist (F1–F15, F21–F27)

Sign-off list for retiring the legacy app. "Verified" names the automated check; "Manual" items
need a human on a real device once the app is deployed. F16–F20 (Household), F28 (weekly plan) and
the N4/N5/N7–N10 extras are deliberately out of scope for v1 (see issue #1).

Legend: **E2E** = Playwright journey in `e2e/`, **Unit** = Vitest in `src/`.

| ID | Feature | Status | Verified by |
|---|---|---|---|
| F1 | Random Bữa cơm 3 món, one per Nhóm món, avoids the last 4 days | Done | Unit `menu`, `selection`, `actions`; E2E "random, reroll and mark cooked" |
| F2 | Reroll one slot, fixed order Xào → Canh → Món mặn | Done | Unit `menu`, `actions`, `selectors`; E2E "first open…", "random, reroll…" |
| F3 | Bữa 1 món via its own button, never from Random | Done | Unit `actions`; E2E "Nấu 1 món switches…" |
| F4 | Món chay for both meal types, names the missing group | Done | Unit `actions`, `notices`; E2E "Món chay regenerates…" |
| F5 | "Đã nấu hôm nay" → history (cap 60, show 7, 🍜 marker) | Done | Unit `history`; E2E "random, reroll and mark cooked…" |
| F6 | Step-by-step recipe | Done | E2E "works offline…" (opens a recipe offline) |
| F7 | Shopping list merged, tickable, remembered | Done | Unit `shopping`, `selectors`; E2E "works offline…" (tick survives reload) |
| F8 | Chay and Vùng miền badges (region display only) | Done | Manual look; badges are plain rendering of `dish.chay` / `dish.region` |
| F9 | Add / edit / delete dishes (+ reset, restore) | Done | Unit `catalog`, `form`, `actions`; E2E "add, edit, delete, reset and restore dishes" |
| F10 | Filter by group / Bữa 1 món / Chay | Done | Unit `selectors`; E2E "the dish bank filters…" |
| F11 | 73 seed dishes (20/23/21/9, 27 chay, no tỏi in chay) | Done | Unit `seed/dishes.test`; E2E dish counts |
| F12 | Catalog updates without overwriting the user's edits | Done | Contract tests (versioning, ETag, retired); Unit `catalog`; E2E "a catalog correction…" |
| F13 | Save a named favorite | Done | E2E "save a favorite and use it again" |
| F14 | Reuse a favorite | Done | same |
| F15 | Delete a favorite | Done | same |
| F21 | Dark / light follows the system | Done | E2E a11y scans in both schemes |
| F22 | Mobile-first (~400px) | Done | All E2E run on a Pixel 7 viewport; centered column on larger screens |
| F23 | Fraunces + Be Vietnam Pro | Done | `next/font` with the Vietnamese subset; Manual check of diacritics |
| F24 | Toasts | Done | E2E asserts "Đã lưu món ăn!" |
| F25 | Analytics events (names + properties unchanged) | Done in code | Unit `analytics`; production sends page view + events (HTTP 200). 12 of the legacy 14 events: `create_household` / `leave_household` belong to deferred F16–F20. **Custom events are not shown on the Vercel Hobby plan** (owner decision: stay on Hobby) |
| F26 | CI/CD on Vercel + GitHub | Done | CI runs lint, typecheck, unit + contract, build and Playwright; Vercel builds a preview per PR and deploys `main` to production (verified) |
| F27 | Automated tests (legacy had 32) | Done | 200+ unit/contract tests, 16 Playwright tests |

## New in v1 (beyond parity)

| ID | Feature | Status | Verified by |
|---|---|---|---|
| N1 | Installable PWA, works offline | Done | E2E "works offline…"; update flow checked manually. Installed and working on a real phone (owner-confirmed) |
| N2/N3/N6 | Postgres catalog, typed API, seed in DB | Done | Contract tests on real migrations; production `/api/v1/health` ok, catalog v1 with 73 dishes. No rate limiting (see [features.md](features.md)) |

## Remaining before retiring the old app

1. Use the new app for a few days alongside the old one.
2. Decide the domain cutover; then update product principle #3 ("no framework, no build step") in the old repo's `pm/context/product.md`.
3. Optional: protect `main` so CI must pass before merge; revisit analytics visibility if the north-star metric (`mark_cooked` per week) matters (needs Vercel Pro or our own event counting).

Done: Vercel project linked to GitHub, Neon provisioned/migrated/seeded, Web Analytics enabled, install on a real phone.

## Notes on deliberate differences

- A new local day regenerates the menu on open (the legacy app kept showing yesterday's).
- `view_recipe` reports the dish name only for catalog dishes; a dish the user wrote is reported as "(món tự thêm)" so personal content never leaves the device.
- Custom dish ids are `custom:<uuid>`; catalog ids are unchanged from the legacy seed.
