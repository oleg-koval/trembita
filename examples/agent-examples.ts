/**
 * Trembita Agent Examples
 *
 * Real-world integration patterns that agents should follow when
 * implementing API integrations with Trembita.
 */

import { createTrembita, HTTP_OK, HTTP_CREATED, Result } from '../dist/index.js';
import type {
  TrembitaClient,
  TrembitaRequestError,
  TrembitaSendError
} from '../dist/index.js';

// ============================================================================
// Example 1: REST API Service Client
// ============================================================================

interface GitHubUser {
  login: string;
  id: number;
  avatar_url: string;
  repos_url: string;
}

interface GitHubError {
  kind: 'not_found' | 'rate_limited' | 'network_error' | 'invalid_response';
  statusCode?: number;
  message: string;
}

export class GitHubAPIClient {
  private api: TrembitaClient;

  constructor(token: string) {
    const client = createTrembita({
      endpoint: 'https://api.github.com',
      timeoutMs: 10000,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json'
      }
    });

    if (!client.ok) {
      throw new Error(`Failed to initialize GitHub client: ${client.error.kind}`);
    }

    this.api = client.value;
  }

  async getUser(username: string): Promise<Result<GitHubUser, GitHubError>> {
    const result = await this.api.request({
      path: `/users/${username}`,
      expectedCodes: [HTTP_OK]
    });

    if (!result.ok) {
      // Map Trembita errors to domain errors
      if (result.error.kind === 'unexpected_status') {
        if (result.error.statusCode === 404) {
          return {
            ok: false,
            error: {
              kind: 'not_found' as const,
              statusCode: 404,
              message: `User ${username} not found`
            }
          };
        }
        if (result.error.statusCode === 403) {
          return {
            ok: false,
            error: {
              kind: 'rate_limited' as const,
              statusCode: 403,
              message: 'GitHub API rate limit exceeded'
            }
          };
        }
      }

      return {
        ok: false,
        error: {
          kind: 'network_error' as const,
          statusCode: result.error.kind === 'unexpected_status' ? result.error.statusCode : undefined,
          message: `Failed to fetch user: ${result.error.kind}`
        }
      };
    }

    // Validate response shape at runtime
    const user = result.value as GitHubUser;
    if (!user.login || !user.id) {
      return {
        ok: false,
        error: {
          kind: 'invalid_response' as const,
          message: 'Unexpected GitHub API response format'
        }
      };
    }

    return { ok: true, value: user };
  }

  async getRepos(username: string): Promise<Result<unknown[], GitHubError>> {
    const result = await this.api.request({
      path: `/users/${username}/repos`,
      query: { per_page: '10', sort: 'updated' },
      expectedCodes: [HTTP_OK]
    });

    if (!result.ok) {
      return {
        ok: false,
        error: {
          kind: 'network_error' as const,
          message: `Failed to fetch repos: ${result.error.kind}`
        }
      };
    }

    return { ok: true, value: Array.isArray(result.value) ? result.value : [] };
  }
}

// ============================================================================
// Example 2: Payment Gateway Integration
// ============================================================================

interface PaymentResult {
  ok: true;
  transactionId: string;
  amount: number;
  status: 'pending' | 'completed' | 'failed';
}

interface PaymentError {
  kind: 'insufficient_funds' | 'invalid_card' | 'rate_limit' | 'service_error';
  message: string;
  retryable: boolean;
}

