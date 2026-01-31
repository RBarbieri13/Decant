#!/bin/bash

# ============================================================
# Setup Testing Dependencies for Decant Standalone
# ============================================================
#
# This script installs all necessary testing dependencies and
# configures the project for React component testing and E2E tests.
#
# Usage:
#   chmod +x scripts/setup-testing.sh
#   ./scripts/setup-testing.sh
#
# Or with options:
#   ./scripts/setup-testing.sh --skip-e2e    # Skip Playwright installation
#   ./scripts/setup-testing.sh --rtl-only    # Only install RTL, skip Playwright
# ============================================================

set -e

echo "🧪 Setting up testing dependencies for Decant Standalone..."
echo ""

# Parse arguments
SKIP_E2E=false
RTL_ONLY=false

for arg in "$@"; do
  case $arg in
    --skip-e2e)
      SKIP_E2E=true
      shift
      ;;
    --rtl-only)
      RTL_ONLY=true
      SKIP_E2E=true
      shift
      ;;
  esac
done

# Step 1: Install React Testing Library
echo "📦 Installing React Testing Library..."
pnpm add -D @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom

if [ $? -eq 0 ]; then
  echo "✅ React Testing Library installed successfully"
else
  echo "❌ Failed to install React Testing Library"
  exit 1
fi

echo ""

# Step 2: Install Playwright (unless skipped)
if [ "$SKIP_E2E" = false ]; then
  echo "🎭 Installing Playwright..."
  pnpm add -D @playwright/test

  if [ $? -eq 0 ]; then
    echo "✅ Playwright installed successfully"

    echo ""
    echo "🔧 Installing Playwright browsers..."
    pnpm exec playwright install

    if [ $? -eq 0 ]; then
      echo "✅ Playwright browsers installed successfully"
    else
      echo "⚠️  Failed to install Playwright browsers (you can run 'pnpm exec playwright install' later)"
    fi
  else
    echo "❌ Failed to install Playwright"
    exit 1
  fi
fi

echo ""

# Step 3: Update vitest config
echo "⚙️  Updating Vitest configuration..."

# Backup existing config
if [ -f vitest.config.ts ]; then
  cp vitest.config.ts vitest.config.ts.backup
  echo "📄 Backed up existing vitest.config.ts to vitest.config.ts.backup"
fi

# Copy the React-enabled config
if [ -f vitest.config.react.ts ]; then
  cp vitest.config.react.ts vitest.config.ts
  echo "✅ Updated vitest.config.ts with React support"
else
  echo "⚠️  vitest.config.react.ts not found - skipping config update"
fi

echo ""

# Step 4: Create Playwright config (if Playwright was installed)
if [ "$SKIP_E2E" = false ]; then
  if [ ! -f playwright.config.ts ]; then
    echo "⚙️  Creating Playwright configuration..."
    cat > playwright.config.ts << 'EOF'
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'pnpm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
EOF
    echo "✅ Created playwright.config.ts"
  else
    echo "ℹ️  playwright.config.ts already exists - skipping"
  fi
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✨ Testing setup complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📝 Next steps:"
echo ""
echo "1. Run all tests:"
echo "   pnpm test"
echo ""
echo "2. Run tests in watch mode:"
echo "   pnpm test --watch"
echo ""
echo "3. Generate coverage report:"
echo "   pnpm test:coverage"
echo ""

if [ "$SKIP_E2E" = false ]; then
  echo "4. Run E2E tests:"
  echo "   pnpm exec playwright test"
  echo ""
  echo "5. Run E2E tests in UI mode (interactive):"
  echo "   pnpm exec playwright test --ui"
  echo ""
fi

echo "📚 See TESTING.md for detailed documentation"
echo ""
echo "🎯 Available test files:"
echo "   • src/renderer/hooks/__tests__/useDragAndDrop.spec.ts"
echo "   • src/renderer/hooks/__tests__/usePolling.spec.ts"
echo "   • src/renderer/__tests__/ImportDialog.spec.tsx"
echo "   • src/renderer/__tests__/DetailPanel.spec.tsx"
if [ "$SKIP_E2E" = false ]; then
  echo "   • e2e/import-flow.spec.ts"
fi
echo ""
echo "✅ All done!"
