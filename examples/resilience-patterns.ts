/**
 * Resilience Patterns with Trembita
 *
 * Advanced patterns for building robust API clients that handle:
 * - Transient failures with exponential backoff
 * - Circuit breaker to prevent cascading failures
 * - Timeouts and connection management
 * - Graceful degradation
 */

import {
  createTrembita,
  createRetryingFetch,
  HTTP_OK,
  type TrembitaClient,
  type TrembitaFetchOptions
} from 'trembita';

// ============================================================================
// Pattern 1: Exponential Backoff Retries
// ============================================================================

/**
 * Retry transient failures (5xx, network errors) with backoff.
 * Successful requests pass through immediately.
 */
export function createResilientClient(endpoint: string) {
  const retryingFetch = createRetryingFetch({
    initialDelayMs: 100, // Start with 100ms
    maxAttempts: 5, // Try up to 5 times
    shouldRetry: (statusCode) => {
      // Retry on server errors and timeout-like conditions
      return statusCode >= 500 || statusCode === 408 || statusCode === 429;
    }
  });

  return createTrembita({
    endpoint,
    fetchImpl: retryingFetch,
    timeoutMs: 10_000
  });
}

// Usage:
// const api = createResilientClient('https://api.example.com');
// if (api.ok) {
//   const result = await api.value.request({ path: '/data' });
//   // Retries happen automatically
// }

// ============================================================================
// Pattern 2: Circuit Breaker (Fail Fast)
// ============================================================================

/**
 * Circuit breaker prevents hammering a failing service.
 * After N failures, requests fail immediately without attempting.
 */
export function createCircuitBreakerClient(endpoint: string) {
  return createTrembita({
    endpoint,
    circuitBreaker: {
      failureThreshold: 5, // Open after 5 failures
      cooldownMs: 60_000 // Try again after 60s
    },
    timeoutMs: 5_000
  });
}

// Usage:
// const api = createCircuitBreakerClient('https://api.example.com');
// if (api.ok) {
//   const result = await api.value.request({ path: '/data' });
//
//   if (!result.ok && result.error.kind === 'circuit_open') {
//     // Service is down, use fallback/cache
//     return getCachedData();
//   }
// }

// ============================================================================
// Pattern 3: Fallback Chain
// ============================================================================

interface FallbackConfig {
  primary: { endpoint: string };
  secondary: { endpoint: string };
  cache?: Map<string, unknown>;
}

/**
 * Try primary, fall back to secondary, then cache if both fail.
 */
export async function requestWithFallback(
  config: FallbackConfig,
  path: string
): Promise<{
  data: unknown;
  source: 'primary' | 'secondary' | 'cache';
} | null> {
  // Try primary endpoint
  const primary = createTrembita({
    endpoint: config.primary.endpoint,
    timeoutMs: 3_000
  });

  if (primary.ok) {
    const result = await primary.value.request({
      path,
      expectedCodes: [HTTP_OK]
    });

    if (result.ok) {
      return { data: result.value, source: 'primary' };
    }
  }

  console.warn('Primary endpoint failed, trying secondary');

  // Try secondary endpoint
  const secondary = createTrembita({
    endpoint: config.secondary.endpoint,
    timeoutMs: 3_000
  });

  if (secondary.ok) {
    const result = await secondary.value.request({
      path,
      expectedCodes: [HTTP_OK]
    });

    if (result.ok) {
      return { data: result.value, source: 'secondary' };
    }
  }

  console.warn('Secondary endpoint failed, checking cache');

  // Fall back to cache
  const cacheKey = `${path}`;
  const cached = config.cache?.get(cacheKey);

  if (cached) {
    console.warn('Returning stale cache');
    return { data: cached, source: 'cache' };
  }

  console.error('All sources failed');
  return null;
}

// Usage:
// const config: FallbackConfig = {
//   primary: { endpoint: 'https://api.example.com' },
//   secondary: { endpoint: 'https://api-backup.example.com' },
//   cache: new Map()
// };
// const result = await requestWithFallback(config, '/data');

// ============================================================================
// Pattern 4: Bulkhead Isolation (Concurrent Limit)
// ============================================================================

/**
 * Limit concurrent requests to prevent overwhelming upstream.
 */
export class BulkheadClient {
  private activeRequests = 0;
  private readonly maxConcurrent: number;
  private readonly queue: Array<() => Promise<void>> = [];

  constructor(
    private client: TrembitaClient,
    maxConcurrent = 10
  ) {
    this.maxConcurrent = maxConcurrent;
  }

  async request(options: TrembitaFetchOptions) {
    return new Promise<any>((resolve, reject) => {
      const task = async () => {
        try {
          const result = await this.client.request(options);
          resolve(result);
        } catch (error) {
          reject(error);
        } finally {
          this.activeRequests--;
          this.processQueue();
        }
      };

      if (this.activeRequests < this.maxConcurrent) {
        this.activeRequests++;
        task();
      } else {
        this.queue.push(task);
      }
    });
  }

  private processQueue() {
    if (this.queue.length > 0 && this.activeRequests < this.maxConcurrent) {
      const task = this.queue.shift();
      if (task) {
        this.activeRequests++;
        task();
      }
    }
  }

  get stats() {
    return {
      active: this.activeRequests,
      queued: this.queue.length,
      total: this.activeRequests + this.queue.length
    };
  }
}