export async function createPaymentIntent(
  amount: number,
  currency: string,
  customerId: string
): Promise<Result<PaymentResult, PaymentError>> {
  const stripe = createTrembita({
    endpoint: 'https://api.stripe.com/v1',
    fetchImpl: globalThis.fetch,
    timeoutMs: 30000
  });

  if (!stripe.ok) {
    return {
      ok: false,
      error: {
        kind: 'service_error' as const,
        message: 'Failed to initialize Stripe client',
        retryable: true
      }
    };
  }

  const api = stripe.value;

  const result = await api.request({
    path: '/payment_intents',
    method: 'POST',
    body: {
      amount: Math.round(amount * 100), // Convert to cents
      currency,
      customer: customerId
    },
    headers: {
      'Authorization': `Bearer ${process.env.STRIPE_API_KEY || ''}`
    },
    expectedCodes: [HTTP_OK, HTTP_CREATED]
  });

  if (!result.ok) {
    if (result.error.kind === 'unexpected_status') {
      const status = result.error.statusCode;
      const body = result.error.body as Record<string, unknown>;

      if (status === 402) {
        return {
          ok: false,
          error: {
            kind: 'insufficient_funds' as const,
            message: body.message as string || 'Insufficient funds',
            retryable: false
          }
        };
      }
      if (status === 400) {
        const errorType = (body.error as Record<string, unknown>)?.type;
        if (errorType === 'card_error') {
          return {
            ok: false,
            error: {
              kind: 'invalid_card' as const,
              message: (body.error as Record<string, unknown>)?.message as string || 'Invalid card',
              retryable: false
            }
          };
        }
      }
      if (status === 429) {
        return {
          ok: false,
          error: {
            kind: 'rate_limit' as const,
            message: 'Rate limited by Stripe',
            retryable: true
          }
        };
      }
    }

    return {
      ok: false,
      error: {
        kind: 'service_error' as const,
        message: `Stripe request failed: ${result.error.kind}`,
        retryable: result.error.kind === 'timeout' || result.error.kind === 'fetch_failed'
      }
    };
  }

  const intent = result.value as Record<string, unknown>;

  return {
    ok: true,
    value: {
      transactionId: intent.id as string,
      amount: (intent.amount as number) / 100,
      status: (intent.status as string) === 'succeeded' ? 'completed' : 'pending'
    }
  };
}

// ============================================================================
// Example 3: Health Check with Circuit Breaker
// ============================================================================

export interface HealthCheckResult {
  healthy: boolean;
  statusCode: number;
  responseTime: number;
  error?: string;
}

export async function checkServiceHealth(
  endpoint: string
): Promise<HealthCheckResult> {
  const api = createTrembita({
    endpoint,
    timeoutMs: 5000,
    circuitBreaker: {
      failureThreshold: 3,
      cooldownMs: 30000
    }
  });

  if (!api.ok) {
    return {
      healthy: false,
      statusCode: 0,
      responseTime: 0,
      error: `Invalid endpoint: ${api.error.kind}`
    };
  }

  const startTime = Date.now();
  const result = await api.value.client({ path: '/health' });
  const responseTime = Date.now() - startTime;

  if (!result.ok) {
    if (result.error.kind === 'circuit_open') {
      return {
        healthy: false,
        statusCode: 0,
        responseTime,
        error: `Circuit breaker open, retry after ${result.error.retryAfterMs}ms`
      };
    }

    return {
      healthy: false,
      statusCode: 0,
      responseTime,
      error: result.error.kind
    };
  }

  const { statusCode, body } = result.value;
  const healthy = statusCode === 200;

  return {
    healthy,
    statusCode,
    responseTime,
    ...(healthy ? { error: undefined } : { error: String(body) })
  };
}

// ============================================================================
// Example 4: Retryable Operations with Exponential Backoff
// ============================================================================

interface RetryOptions {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
}

export async function requestWithRetry<T>(
  fn: () => Promise<Result<T, TrembitaRequestError>>,
  options: RetryOptions
): Promise<Result<T, TrembitaRequestError>> {
  const { maxAttempts, initialDelayMs, maxDelayMs } = options;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const result = await fn();

    if (result.ok) {
      return result;
    }

    // Only retry on transient errors
    const isTransient =
      result.error.kind === 'timeout' ||
      result.error.kind === 'fetch_failed' ||
      (result.error.kind === 'unexpected_status' && result.error.statusCode >= 500);

    if (!isTransient || attempt === maxAttempts - 1) {
      return result;
    }

    // Exponential backoff with jitter
    const delay = Math.min(
      initialDelayMs * Math.pow(2, attempt) + Math.random() * 100,
      maxDelayMs
    );

    await new Promise(resolve => setTimeout(resolve, delay));
  }

  // Should never reach here
  return {
    ok: false,
    error: {
      kind: 'fetch_failed' as const,
      cause: new Error('All retry attempts exhausted')
    }
  };
}

