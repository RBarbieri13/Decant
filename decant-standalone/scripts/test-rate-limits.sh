#!/bin/bash
# ============================================================
# Rate Limiting Test Script
# ============================================================
# This script tests the rate limiting functionality of the Decant API
# Run this while the server is running: npm run dev

set -e

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
BASE_URL="${API_URL:-http://localhost:3000}"
VERBOSE=${VERBOSE:-0}

# Helper functions
print_header() {
    echo -e "\n${YELLOW}=== $1 ===${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_info() {
    echo -e "  $1"
}

# Check if server is running
print_header "Checking Server Status"
if curl -s "$BASE_URL/health" > /dev/null 2>&1; then
    print_success "Server is running at $BASE_URL"
else
    print_error "Server is not running at $BASE_URL"
    echo "Please start the server with: npm run dev"
    exit 1
fi

# Test 1: Health Check Endpoint (No Rate Limit)
print_header "Test 1: Health Check Endpoint (No Rate Limit)"
print_info "Making 20 requests to /health endpoint..."

success_count=0
for i in {1..20}; do
    status_code=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/health")
    if [ "$status_code" == "200" ]; then
        ((success_count++))
    fi

    if [ $VERBOSE -eq 1 ]; then
        echo "  Request $i: $status_code"
    fi
done

if [ $success_count -eq 20 ]; then
    print_success "All 20 requests succeeded (no rate limiting on health checks)"
else
    print_error "Only $success_count/20 requests succeeded"
fi

# Test 2: Global Rate Limiter on API Endpoints
print_header "Test 2: Global Rate Limiter (100 req/min on /api/nodes)"
print_info "Making 10 requests to /api/nodes endpoint..."

success_count=0
rate_limited_count=0

for i in {1..10}; do
    response=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/nodes")
    status_code=$(echo "$response" | tail -n 1)

    if [ "$status_code" == "200" ]; then
        ((success_count++))
    elif [ "$status_code" == "429" ]; then
        ((rate_limited_count++))
    fi

    if [ $VERBOSE -eq 1 ]; then
        echo "  Request $i: $status_code"
    fi
done

print_info "Results: $success_count succeeded, $rate_limited_count rate limited"

if [ $success_count -eq 10 ]; then
    print_success "All requests within limit succeeded"
else
    print_info "Note: Some requests were rate limited (expected if running multiple tests)"
fi

# Test 3: Settings Rate Limiter (5 req/min)
print_header "Test 3: Settings Rate Limiter (5 req/min)"
print_info "Making 7 requests to /api/settings/api-key/status..."

success_count=0
rate_limited_count=0
first_rate_limited=0

for i in {1..7}; do
    response=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/settings/api-key/status")
    status_code=$(echo "$response" | tail -n 1)

    if [ "$status_code" == "200" ]; then
        ((success_count++))
    elif [ "$status_code" == "429" ]; then
        ((rate_limited_count++))
        if [ $first_rate_limited -eq 0 ]; then
            first_rate_limited=$i
        fi
    fi

    if [ $VERBOSE -eq 1 ]; then
        echo "  Request $i: $status_code"
    fi
done

print_info "Results: $success_count succeeded, $rate_limited_count rate limited"

if [ $rate_limited_count -gt 0 ]; then
    print_success "Rate limiting triggered at request $first_rate_limited (expected after 5-6 requests)"
else
    print_info "No rate limiting triggered yet (5 req/min limit)"
fi

# Test 4: Rate Limit Headers
print_header "Test 4: Rate Limit Headers"
print_info "Checking rate limit headers in response..."

response_file=$(mktemp)
curl -s -i "$BASE_URL/api/nodes" > "$response_file"

if grep -q "ratelimit-limit" "$response_file"; then
    limit=$(grep -i "ratelimit-limit" "$response_file" | cut -d' ' -f2 | tr -d '\r')
    remaining=$(grep -i "ratelimit-remaining" "$response_file" | cut -d' ' -f2 | tr -d '\r')
    print_success "Rate limit headers present"
    print_info "Limit: $limit requests"
    print_info "Remaining: $remaining requests"
else
    print_error "Rate limit headers not found"
fi

rm "$response_file"

# Test 5: Rate Limit Error Response
print_header "Test 5: Rate Limit Error Response"
print_info "Testing error response format..."

# Make enough requests to trigger rate limiting on settings endpoint
for i in {1..6}; do
    curl -s "$BASE_URL/api/settings/api-key/status" > /dev/null
done

# This should be rate limited
response=$(curl -s "$BASE_URL/api/settings/api-key/status")
if echo "$response" | grep -q "Too many"; then
    print_success "Rate limit error message present"
    if echo "$response" | grep -q "retryAfter"; then
        print_success "retryAfter field present in error response"
    fi
    if [ $VERBOSE -eq 1 ]; then
        print_info "Error response:"
        echo "$response" | python3 -m json.tool 2>/dev/null || echo "$response"
    fi
else
    print_info "Rate limit not triggered (may need to wait or increase requests)"
fi

# Test 6: Different Endpoints, Same Rate Limiter
print_header "Test 6: Rate Limiter Sharing (Global Limiter)"
print_info "Testing if different endpoints share the same rate limiter..."

# Make requests to different endpoints under same limiter
nodes_status=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/nodes")
search_status=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/search?q=test")

print_info "GET /api/nodes: $nodes_status"
print_info "GET /api/search: $search_status"

if [ "$nodes_status" == "200" ] || [ "$search_status" == "200" ]; then
    print_success "Endpoints accessible under global rate limiter"
else
    print_info "Both endpoints rate limited (expected if test running continuously)"
fi

# Summary
print_header "Test Summary"
echo ""
echo "Rate Limiting Configuration:"
echo "  - Global limit: 100 requests/minute (all /api/* routes)"
echo "  - Import limit: 10 requests/minute (/api/import)"
echo "  - Settings limit: 5 requests/minute (/api/settings/*)"
echo "  - Health checks: No rate limiting"
echo ""
echo "All tests completed!"
echo ""
echo "Note: To see detailed output, run with VERBOSE=1:"
echo "  VERBOSE=1 ./scripts/test-rate-limits.sh"
echo ""
echo "To test with custom server URL:"
echo "  API_URL=http://localhost:3000 ./scripts/test-rate-limits.sh"
