#!/bin/bash
# Verification script for structured logging implementation

echo "=================================================="
echo "Decant Structured Logging Verification"
echo "=================================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
  echo -e "${RED}Error: Must be run from decant-standalone directory${NC}"
  exit 1
fi

echo "1. Checking dependencies..."
echo ""

# Check pino dependencies
if grep -q '"pino"' package.json; then
  echo -e "${GREEN}✓${NC} pino dependency found"
else
  echo -e "${RED}✗${NC} pino dependency missing"
fi

if grep -q '"pino-http"' package.json; then
  echo -e "${GREEN}✓${NC} pino-http dependency found"
else
  echo -e "${RED}✗${NC} pino-http dependency missing"
fi

if grep -q '"pino-pretty"' package.json; then
  echo -e "${GREEN}✓${NC} pino-pretty dependency found"
else
  echo -e "${RED}✗${NC} pino-pretty dependency missing"
fi

echo ""
echo "2. Checking logger implementation..."
echo ""

# Check logger files exist
if [ -f "src/backend/logger/index.ts" ]; then
  echo -e "${GREEN}✓${NC} Logger configuration found"
else
  echo -e "${RED}✗${NC} Logger configuration missing"
fi

if [ -f "src/backend/middleware/requestLogger.ts" ]; then
  echo -e "${GREEN}✓${NC} Request logger middleware found"
else
  echo -e "${RED}✗${NC} Request logger middleware missing"
fi

echo ""
echo "3. Checking for console.log usage in backend..."
echo ""

# Search for console usage in backend (excluding acceptable files)
CONSOLE_USAGE=$(grep -r "console\." src/backend \
  --include="*.ts" \
  --exclude-dir="__tests__" \
  --exclude="*test*.ts" \
  --exclude="*spec*.ts" \
  --exclude="cli.ts" \
  2>/dev/null || true)

if [ -z "$CONSOLE_USAGE" ]; then
  echo -e "${GREEN}✓${NC} No console.log usage in backend code (excluding tests and CLI)"
else
  echo -e "${YELLOW}⚠${NC} Found console usage in backend:"
  echo "$CONSOLE_USAGE"
fi

echo ""
echo "4. Checking logger imports..."
echo ""

# Check that key files import the logger
FILES_TO_CHECK=(
  "src/server.ts"
  "src/backend/routes/import.ts"
  "src/backend/database/connection.ts"
  "src/backend/database/schema.ts"
  "src/backend/database/migrations/runner.ts"
  "src/backend/services/backup.ts"
)

for file in "${FILES_TO_CHECK[@]}"; do
  if [ -f "$file" ]; then
    if grep -q "from.*logger" "$file"; then
      echo -e "${GREEN}✓${NC} $file imports logger"
    else
      echo -e "${YELLOW}⚠${NC} $file doesn't import logger"
    fi
  else
    echo -e "${RED}✗${NC} $file not found"
  fi
done

echo ""
echo "5. Checking environment support..."
echo ""

# Check logger for environment variable support
if grep -q "LOG_LEVEL" src/backend/logger/index.ts; then
  echo -e "${GREEN}✓${NC} LOG_LEVEL environment variable supported"
else
  echo -e "${RED}✗${NC} LOG_LEVEL not supported"
fi

if grep -q "LOG_FORMAT" src/backend/logger/index.ts; then
  echo -e "${GREEN}✓${NC} LOG_FORMAT environment variable supported"
else
  echo -e "${RED}✗${NC} LOG_FORMAT not supported"
fi

echo ""
echo "6. Checking request logging integration..."
echo ""

if grep -q "httpLogger" src/server.ts; then
  echo -e "${GREEN}✓${NC} Request logging middleware integrated in server"
else
  echo -e "${RED}✗${NC} Request logging middleware not integrated"
fi

if grep -q "randomUUID" src/backend/middleware/requestLogger.ts; then
  echo -e "${GREEN}✓${NC} Request ID generation implemented"
else
  echo -e "${RED}✗${NC} Request ID generation missing"
fi

echo ""
echo "7. Checking documentation..."
echo ""

if [ -f "STRUCTURED_LOGGING_IMPLEMENTATION.md" ]; then
  echo -e "${GREEN}✓${NC} Implementation documentation found"
else
  echo -e "${YELLOW}⚠${NC} Implementation documentation missing"
fi

if [ -f "docs/LOGGING_GUIDE.md" ]; then
  echo -e "${GREEN}✓${NC} Developer logging guide found"
else
  echo -e "${YELLOW}⚠${NC} Developer logging guide missing"
fi

echo ""
echo "=================================================="
echo "Verification Complete"
echo "=================================================="
echo ""
echo "To test logging in different modes:"
echo ""
echo "  Development (pretty output):"
echo "    ${YELLOW}NODE_ENV=development LOG_LEVEL=debug pnpm run dev:server${NC}"
echo ""
echo "  Production (JSON output):"
echo "    ${YELLOW}NODE_ENV=production LOG_LEVEL=info pnpm run start${NC}"
echo ""
echo "  Custom configuration:"
echo "    ${YELLOW}LOG_LEVEL=debug LOG_FORMAT=json pnpm run dev:server${NC}"
echo ""
