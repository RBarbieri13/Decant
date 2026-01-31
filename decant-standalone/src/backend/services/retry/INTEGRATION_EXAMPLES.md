# Retry System Integration Examples

This document provides comprehensive examples of how the retry system is integrated throughout the Decant application.

## Table of Contents

1. [LLM Provider Integration](#llm-provider-integration)
2. [Scraper Integration](#scraper-integration)
3. [Processing Queue Integration](#processing-queue-integration)
4. [Custom Service Integration](#custom-service-integration)
5. [Monitoring and Debugging](#monitoring-and-debugging)

---

## LLM Provider Integration

The LLM provider uses retry logic with circuit breaker to handle OpenAI API failures and rate limits.

### Configuration

```typescript
// src/backend/services/llm/provider.ts

export class OpenAIProvider implements LLMProvider {
  private retryOptions: Partial<RetryOptions>;
  private enableCircuitBreaker: boolean;

  constructor(config: OpenAIProviderConfig) {
    // Use rate-limit specific retry configuration
    this.retryOptions = {
      ...RetryPresets.RATE_LIMIT,  // 3 attempts, 60s-300s delays
      context: 'openai-llm',
      ...config.retryOptions,
    };

    this.enableCircuitBreaker = config.enableCircuitBreaker ?? true;
  }

  async complete(messages, options): Promise<LLMCompletionResult> {
    const apiCall = async () => {
      const response = await this.client.chat.completions.create({...});
      return processResponse(response);
    };

    // Wrap with circuit breaker and retry
    if (this.enableCircuitBreaker) {
      const breaker = getCircuitBreakerRegistry().getOrCreate('openai-llm');
      return withRetry(
        () => breaker.call(apiCall),
        this.retryOptions
      );
    }

    return withRetry(apiCall, this.retryOptions);
  }
}
```

### Behavior

**Rate Limit (429)**:
1. First attempt fails with 429
2. Checks Retry-After header (e.g., 60 seconds)
3. Waits 60 seconds
4. Retries request
5. If still failing, waits exponentially longer (120s, 240s)

**Server Error (503)**:
1. OpenAI API returns 503
2. First retry after 60s
3. Second retry after 120s
4. Third retry after 240s
5. After 10 consecutive failures, circuit opens
6. Subsequent requests fail fast for 60s

**Success After Circuit Open**:
1. Circuit stays open for 60s
2. Transitions to half-open
3. Next 3 successful requests close the circuit
4. Normal operation resumes

### Example Usage

```typescript
import { initializeProvider } from './services/llm/provider.js';

// Initialize with custom retry config
const provider = initializeProvider({
  type: 'openai',
  apiKey: process.env.OPENAI_API_KEY,
  retryOptions: {
    maxAttempts: 5,
    initialDelayMs: 30000,
  },
  enableCircuitBreaker: true,
});

// Make a request (automatically retried on failure)
try {
  const result = await provider.complete([
    { role: 'user', content: 'Classify this item' }
  ]);
} catch (error) {
  if (error instanceof CircuitBreakerOpenError) {
    console.log('OpenAI service is temporarily unavailable');
  } else {
    console.error('LLM request failed after all retries:', error);
  }
}
```

---

## Scraper Integration

The scraper uses per-domain circuit breakers to prevent hammering failing websites.

### Configuration

```typescript
// src/backend/services/scraper.ts

export async function scrapeUrl(url: string): Promise<ScrapedContent> {
  const parsedUrl = validateUrlForSSRF(url);
  const domain = parsedUrl.hostname.replace(/^www\./, '');

  // Get or create circuit breaker for this domain
  const circuitBreaker = getCircuitBreakerRegistry().getOrCreate(
    `scraper:${domain}`,
    {
      failureThreshold: 5,      // Open after 5 failures
      resetTimeoutMs: 60000,    // Try again after 60s
      halfOpenRequests: 2,      // Need 2 successes to close
      context: `scraper:${domain}`,
    }
  );

  const scrapeWithRetry = async () => {
    return circuitBreaker.call(async () => {
      const html = await fetchWithLimits(url);
      return extractMetadata(html);
    });
  };

  // Use fast retry preset (1s, 2s, 4s)
  return withRetry(scrapeWithRetry, {
    ...RetryPresets.FAST,
    context: `scrape:${domain}`,
    retryableErrors: ['FETCH_FAILED', 'TIMEOUT'],
  });
}
```

### Behavior

**Network Timeout**:
1. Fetch times out after 30s (SCRAPER_TIMEOUT_MS)
2. Retry after 1s
3. Retry after 2s
4. Retry after 4s
5. If still failing, throw error

**Domain Down (Multiple URLs)**:
1. First URL fails 5 times → circuit opens for domain
2. Second URL from same domain fails fast
3. Third URL from same domain fails fast
4. After 60s, circuit moves to half-open
5. Next 2 successful scrapes close the circuit

**Mixed Domains**:
```typescript
// Domain A fails → circuit opens for domain A only
await scrapeUrl('https://a.com/page1'); // Opens circuit for a.com

// Domain B is unaffected
await scrapeUrl('https://b.com/page1'); // Works normally

// Domain A requests fail fast
await scrapeUrl('https://a.com/page2'); // CircuitBreakerOpenError
```

### Example Usage

```typescript
import { scrapeUrl } from './services/scraper.js';

try {
  const content = await scrapeUrl('https://example.com/article');
  console.log('Scraped:', content.title);
} catch (error) {
  if (error instanceof CircuitBreakerOpenError) {
    console.log('Domain is temporarily unreachable');
    // Use cached data or skip
  } else if (error instanceof SSRFError) {
    console.log('URL blocked for security');
  } else {
    console.error('Scraping failed:', error);
  }
}
```

---

## Processing Queue Integration

The processing queue uses retry logic for individual job execution.

### Configuration

```typescript
// src/backend/services/processing_queue.ts

const JOB_RETRY_OPTIONS = {
  ...RetryPresets.STANDARD,  // 30s, 60s, 120s
  context: 'processing-queue-job',
};

class ProcessingQueue {
  private async executeJob(job: ProcessingJob): Promise<EnrichmentResult> {
    return withRetry(
      async () => {
        switch (job.phase) {
          case 'phase2':
            return enrichNode(job.node_id);
          default:
            throw new Error(`Unknown phase: ${job.phase}`);
        }
      },
      {
        ...JOB_RETRY_OPTIONS,
        // Respect job's max attempts
        maxAttempts: Math.min(job.max_attempts - job.attempts, 3),
        onRetry: (error, attempt, delayMs) => {
          log.debug('Job execution retry', {
            jobId: job.id,
            attempt,
            delayMs,
          });
        },
      }
    );
  }

  private async handleJobFailure(job: ProcessingJob, error: string) {
    if (job.attempts >= job.max_attempts) {
      // Dead letter queue
      markAsFailedPermanently(job.id, error);
    } else {
      // Schedule for retry
      incrementAttempts(job.id);
    }
  }
}
```

### Behavior

**Transient LLM Failure**:
1. Job executes enrichNode()
2. OpenAI returns 503
3. Retries after 30s (job-level retry)
4. If LLM provider also retries, combined: 30s + 60s
5. Success → job complete

**Permanent Failure**:
1. Job fails 3 times (job max_attempts)
2. Moved to dead letter queue
3. Status set to 'failed'
4. Can be manually retried later

**Job Queue Retry Logic**:
```
Job Attempt 1 → enrichNode() → LLM Call (with retry) → Fails
  ↓ Wait 30s
Job Attempt 2 → enrichNode() → LLM Call (with retry) → Fails
  ↓ Wait 60s
Job Attempt 3 → enrichNode() → LLM Call (with retry) → Fails
  ↓
Dead Letter Queue
```

### Example Usage

```typescript
import { getProcessingQueue } from './services/processing_queue.js';

const queue = getProcessingQueue();

// Enqueue job
const jobId = queue.enqueue('node-123', {
  phase: 'phase2',
  priority: 5,
  maxAttempts: 3,
});

// Check job status
const job = queue.getJob(jobId);
console.log(job.status, job.attempts);

// Retry failed jobs
const retried = queue.retryFailed('node-123');
console.log(`Retried ${retried} jobs`);
```

---

## Custom Service Integration

How to add retry logic to your own services.

### Simple Service with Retry

```typescript
import { withRetry, RetryPresets } from './services/retry/index.js';

export async function callExternalAPI(params: Params): Promise<Result> {
  return withRetry(
    async () => {
      const response = await fetch('https://api.example.com/data', {
        method: 'POST',
        body: JSON.stringify(params),
      });

      if (!response.ok) {
        const error = new Error(`API error: ${response.statusText}`);
        (error as any).status = response.status;
        throw error;
      }

      return response.json();
    },
    {
      ...RetryPresets.STANDARD,
      context: 'external-api',
    }
  );
}
```

### Service with Circuit Breaker

```typescript
import { withRetry, RetryPresets } from './services/retry/index.js';
import { getCircuitBreakerRegistry } from './services/retry/circuit-breaker.js';

export class ExternalService {
  private breaker = getCircuitBreakerRegistry().getOrCreate('external-service', {
    failureThreshold: 10,
    resetTimeoutMs: 60000,
    halfOpenRequests: 3,
  });

  async callAPI(endpoint: string, data: any): Promise<any> {
    return withRetry(
      () => this.breaker.call(async () => {
        const response = await this.makeRequest(endpoint, data);
        return this.processResponse(response);
      }),
      {
        ...RetryPresets.STANDARD,
        context: `external-service:${endpoint}`,
        onRetry: (error, attempt, delayMs) => {
          console.log(`Retry ${attempt} in ${delayMs}ms:`, error.message);
        },
      }
    );
  }

  private async makeRequest(endpoint: string, data: any) {
    // Actual API call implementation
  }

  private processResponse(response: Response) {
    // Response processing
  }
}
```

### Custom Retry Logic

```typescript
import { withRetry } from './services/retry/index.js';

export async function customRetry(): Promise<Data> {
  return withRetry(
    async () => {
      // Your logic here
    },
    {
      maxAttempts: 5,
      initialDelayMs: 2000,
      maxDelayMs: 30000,
      backoffMultiplier: 1.5,
      enableJitter: true,
      jitterFactor: 0.2,
      retryableErrors: ['CUSTOM_ERROR', 'TEMPORARY_FAILURE'],
      onRetry: (error, attempt, delayMs) => {
        console.log(`Retry ${attempt}/${5} in ${delayMs}ms`);

        // Custom logging or metrics
        if (attempt >= 3) {
          sendAlert('Multiple retries needed', { error, attempt });
        }
      },
      context: 'custom-operation',
    }
  );
}
```

---

## Monitoring and Debugging

### Check Circuit Breaker Status

```typescript
import { getCircuitBreakerRegistry } from './services/retry/circuit-breaker.js';

const registry = getCircuitBreakerRegistry();
const stats = registry.getAllStats();

for (const [name, stat] of Object.entries(stats)) {
  console.log(`${name}:`, {
    state: stat.state,
    failures: stat.consecutiveFailures,
    successRate: (stat.successes / stat.totalRequests * 100).toFixed(2) + '%',
  });
}
```

### Health Endpoint

```bash
# Get all metrics including circuit breakers
curl http://localhost:3000/metrics

# Response includes:
{
  "circuitBreakers": {
    "openai-llm": {
      "state": "closed",
      "failures": 0,
      "successes": 145,
      "consecutiveFailures": 0,
      "totalRequests": 145
    },
    "scraper:example.com": {
      "state": "open",
      "failures": 15,
      "successes": 3,
      "consecutiveFailures": 10,
      "totalRequests": 18
    }
  },
  "queue": {
    "pending": 5,
    "processing": 1,
    "complete": 234,
    "failed": 2
  }
}
```

### Debug Logging

Enable debug logging to see retry attempts:

```bash
LOG_LEVEL=debug npm start
```

Example logs:

```
[DEBUG] Retrying after error context=openai-llm attempt=1 maxAttempts=3 delayMs=60123 error="Rate limit exceeded"
[WARN] Circuit breaker state changed context=scraper:example.com oldState=closed newState=open consecutiveFailures=5
[INFO] Retry succeeded context=openai-llm attempt=2 durationMs=61234
```

### Manual Circuit Breaker Control

```typescript
import { getCircuitBreakerRegistry } from './services/retry/circuit-breaker.js';

const registry = getCircuitBreakerRegistry();

// Reset specific circuit breaker
const breaker = registry.getOrCreate('openai-llm');
breaker.reset();

// Reset all circuit breakers
registry.resetAll();

// Get stats for alerting
const stats = breaker.getStats();
if (stats.state === 'open') {
  sendAlert('OpenAI circuit breaker is open!');
}
```

### Retry Metrics

Track retry metrics in your observability system:

```typescript
import { withRetry } from './services/retry/index.js';

let retryCount = 0;
let totalDelay = 0;

await withRetry(
  async () => callAPI(),
  {
    onRetry: (error, attempt, delayMs) => {
      retryCount++;
      totalDelay += delayMs;

      // Send to metrics system
      metrics.increment('api.retries', {
        service: 'openai',
        attempt,
      });

      metrics.timing('api.retry_delay', delayMs, {
        service: 'openai',
      });
    },
  }
);

// Record final metrics
if (retryCount > 0) {
  metrics.gauge('api.retry_rate', retryCount);
  metrics.timing('api.total_retry_delay', totalDelay);
}
```

---

## Best Practices Summary

### 1. Choose Appropriate Presets

| Service Type | Preset | Reason |
|-------------|---------|--------|
| Interactive APIs | FAST | Quick feedback (1s-4s) |
| Background jobs | STANDARD | Balance reliability/speed (30s-120s) |
| Batch operations | PATIENT | Can wait longer (60s-300s) |
| Rate-limited APIs | RATE_LIMIT | Respects 429 responses |

### 2. Use Circuit Breakers for External Services

```typescript
// ✅ Good: Circuit breaker per external service
const breaker = registry.getOrCreate('openai-llm');

// ✅ Good: Circuit breaker per domain
const breaker = registry.getOrCreate(`scraper:${domain}`);

// ❌ Bad: Shared circuit breaker for all services
const breaker = registry.getOrCreate('all-services');
```

### 3. Set Meaningful Context

```typescript
// ✅ Good: Descriptive context
context: 'openai-classification'
context: 'scraper:github.com'
context: 'processing-queue-phase2'

// ❌ Bad: Generic context
context: 'retry'
context: 'api'
```

### 4. Handle Circuit Breaker Open State

```typescript
// ✅ Good: Provide fallback
try {
  return await breaker.call(fn);
} catch (error) {
  if (error instanceof CircuitBreakerOpenError) {
    return getCachedData();
  }
  throw error;
}

// ❌ Bad: No fallback
return await breaker.call(fn);
```

### 5. Don't Over-Retry

```typescript
// ✅ Good: Reasonable attempts
maxAttempts: 3

// ❌ Bad: Too many attempts
maxAttempts: 10  // Will take too long
```

### 6. Log Appropriately

```typescript
onRetry: (error, attempt, delayMs) => {
  // ✅ Good: Structured logging
  log.warn('Retrying after error', {
    context: 'my-service',
    attempt,
    delayMs,
    error: error.message,
  });

  // ❌ Bad: No logging or console.log
  // (nothing)
}
```
