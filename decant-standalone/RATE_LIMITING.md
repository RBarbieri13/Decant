# Rate Limiting and Request Throttling

## Overview

Decant implements comprehensive rate limiting to protect the API from abuse and ensure fair resource usage. The rate limiting system uses `express-rate-limit` with configurable limits for different endpoint types.

## Architecture

### Three-Tier Rate Limiting Strategy

1. **Global Rate Limiter** - Applied to all `/api/*` routes
2. **Import Rate Limiter** - Stricter limits for AI-powered import operations
3. **Settings Rate Limiter** - Restrictive limits for sensitive configuration endpoints

### Rate Limit Headers

All rate-limited responses include standard headers:
- `RateLimit-Limit` - Maximum requests allowed in the window
- `RateLimit-Remaining` - Number of requests remaining in current window
- `RateLimit-Reset` - Timestamp when the rate limit resets

## Configuration

Rate limits are configured via environment variables with sensible defaults:

```bash
# Global rate limit window (milliseconds)
RATE_LIMIT_WINDOW_MS=60000        # Default: 60 seconds

# Maximum requests per window
RATE_LIMIT_MAX=100                # Default: 100 requests/minute

# Import endpoint limit
RATE_LIMIT_IMPORT_MAX=10          # Default: 10 requests/minute

# Settings endpoint limit
RATE_LIMIT_SETTINGS_MAX=5         # Default: 5 requests/minute
```

## Implementation Details

### File Structure

```
decant-standalone/
├── src/
│   ├── server.ts                          # Applies global rate limiter
│   └── backend/
│       ├── middleware/
│       │   └── rateLimit.ts              # Rate limiter definitions
│       └── routes/
│           └── index.ts                  # Applies specific rate limiters
```

### Rate Limiter Middleware

**Location:** `/Users/robert.barbieri/.claude/projects-workspace/Decant/decant-standalone/src/backend/middleware/rateLimit.ts`

The middleware provides:
- IP-based rate limiting with proxy support (`X-Forwarded-For` header)
- Configurable window size and maximum requests
- Violation logging with cooldown to prevent log spam
- Standard error responses with retry information
- Factory function for creating custom rate limiters

### Key Features

#### 1. IP Detection with Proxy Support
```typescript
keyGenerator: (req) => {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const ips = typeof forwarded === 'string' ? forwarded : forwarded[0];
    return ips.split(',')[0].trim();
  }
  return req.ip || req.socket.remoteAddress || 'unknown';
}
```

#### 2. Smart Violation Logging
- Logs violations only once per minute per IP
- Automatic cleanup of old violation records
- Prevents log spam during attacks

#### 3. Standard Error Response
```json
{
  "error": "Too many requests",
  "message": "Please try again later",
  "retryAfter": 60
}
```

## Endpoint Rate Limits

### Health Check Endpoints (No Rate Limit)
These endpoints are registered BEFORE the global rate limiter:
- `GET /health` - Basic health check
- `GET /health/live` - Liveness probe
- `GET /health/ready` - Readiness probe
- `GET /metrics` - Application metrics

### General API Endpoints (100 req/min)
Protected by global rate limiter:
- Node CRUD operations
- Hierarchy queries
- Search operations
- Backup/restore operations

### Import Endpoints (10 req/min)
AI-powered operations with stricter limits:
- `POST /api/import` - Import URL with AI classification

### Settings Endpoints (5 req/min)
Sensitive configuration operations:
- `POST /api/settings/api-key` - Set OpenAI API key
- `GET /api/settings/api-key/status` - Check API key status

## Server Configuration

**Location:** `/Users/robert.barbieri/.claude/projects-workspace/Decant/decant-standalone/src/server.ts`

```typescript
// Health checks registered FIRST (no rate limiting)
registerHealthRoutes(app);

// Apply global rate limiter to /api/* routes
app.use('/api', globalLimiter);

// API routes registered AFTER rate limiter
registerAPIRoutes(app);
```

This ensures:
1. Health checks are always accessible (no rate limiting)
2. All API routes are protected by at least the global rate limiter
3. Specific endpoints can have additional stricter limits

## Route Registration

**Location:** `/Users/robert.barbieri/.claude/projects-workspace/Decant/decant-standalone/src/backend/routes/index.ts`

```typescript
// Import endpoint with strict AI rate limiting
app.post('/api/import',
  importLimiter,                    // 10 req/min
  validateBody(ImportUrlSchema),
  importRoutes.importUrl
);

// Settings endpoints with restrictive limits
app.post('/api/settings/api-key',
  settingsLimiter,                  // 5 req/min
  validateBody(SetApiKeySchema),
  importRoutes.setApiKeyEndpoint
);
```

