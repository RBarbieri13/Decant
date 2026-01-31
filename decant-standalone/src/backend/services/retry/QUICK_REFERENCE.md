# Retry System Quick Reference

## Common Patterns

### 1. Simple Retry

```typescript
import { withRetry, RetryPresets } from './retry/index.js';

await withRetry(
  async () => await myApiCall(),
  RetryPresets.STANDARD
);
```

### 2. Retry + Circuit Breaker

```typescript
import { withRetry, RetryPresets } from './retry/index.js';
import { getCircuitBreakerRegistry } from './retry/circuit-breaker.js';

const breaker = getCircuitBreakerRegistry().getOrCreate('my-service');

await withRetry(
  () => breaker.call(async () => await myApiCall()),
  RetryPresets.STANDARD
);
```

### 3. Custom Retry

```typescript
await withRetry(fn, {
  maxAttempts: 5,
  initialDelayMs: 10000,
  maxDelayMs: 60000,
  backoffMultiplier: 2,
  context: 'my-operation',
});
```

## Presets

### Retry

```typescript
RetryPresets.FAST        // 3 attempts, 1s → 2s → 4s
RetryPresets.STANDARD    // 3 attempts, 30s → 60s → 120s
RetryPresets.PATIENT     // 5 attempts, 60s → 120s → 240s
RetryPresets.RATE_LIMIT  // 3 attempts, 60s → 120s → 240s
```

### Circuit Breaker

```typescript
CircuitBreakerPresets.SENSITIVE  // 5 failures, 30s timeout
CircuitBreakerPresets.STANDARD   // 10 failures, 60s timeout
CircuitBreakerPresets.TOLERANT   // 20 failures, 120s timeout
```

## Error Handling

```typescript
import { CircuitBreakerOpenError } from './retry/circuit-breaker.js';

try {
  const result = await withRetry(fn, preset);
} catch (error) {
  if (error instanceof CircuitBreakerOpenError) {
    // Service is down, use fallback
    return fallbackData;
  }
  // Other error
  throw error;
}
```

## Monitoring

```bash
# Get circuit breaker stats
curl http://localhost:3000/metrics
```

```typescript
// Programmatic access
import { getCircuitBreakerRegistry } from './retry/circuit-breaker.js';

const stats = getCircuitBreakerRegistry().getAllStats();
console.log(stats);
```

## Configuration Options

```typescript
interface RetryOptions {
  maxAttempts: number;        // Default: 3
  initialDelayMs: number;     // Default: 30000
  maxDelayMs: number;         // Default: 120000
  backoffMultiplier: number;  // Default: 2
  enableJitter?: boolean;     // Default: true
  jitterFactor?: number;      // Default: 0.3
  retryableErrors?: string[]; // Default: []
  onRetry?: (error, attempt, delayMs) => void;
  context?: string;           // For logging
}

interface CircuitBreakerOptions {
  failureThreshold: number;   // Failures before opening
  resetTimeoutMs: number;     // Time until half-open
  halfOpenRequests: number;   // Successes to close
  context?: string;           // For logging
}
```

## When to Use What

| Scenario | Pattern |
|----------|---------|
| Quick API call | `RetryPresets.FAST` |
| Background job | `RetryPresets.STANDARD` |
| Rate-limited API | `RetryPresets.RATE_LIMIT` |
| External service | Retry + Circuit Breaker |
| Per-domain scraping | Circuit Breaker per domain |
| Internal service | Just retry (no circuit) |

## Common Issues

### Issue: Too many retries
**Solution:** Lower maxAttempts or use FAST preset

### Issue: Circuit opens too quickly
**Solution:** Increase failureThreshold or use TOLERANT preset

### Issue: Retrying non-retryable errors
**Solution:** Check error status codes, add to retryableErrors if needed

### Issue: Not respecting rate limits
**Solution:** Use RetryPresets.RATE_LIMIT

## Debug Commands

```bash
# Enable debug logging
LOG_LEVEL=debug npm start

# Check metrics
curl http://localhost:3000/metrics | jq '.circuitBreakers'

# Check queue stats
curl http://localhost:3000/metrics | jq '.queue'
```

## Manual Control

```typescript
import { getCircuitBreakerRegistry } from './retry/circuit-breaker.js';

const registry = getCircuitBreakerRegistry();

// Reset specific circuit
const breaker = registry.getOrCreate('my-service');
breaker.reset();

// Reset all circuits
registry.resetAll();

// Get specific stats
console.log(breaker.getStats());
```
