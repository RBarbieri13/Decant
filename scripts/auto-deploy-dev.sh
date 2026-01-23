#!/bin/bash
# Auto-build and run desktop app for development preview
# This script builds the app, runs verification, and starts it

set -e
cd "$(dirname "$0")/.."

echo "======================================"
echo "  Decant Auto-Deploy Development"
echo "======================================"
echo ""

# Step 1: Build desktop app
echo "[1/4] Building desktop app..."
pnpm desktop:build
echo "Build complete!"
echo ""

# Step 2: Run UI verification
echo "[2/4] Running UI verification tests..."
cd apps/desktop
if pnpm verify 2>&1; then
    echo "Verification passed!"
else
    echo ""
    echo "Warning: Verification tests failed or were skipped"
    echo "Check apps/desktop/test-output/ for details"
fi
cd ../..
echo ""

# Step 3: Show screenshots
echo "[3/4] Verification screenshots saved to:"
echo "  apps/desktop/test-output/verification-screenshots/"
if [[ -d "apps/desktop/test-output/verification-screenshots" ]]; then
    ls -la apps/desktop/test-output/verification-screenshots/ 2>/dev/null || true
fi
echo ""

# Step 4: Start desktop app
echo "[4/4] Starting desktop app in production mode..."
echo ""
pnpm desktop:start-prod