// Usage example
export async function fetchWithRetries(
  api: TrembitaClient
): Promise<Result<unknown, TrembitaRequestError>> {
  return requestWithRetry(
    () => api.request({ path: '/data', expectedCodes: [HTTP_OK] }),
    {
      maxAttempts: 3,
      initialDelayMs: 100,
      maxDelayMs: 5000
    }
  );
}

// ============================================================================
// Example 5: Structured Error Handling
// ============================================================================

export type AppError =
  | { kind: 'api_error'; statusCode: number; message: string }
  | { kind: 'network_error'; message: string }
  | { kind: 'validation_error'; message: string }
  | { kind: 'timeout_error'; message: string };

export function mapTrembitaError(error: TrembitaRequestError): AppError {
  switch (error.kind) {
    case 'unexpected_status':
      return {
        kind: 'api_error',
        statusCode: error.statusCode,
        message: `API returned ${error.statusCode}`
      };

    case 'timeout':
      return {
        kind: 'timeout_error',
        message: `Request timed out after ${error.timeoutMs}ms`
      };

    case 'fetch_failed':
      return {
        kind: 'network_error',
        message: String(error.cause)
      };

    case 'invalid_json':
      return {
        kind: 'validation_error',
        message: 'Invalid JSON in response'
      };

    case 'circuit_open':
      return {
        kind: 'network_error',
        message: 'Service temporarily unavailable'
      };

    default:
      return {
        kind: 'network_error',
        message: `Unknown error: ${error.kind}`
      };
  }
}

// ============================================================================
// Example 6: Testing with Mocked Fetch
// ============================================================================

export function createMockFetch(responses: Map<string, Response>) {
  return async (url: string): Promise<Response> => {
    const key = new URL(url).pathname;
    const response = responses.get(key);

    if (!response) {
      return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: { 'content-type': 'application/json' }
      });
    }

    return response;
  };
}

// Example test:
export async function testGitHubClient() {
  const mockResponses = new Map<string, Response>([
    [
      '/users/octocat',
      new Response(
        JSON.stringify({
          login: 'octocat',
          id: 1,
          avatar_url: 'https://avatars.githubusercontent.com/u/1?v=4',
          repos_url: 'https://api.github.com/users/octocat/repos'
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' }
        }
      )
    ]
  ]);

  const api = createTrembita({
    endpoint: 'https://api.github.com',
    fetchImpl: createMockFetch(mockResponses) as typeof fetch
  });

  if (api.ok) {
    const result = await api.value.request({
      path: '/users/octocat',
      expectedCodes: [HTTP_OK]
    });

    console.log('Test passed:', result.ok);
  }
}

// ============================================================================
// Example 7: Observable API with Logging
// ============================================================================

export function createObservableAPI(endpoint: string) {
  const api = createTrembita({
    endpoint,
    log: {
      debug: (event, details) => {
        console.log(`[DEBUG] ${event}`, details);
      },
      info: (event, details) => {
        console.log(`[INFO] ${event}`, details);
      },
      warn: (event, details) => {
        console.warn(`[WARN] ${event}`, details);
      },
      error: (event, details) => {
        console.error(`[ERROR] ${event}`, details);
      }
    }
  });

  if (!api.ok) {
    throw new Error(`Failed to create API: ${api.error.kind}`);
  }

  return api.value;
}

// Emits logs like:
// [DEBUG] request:start { endpoint: '...', path: '/users', method: 'GET', headers: {...} }
// [INFO] request:success { endpoint: '...', path: '/users', statusCode: 200, durationMs: 125 }

export default {
  GitHubAPIClient,
  createPaymentIntent,
  checkServiceHealth,
  requestWithRetry,
  mapTrembitaError,
  createMockFetch,
  createObservableAPI
};