## Testing Rate Limits

### Manual Testing

```bash
# Test global rate limiter
for i in {1..150}; do
  curl -s http://localhost:3000/api/nodes | grep -q error && echo "Rate limited at request $i" && break
done

# Test import rate limiter
for i in {1..15}; do
  curl -X POST http://localhost:3000/api/import \
    -H "Content-Type: application/json" \
    -d '{"url": "https://example.com"}' | grep -q "Too many" && echo "Blocked at $i"
done

# Test settings rate limiter
for i in {1..10}; do
  curl http://localhost:3000/api/settings/api-key/status | grep -q "Too many" && echo "Blocked at $i"
done
```

### Expected Responses

**Success:**
```json
{
  "id": "...",
  "title": "...",
  ...
}
```
Headers:
```
RateLimit-Limit: 100
RateLimit-Remaining: 99
RateLimit-Reset: 1706456789
```

**Rate Limited (429):**
```json
{
  "error": "Too many requests",
  "message": "Please try again later",
  "retryAfter": 60
}
```

## Custom Rate Limiters

You can create custom rate limiters for new endpoints:

```typescript
import { createCustomLimiter } from '../middleware/rateLimit.js';

const customLimiter = createCustomLimiter('myFeature', {
  windowMs: 120000,  // 2 minutes
  max: 50,           // 50 requests per 2 minutes
  message: 'Custom rate limit message'
});

app.post('/api/my-feature', customLimiter, myHandler);
```

## Monitoring

Rate limit violations are logged with the following format:

```
WARN: Rate limit exceeded
  limiter: "import"
  ip: "192.168.1.100"
  module: "rateLimit"
```

Logs include:
- Which rate limiter was triggered
- Client IP address
- Timestamp

## Production Considerations

### 1. Adjust Limits Based on Load
Monitor your application metrics and adjust rate limits:
- Increase `RATE_LIMIT_MAX` for high-traffic legitimate use
- Decrease import limits if AI costs become too high

### 2. Use Redis for Distributed Systems
The current implementation uses in-memory storage. For multiple server instances, consider using a shared Redis store:

```typescript
import RedisStore from 'rate-limit-redis';
import { createClient } from 'redis';

const client = createClient({ url: process.env.REDIS_URL });

export const globalLimiter = rateLimit({
  store: new RedisStore({ client }),
  // ... other options
});
```

### 3. Monitor Rate Limit Metrics
Track rate limit metrics:
- Number of violations per endpoint
- IPs that frequently hit limits
- Correlation with server load

### 4. Consider Per-User Rate Limiting
For authenticated systems, rate limit per user instead of per IP:

```typescript
keyGenerator: (req) => {
  // Use user ID from auth middleware
  return req.user?.id || req.ip || 'anonymous';
}
```

## Security Benefits

1. **DDoS Protection** - Prevents overwhelming the server with requests
2. **API Abuse Prevention** - Limits automated scraping and data harvesting
3. **Cost Control** - Restricts expensive AI operations
4. **Fair Resource Allocation** - Ensures all users get fair access

## Troubleshooting

### Issue: Legitimate Users Being Rate Limited

**Solution:** Increase the rate limit for that endpoint type:
```bash
RATE_LIMIT_MAX=200  # Double the limit
```

### Issue: Rate Limits Not Working

**Check:**
1. Middleware is registered in correct order
2. Environment variables are loaded
3. Health check routes are NOT rate limited (by design)

### Issue: Multiple IPs from Same User

**Solution:** If users are behind NAT/proxy, consider:
- Authenticating users and rate limiting by user ID
- Increasing limits for known proxy IP ranges
- Using more sophisticated fingerprinting

## Future Enhancements

Potential improvements:
1. **Dynamic Rate Limiting** - Adjust limits based on server load
2. **Whitelist/Blacklist** - Bypass or block specific IPs
3. **Per-User Limits** - Rate limit authenticated users separately
4. **Burst Allowance** - Allow short bursts above the limit
5. **Time-Based Limits** - Different limits for peak vs off-peak hours

## Related Files

- **Middleware:** `/Users/robert.barbieri/.claude/projects-workspace/Decant/decant-standalone/src/backend/middleware/rateLimit.ts`
- **Server Config:** `/Users/robert.barbieri/.claude/projects-workspace/Decant/decant-standalone/src/server.ts`
- **Route Registration:** `/Users/robert.barbieri/.claude/projects-workspace/Decant/decant-standalone/src/backend/routes/index.ts`
- **Environment Template:** `/Users/robert.barbieri/.claude/projects-workspace/Decant/decant-standalone/.env.example`
- **Package Config:** `/Users/robert.barbieri/.claude/projects-workspace/Decant/decant-standalone/package.json`