// Usage:
// const api = createTrembita({ endpoint: 'https://api.example.com' });
// if (api.ok) {
//   const bulkhead = new BulkheadClient(api.value, 5); // Max 5 concurrent
//   const result = await bulkhead.request({ path: '/data' });
//   console.log(bulkhead.stats); // { active: 4, queued: 2, total: 6 }
// }

// ============================================================================
// Pattern 5: Timeout Management
// ============================================================================

/**
 * Handle various timeout scenarios.
 */
export async function requestWithAdaptiveTimeout(
  client: TrembitaClient,
  path: string,
  options: {
    initialTimeoutMs?: number;
    maxTimeoutMs?: number;
    retryCount?: number;
  } = {}
) {
  const {
    initialTimeoutMs = 5_000,
    maxTimeoutMs = 30_000,
    retryCount = 3
  } = options;

  let timeoutMs = initialTimeoutMs;
  let lastError: unknown;

  for (let attempt = 1; attempt <= retryCount; attempt++) {
    console.log(`Attempt ${attempt} with timeout ${timeoutMs}ms`);

    const result = await client.request({
      path,
      timeoutMs,
      expectedCodes: [HTTP_OK]
    });

    if (result.ok) {
      return result.value;
    }

    lastError = result.error;

    if (result.error.kind === 'timeout') {
      // Increase timeout for next attempt (but respect max)
      timeoutMs = Math.min(timeoutMs * 2, maxTimeoutMs);
      console.warn(`Timeout, increasing to ${timeoutMs}ms`);
      continue;
    }

    if (result.error.kind !== 'fetch_failed') {
      // Not a retriable error
      throw new Error(`Request failed: ${result.error.kind}`);
    }
  }

  throw new Error(
    `Request failed after ${retryCount} attempts: ${String((lastError as { kind?: string })?.kind ?? 'unknown')}`
  );
}

// Usage:
// const data = await requestWithAdaptiveTimeout(client, '/slow-endpoint', {
//   initialTimeoutMs: 3_000,
//   maxTimeoutMs: 30_000,
//   retryCount: 3
// });

// ============================================================================
// Pattern 6: Composed Resilience Stack
// ============================================================================

/**
 * Combine multiple patterns: retries + circuit breaker + timeout + logging
 */
export function createFullStackResilientClient(endpoint: string) {
  const retryingFetch = createRetryingFetch({
    initialDelayMs: 100,
    maxAttempts: 3,
    shouldRetry: (statusCode) => statusCode >= 500
  });

  return createTrembita({
    endpoint,
    fetchImpl: retryingFetch,
    circuitBreaker: {
      failureThreshold: 10,
      cooldownMs: 60_000
    },
    timeoutMs: 10_000,
    log: {
      debug: (msg, meta) => {
        if (meta?.statusCode) {
          console.log(`[HTTP] ${msg} - ${meta.statusCode}`);
        }
      },
      warn: (msg, meta) => {
        console.warn(`[API Warning] ${msg}`, meta);
      },
      error: (msg, meta) => {
        console.error(`[API Error] ${msg}`, meta);
      }
    }
  });
}

// Usage:
// const api = createFullStackResilientClient('https://api.example.com');
// if (api.ok) {
//   // Single request call gets:
//   // - Automatic retries on 5xx
//   // - Circuit breaker if repeated failures
//   // - 10s timeout
//   // - Structured logging
//   const result = await api.value.request({ path: '/data' });
// }

// ============================================================================
// Pattern 7: Health-Aware Client Selection
// ============================================================================

interface HealthyClient {
  endpoint: string;
  client: TrembitaClient;
  lastSuccess: number;
  failureCount: number;
}

/**
 * Automatically select the healthiest client from a pool.
 */
export class HealthAwareClientPool {
  private clients: HealthyClient[];
  private readonly failureThreshold = 3;

  constructor(endpoints: string[]) {
    this.clients = endpoints.map((endpoint) => {
      const result = createTrembita({ endpoint, timeoutMs: 5_000 });
      if (!result.ok) {
        throw new Error(
          `Failed to init client for ${endpoint}: ${result.error.kind}`
        );
      }
      return {
        endpoint,
        client: result.value,
        lastSuccess: Date.now(),
        failureCount: 0
      };
    });
  }

  async request(options: TrembitaFetchOptions) {
    const healthyClients = this.clients.filter(
      (c) => c.failureCount < this.failureThreshold
    );

    if (healthyClients.length === 0) {
      throw new Error('No healthy clients available');
    }

    // Sort by recent success time (prefer recently working ones)
    healthyClients.sort((a, b) => b.lastSuccess - a.lastSuccess);

    const client = healthyClients[0];

    try {
      const result = await client.client.request(options);

      if (result.ok) {
        client.lastSuccess = Date.now();
        client.failureCount = 0;
      } else {
        client.failureCount++;
      }

      return result;
    } catch (error) {
      client.failureCount++;
      throw error;
    }
  }

  get stats() {
    return this.clients.map((c) => ({
      endpoint: c.endpoint,
      healthy: c.failureCount < this.failureThreshold,
      failureCount: c.failureCount,
      lastSuccess: new Date(c.lastSuccess)
    }));
  }
}

// Usage:
// const pool = new HealthAwareClientPool([
//   'https://api-1.example.com',
//   'https://api-2.example.com',
//   'https://api-3.example.com'
// ]);
//
// const result = await pool.request({ path: '/data' });
// console.log(pool.stats);
