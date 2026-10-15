# Phase 1: rebuild of "Hôm nay nấu gì?" (complete)

**Outcome:** the family meal planner was rebuilt as an installable, offline-capable web app on a
modern stack, with full parity for the features that were in scope, and is live in production at
https://hom-nay-nau-gi-next.vercel.app. The legacy app (hom-nay-nau-gi.vercel.app) is untouched
and still live until the owner retires it.

Spec and 77 user stories: issue #1. Feature-by-feature status: [features.md](features.md).
Evidence per feature: [parity-checklist.md](parity-checklist.md).

## What was delivered

| Slice | Delivered | PR |
|---|---|---|
| 1 | New repo, CI, pure domain core (primary test seam) with ported tests | #2 |
| 2 | Seed source (73 dishes), Postgres schema + migrations, read-only catalog API with contract tests | #3 |
| 3 | Responsive shell, on-device store (IndexedDB), the Hôm nay screen | #4 |
| 4 | Dish bank (add / edit / delete / reset / restore; later made read-only, ADR-0003) and favorites | #5 |
| 5 | Installable PWA, offline, update prompt | #6 |
| 6 | Analytics events, accessibility checks, Playwright journeys, parity checklist | #7 |
| — | Production setup, deployment notes, README | #8, #9 |
| — | Food/recipe UI refresh, dish search, recipe view | #11 |

## Stack

Next.js 16 (App Router, TypeScript) · Tailwind + shadcn/ui · Route Handlers + Zod · Neon Postgres +
Drizzle · Serwist service worker · Vitest (212 unit and API-contract tests) · Playwright (18 phone
journeys, incl. axe accessibility scans) · Vercel (hosting, previews, Web Analytics) · pnpm, Node 24.

## Decisions worth remembering

- **Personal data stays on the device.** History, favorites, today's menu, ticks and the Chay setting
  live in IndexedDB (before ADR-0003 this also included custom and edited dishes). The server only publishes the shared catalog; nothing personal is
  uploaded. Device data and the installed app are tied to the web address.
- **Merge by dish id.** The user's edits override the catalog; a dish retired on the server stops
  being picked but still resolves in old history and favorites. *(After Phase 1, ADR-0003 made the
  catalog read-only on devices: add/edit/delete were removed, so there are no device edits to merge.)*
- **The domain core is the main test seam.** Pure TypeScript with injected random/clock/ids, no React,
  Next.js, database or browser imports (enforced by lint). The second seam is the catalog API contract
  (real handlers, real migrations on PGlite). Playwright is verification only.
- **Catalog:** versioned, ETag/304, cached on-device, bundled seed as the first-run and offline
  fallback, refresh failures are silent.
- **Deliberate change from the legacy app:** a new local day regenerates the menu on open.
- **Analytics:** the 12 legacy event names and properties are preserved. `view_recipe` never carries
  the name of a dish the user wrote.
- **Out of scope for v1, by decision:** Household (F16–F20), weekly planner, importing old
  `localStorage` data, i18n (see [features.md](features.md)).

## State of the platform

- Production on Vercel, deploys from `main`; a preview per pull request.
- Neon Postgres connected through the Vercel Marketplace, migrated, seeded (catalog version 1, 73 dishes).
- CI on every PR: lint, typecheck, unit + contract tests, build, Playwright.
- Installed and working on a real phone (owner-confirmed).

## Known limitations going into Phase 2

- Custom analytics events are not visible on the Vercel **Hobby** plan (page views are). The owner
  chose to stay on Hobby, so the north-star metric (`mark_cooked` per week) can't be read from the
  dashboard.
- The API has **no rate limiting** (read-only, CDN-cached).
- **No branch protection:** Vercel deploys in parallel with CI, so a failing CI check does not stop a
  production deploy.
- **No dish photos** (no licensed images for the 73 dishes); category icons stand in.
- **No data export/import**, and personal data does not follow the user across devices or a change of
  domain.
- The app still lives on the `*.vercel.app` address; a custom domain is not chosen yet.
- Stray, uncommitted files remain in the old repository (`.gitignore` edit, `.agents/`,
  `skills-lock.json`); they were left alone on purpose.

## Candidates for Phase 2

Not decided: these are the deferred or open items, to pick from when Phase 2 is scoped.

- Custom domain and a friendlier public name (switching address resets on-device data: consider export/import first).
- Household / sharing across family devices (F16–F20, N4) and importing legacy data (N5).
- Measuring the north-star metric (N7): upgrade analytics, or count events ourselves anonymously.
- Weekly menu planner (F28, N9) and i18n (N10).
- Dish photos or a better visual identity per dish.
- Operational hardening: branch protection, rate limiting, error monitoring.
