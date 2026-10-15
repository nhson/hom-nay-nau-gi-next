#!/bin/bash
set -e

echo "=== Harness Initialization ==="

echo "=== install dependencies (frozen lockfile) ==="
corepack pnpm install --frozen-lockfile

echo "=== corepack pnpm lint ==="
corepack pnpm lint

echo "=== corepack pnpm typecheck ==="
corepack pnpm typecheck

echo "=== corepack pnpm test ==="
corepack pnpm test

echo "=== corepack pnpm build ==="
corepack pnpm build

# Playwright serves the production build made just above; Chromium is installed once with:
#   corepack pnpm exec playwright install chromium
echo "=== corepack pnpm test:e2e ==="
corepack pnpm test:e2e

echo "=== Verification Complete ==="
echo ""
echo "Next steps:"
echo "1. Read feature_list.json to see current feature state"
echo "2. Pick ONE unfinished feature to work on"
echo "3. Implement only that feature"
echo "4. Re-run verification before claiming done"
