#!/bin/bash

# AI Import Service Examples
# Usage: bash ai_import_examples.sh
#
# Prerequisites:
# 1. Trilium server running on localhost:8080
# 2. Authenticated session (login via web UI first)
# 3. jq installed for JSON formatting (optional)

BASE_URL="http://localhost:8080"

echo "=== AI Import Service Examples ==="
echo ""

# Check if jq is available for pretty printing
if command -v jq &> /dev/null; then
    JQ="jq ."
else
    JQ="cat"
    echo "Note: Install 'jq' for prettier JSON output"
    echo ""
fi

# Example 1: Check Service Status
echo "1. Checking AI Import service status..."
echo "   GET $BASE_URL/api/ai-import/status"
echo ""
curl -s "$BASE_URL/api/ai-import/status" | $JQ
echo ""
echo "---"
echo ""

# Example 2: Basic Import with AI Categorization
echo "2. Import GitHub repository (AI categorization)..."
echo "   POST $BASE_URL/api/ai-import"
echo "   Body: { url: 'https://github.com/trilium-next/notes' }"
echo ""
curl -s -X POST "$BASE_URL/api/ai-import" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://github.com/trilium-next/notes"
  }' | $JQ
echo ""
echo "---"
echo ""

# Example 3: Import with Custom Title
echo "3. Import article with custom title..."
echo "   POST $BASE_URL/api/ai-import"
echo "   Body: { url: '...', options: { title: 'Custom Title' } }"
echo ""
curl -s -X POST "$BASE_URL/api/ai-import" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://dev.to/example-article",
    "options": {
      "title": "My Saved Article on Development"
    }
  }' | $JQ
echo ""
echo "---"
echo ""

# Example 4: Import to Specific Location (Skip AI)
echo "4. Import to specific Space/Collection (skip AI)..."
echo "   Note: Replace 'YOUR_SPACE_ID' and 'YOUR_COLLECTION_ID' with actual IDs"
echo "   POST $BASE_URL/api/ai-import"
echo ""
# This will fail without valid IDs, but shows the structure
curl -s -X POST "$BASE_URL/api/ai-import" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com/article",
    "options": {
      "spaceId": "YOUR_SPACE_ID",
      "collectionId": "YOUR_COLLECTION_ID",
      "skipCategorization": true
    }
  }' | $JQ
echo ""
echo "---"
echo ""

# Example 5: Various Content Types
echo "5. Testing different content types..."
echo ""

echo "   a) YouTube video:"
curl -s -X POST "$BASE_URL/api/ai-import" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"}' | $JQ
echo ""

echo "   b) ArXiv paper:"
curl -s -X POST "$BASE_URL/api/ai-import" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://arxiv.org/abs/1706.03762"}' | $JQ
echo ""

echo "   c) Twitter/X post:"
curl -s -X POST "$BASE_URL/api/ai-import" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://twitter.com/example/status/123456789"}' | $JQ
echo ""

echo "---"
echo ""

# Example 6: Error Handling
echo "6. Testing error handling..."
echo ""

echo "   a) Invalid URL:"
curl -s -X POST "$BASE_URL/api/ai-import" \
  -H "Content-Type: application/json" \
  -d '{"url": "not-a-valid-url"}' | $JQ
echo ""

echo "   b) Missing URL:"
curl -s -X POST "$BASE_URL/api/ai-import" \
  -H "Content-Type: application/json" \
  -d '{}' | $JQ
echo ""

echo "---"
echo ""

echo "=== Examples Complete ==="
echo ""
echo "To use in your application:"
echo ""
echo "JavaScript/TypeScript:"
echo "  const response = await fetch('$BASE_URL/api/ai-import', {"
echo "    method: 'POST',"
echo "    headers: { 'Content-Type': 'application/json' },"
echo "    body: JSON.stringify({ url: 'https://example.com' })"
echo "  });"
echo "  const result = await response.json();"
echo ""
echo "Python:"
echo "  import requests"
echo "  response = requests.post("
echo "    '$BASE_URL/api/ai-import',"
echo "    json={'url': 'https://example.com'}"
echo "  )"
echo "  result = response.json()"
echo ""
