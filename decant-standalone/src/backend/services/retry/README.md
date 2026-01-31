# Retry Logic and Circuit Breaker

Comprehensive retry utilities with exponential backoff and circuit breaker pattern for handling transient failures in external service calls.

## Overview

This module provides two complementary patterns for handling service failures:

1. **Retry Logic** - Automatically retries failed operations with exponential backoff
2. **Circuit Breaker** - Prevents cascading failures by failing fast when a service is down

## Features

### Retry Logic (`index.ts`)

- **Exponential Backoff**: Delays increase exponentially (e.g., 30s → 60s → 120s)
- **Jitter**: Adds randomization to prevent thundering herd
- **Retry-After Support**: Respects HTTP Retry-After headers
- **Smart Error Detection**: Automatically identifies retryable vs non-retryable errors
- **Configurable**: Fully customizable retry behavior
- **Logging**: Built-in logging for debugging

### Circuit Breaker (`circuit-breaker.ts`)

- **Three States**: Closed → Open → Half-Open
- **Fail Fast**: Rejects requests immediately when circuit is open
- **Automatic Recovery**: Attempts to close after timeout
- **Statistics Tracking**: Monitors success/failure rates
- **Registry Pattern**: Manages multiple circuit breakers

## Usage

### Basic Retry

```typescript
import { withRetry } from './retry/index.js';

// Simple retry with defaults
const result = await withRetry(async () => {
  return await fetchSomeData();
});

// Custom configuration
const result = await withRetry(
  async () => await fetchSomeData(),
  {
    maxAttempts: 5,
    initialDelayMs: 1000,
    maxDelayMs: 60000,
    backoffMultiplier: 2,
    context: 'my-api-call',
  }
);
```

### Using Presets

```typescript
import { withRetry, RetryPresets } from './retry/index.js';

// Fast retry (3 attempts, 1s → 2s → 4s)
await withRetry(fn, RetryPresets.FAST);

// Standard retry (3 attempts, 30s → 60s → 120s)
await withRetry(fn, RetryPresets.STANDARD);

// Patient retry (5 attempts, 60s → 120s → 240s)
await withRetry(fn, RetryPresets.PATIENT);

// Rate limit specific (respects 429 errors)
await withRetry(fn, RetryPresets.RATE_LIMIT);
```

### Circuit Breaker

```typescript
import { CircuitBreaker } from './retry/circuit-breaker.js';

const breaker = new CircuitBreaker({
  failureThreshold: 5,      // Open after 5 failures
  resetTimeoutMs: 60000,    // Try again after 60s
  halfOpenRequests: 3,      // Need 3 successes to close
  context: 'external-api',
});

// Use circuit breaker
try {
  const result = await breaker.call(async () => {
    return await externalApi.fetchData();
  });
} catch (error) {
  if (error instanceof CircuitBreakerOpenError) {
    // Circuit is open, service is down
    console.log('Service unavailable, using fallback');
  }
}
```

### Circuit Breaker Registry

```typescript
import { getCircuitBreakerRegistry } from './retry/circuit-breaker.js';

const registry = getCircuitBreakerRegistry();

// Get or create a circuit breaker for a service
const breaker = registry.getOrCreate('external-api', {
  failureThreshold: 10,
  resetTimeoutMs: 60000,
  halfOpenRequests: 3,
});

// Check all circuit breaker states
const allStats = registry.getAllStats();
console.log(allStats);
// {
//   'external-api': { state: 'closed', failures: 2, ... },
//   'another-service': { state: 'open', failures: 15, ... }
// }
```

### Combining Retry and Circuit Breaker

```typescript
import { withRetry, RetryPresets } from './retry/index.js';
import { getCircuitBreakerRegistry } from './retry/circuit-breaker.js';

const breaker = getCircuitBreakerRegistry().getOrCreate('my-service');

const result = await withRetry(
  () => breaker.call(async () => {
    return await myService.call();
  }),
  RetryPresets.STANDARD
);
```

## Configuration Options

### Retry Options

```typescript
interface RetryOptions {
  maxAttempts: number;           // Max retry attempts (default: 3)
  initialDelayMs: number;        // Initial delay (default: 30000ms)
  maxDelayMs: number;            // Max delay cap (default: 120000ms)
  backoffMultiplier: number;     // Exponential multiplier (default: 2)
  retryableErrors?: string[];    // Custom retryable error patterns
  onRetry?: (error, attempt, delayMs) => void;  // Retry callback
  enableJitter?: boolean;        // Add randomization (default: true)
  jitterFactor?: number;         // Jitter percentage (default: 0.3)
  context?: string;              // Logging context
}
```

### Circuit Breaker Options

```typescript
interface CircuitBreakerOptions {
  failureThreshold: number;      // Failures before opening
  resetTimeoutMs: number;        // Time until half-open attempt
  halfOpenRequests: number;      // Successes needed to close
  context?: string;              // Logging context
}
```

## Retryable Errors

### Automatic Detection

The retry logic automatically retries these errors:

**HTTP Status Codes:**
- 408 (Request Timeout)
- 429 (Too Many Requests)
- 500 (Internal Server Error)
- 502 (Bad Gateway)
- 503 (Service Unavailable)
- 504 (Gateway Timeout)

**Network Errors:**
- ECONNRESET
- ETIMEDOUT
- ENOTFOUND
- ECONNREFUSED
- EHOSTUNREACH
- ENETUNREACH
- Socket hang up

### Custom Retryable Errors

```typescript
await withRetry(fn, {
  retryableErrors: ['CUSTOM_ERROR', 'TIMEOUT'],
});
```

## Circuit Breaker States

### Closed (Normal)
- All requests pass through
- Failures are counted
- Opens after threshold failures

