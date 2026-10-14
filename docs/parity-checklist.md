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
| F25 | Analytics events (names + properties unchanged) | Done | Unit `analytics`. 12 of the legacy 14 events: `create_household` / `leave_household` belong to deferred F16–F20 |
| F26 | CI/CD on Vercel + GitHub | Partly | CI runs lint, typecheck, unit + contract, build and Playwright. **Pending owner:** connect the repo to Vercel (preview + production from `main`) |
| F27 | Automated tests (legacy had 32) | Done | 200+ unit/contract tests, 16 Playwright tests |

## New in v1 (beyond parity)

| ID | Feature | Status | Verified by |
|---|---|---|---|
| N1 | Installable PWA, works offline | Done | E2E "works offline…"; update flow checked manually. **Manual:** install on a real Android and iOS device |
| N2/N3/N6 | Postgres catalog, typed API, seed in DB | Done in code | Contract tests on real migrations. **Pending owner:** provision Neon, then `pnpm db:migrate && pnpm db:seed` |

## Owner steps before sign-off

1. Link the repo to a Vercel project and connect GitHub (preview per PR, production from `main`).
2. `vercel integration add neon`, then `pnpm db:migrate && pnpm db:seed` against it; confirm `/api/v1/health` reports `ok`.
3. Enable Web Analytics on the new project and confirm events arrive (first five: `random_menu`, `reroll_dish`, `toggle_chay`, `mark_cooked`, `view_recipe`).
4. On a real phone: install to the home screen (Android and iOS), go offline, check Hôm nay, recipe, shopping list.
5. Use it for a few days alongside the old app; then decide the domain cutover and update product principle #3 in the old repo.

## Notes on deliberate differences

- A new local day regenerates the menu on open (the legacy app kept showing yesterday's).
- `view_recipe` reports the dish name only for catalog dishes; a dish the user wrote is reported as "(món tự thêm)" so personal content never leaves the device.
- Custom dish ids are `custom:<uuid>`; catalog ids are unchanged from the legacy seed.