### Open (Failing Fast)
- Requests are rejected immediately
- No actual service calls are made
- Transitions to half-open after timeout

### Half-Open (Testing)
- Limited requests are allowed through
- One failure → back to open
- Success threshold → back to closed

```
┌─────────┐  failures ≥ threshold   ┌──────┐
│ Closed  │ ────────────────────────>│ Open │
└─────────┘                          └──────┘
     ^                                   │
     │                                   │ timeout
     │                                   v
     │                              ┌──────────┐
     │     successes ≥ threshold    │   Half   │
     └──────────────────────────────┤   Open   │
              failures = 1           └──────────┘
              ────────────────────────────┘
```

## Best Practices

### 1. Choose the Right Preset

- **FAST**: Interactive APIs, quick operations (< 5s)
- **STANDARD**: Most external services (30s-120s)
- **PATIENT**: Slow services, batch operations (60s-300s)
- **RATE_LIMIT**: APIs with strict rate limits

### 2. Set Appropriate Context

Always set a descriptive context for logging:

```typescript
withRetry(fn, {
  ...RetryPresets.STANDARD,
  context: 'openai-classification',
});
```

### 3. Use Circuit Breakers for External Services

Protect your application from cascading failures:

```typescript
// Per-domain circuit breakers
const breaker = registry.getOrCreate(`scraper:${domain}`);

// Per-service circuit breakers
const breaker = registry.getOrCreate('openai-llm');
```

### 4. Handle Circuit Breaker Open State

Provide fallbacks when circuit is open:

```typescript
try {
  return await breaker.call(fn);
} catch (error) {
  if (error instanceof CircuitBreakerOpenError) {
    return fallbackValue;
  }
  throw error;
}
```

### 5. Don't Retry Non-Retryable Errors

The system automatically skips retry for:
- 4xx errors (except 408, 429)
- Validation errors
- Authentication errors
- Not found errors

### 6. Respect Retry-After Headers

The system automatically parses and respects `Retry-After` headers:

```typescript
// If API returns: Retry-After: 120
// The retry delay will be at least 120 seconds
```

## Integration Examples

### LLM Provider

```typescript
// src/backend/services/llm/provider.ts
return withRetry(
  () => circuitBreaker.call(apiCall),
  {
    ...RetryPresets.RATE_LIMIT,
    context: 'openai-llm',
  }
);
```

### Scraper

```typescript
// src/backend/services/scraper.ts
const breaker = registry.getOrCreate(`scraper:${domain}`);

return withRetry(
  () => breaker.call(async () => {
    return await fetchAndParse(url);
  }),
  {
    ...RetryPresets.FAST,
    context: `scrape:${domain}`,
  }
);
```

### Processing Queue

```typescript
// src/backend/services/processing_queue.ts
return withRetry(
  async () => enrichNode(nodeId),
  {
    ...RetryPresets.STANDARD,
    maxAttempts: remainingAttempts,
    onRetry: (error, attempt, delayMs) => {
      log.debug('Job retry', { jobId, attempt, delayMs });
    },
  }
);
```

## Monitoring

### Get Circuit Breaker Stats

```typescript
const stats = breaker.getStats();
console.log({
  state: stats.state,
  failures: stats.failures,
  successes: stats.successes,
  consecutiveFailures: stats.consecutiveFailures,
  totalRequests: stats.totalRequests,
});
```

### Monitor All Circuit Breakers

```typescript
const allStats = registry.getAllStats();
for (const [name, stats] of Object.entries(allStats)) {
  if (stats.state === 'open') {
    console.log(`⚠️ Circuit breaker ${name} is OPEN`);
  }
}
```

## Testing

The retry system includes comprehensive tests:

```bash
# Run retry tests
npm test src/backend/services/retry/__tests__/retry.spec.ts

# Run circuit breaker tests
npm test src/backend/services/retry/__tests__/circuit-breaker.spec.ts
```

## Presets Reference

| Preset | Attempts | Initial Delay | Max Delay | Use Case |
|--------|----------|---------------|-----------|----------|
| FAST | 3 | 1s | 10s | Quick APIs, interactive |
| STANDARD | 3 | 30s | 120s | Most external services |
| PATIENT | 5 | 60s | 300s | Slow/unreliable services |
| RATE_LIMIT | 3 | 60s | 300s | Rate-limited APIs |

| Preset | Failure Threshold | Reset Timeout | Half-Open Requests |
|--------|-------------------|---------------|-------------------|
| SENSITIVE | 5 | 30s | 2 |
| STANDARD | 10 | 60s | 3 |
| TOLERANT | 20 | 120s | 5 |

## Error Handling Flow

```
┌──────────────┐
│ Service Call │
└──────┬───────┘
       │
       v
┌──────────────────┐
│ Circuit Breaker? │
├──────────────────┤
│ Open → Fail Fast │
│ Closed → Proceed │
└──────┬───────────┘
       │
       v
┌──────────────┐
│ Execute Call │
└──────┬───────┘
       │
       v
┌──────────────┐
│   Success?   │
└──────┬───────┘
       │
   ┌───┴───┐
   │       │
   ✓       ✗
   │       │
   │   ┌───v──────────┐
   │   │ Retryable?   │
   │   └───┬──────────┘
   │       │
   │   ┌───┴───┐
   │   │       │
   │   ✓       ✗
   │   │       │
   │   │   Throw Error
   │   │
   │   v
   │ ┌─────────────┐
   │ │ Max Retries?│
   │ └─────┬───────┘
   │       │
   │   ┌───┴───┐
   │   │       │
   │   ✓       ✗
   │   │       │
   │   │   ┌───v─────────┐
   │   │   │ Wait & Retry│
   │   │   └─────────────┘
   │   │
   │   └───> Throw Error
   │
   v
Return Result
```
