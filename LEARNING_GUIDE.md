# Trembita Learning Guide

Learn to build type-safe, error-handling HTTP clients with **trembita** — from basics to advanced patterns.

## Table of Contents

1. [Core Concepts](#core-concepts)
2. [Getting Started](#getting-started)
3. [The Result Pattern](#the-result-pattern)
4. [Building a Client](#building-a-client)
5. [Error Handling](#error-handling)
6. [Advanced Features](#advanced-features)
7. [Testing](#testing)
8. [Common Patterns](#common-patterns)

---

## Core Concepts

Trembita enforces **three principles**:

### 1. **Functional API (no classes)**
Instead of `new Client()`, you call factory functions:
```typescript
const result = createTrembita({ endpoint: '...' });
```

### 2. **`Result<T, E>` for errors (no exceptions)**
Every operation returns either `{ ok: true, value }` or `{ ok: false, error }`. No `try/catch` for normal HTTP outcomes:
```typescript
const response = await client.request({ path: '/' });
if (!response.ok) {
  // handle response.error.kind
}
```

### 3. **Stdlib-first (zero dependencies)**
Uses only `fetch` and `URL` from Node/browser. Inject your own `fetchImpl` for testing—no global mocking.

---

## Getting Started

### Install
```bash
npm install trembita
```

### Minimal example (1 minute)
```typescript
import { createTrembita, HTTP_OK } from 'trembita';

// Create a client bound to a base URL
const api = createTrembita({ endpoint: 'https://api.github.com' });
if (!api.ok) throw api.error; // Init error

// Make a request
const repos = await api.value.request({
  path: '/users/octocat/repos',
  expectedCodes: [HTTP_OK]
});

// Handle the result
if (repos.ok) {
  console.log(repos.value); // parsed JSON
} else {
  console.error(repos.error.kind); // e.g. 'fetch_failed'
}
```

**3 key steps:**
1. `createTrembita()` → validates options, returns `Result`
2. `.request()` → `Promise<Result<unknown, TrembitaRequestError>>`
3. Check `.ok` to narrow the type

---

## The Result Pattern

### What is `Result<T, E>`?

A simple discriminated union that forces you to handle both success and failure:

```typescript
type Result<T, E> =
  | { ok: true; value: T }
  | { ok: false; error: E };
```

**Why?** TypeScript narrows the type when you check `.ok`:
```typescript
const r = await client.request({ path: '/' });

if (r.ok) {
  // TypeScript knows r.value exists
  console.log(r.value.length);
} else {
  // TypeScript knows r.error exists
  if (r.error.kind === 'fetch_failed') {
    console.error('Network error:', r.error.cause);
  }
}
```

### Extracting values safely

```typescript
// Option 1: if/else
if (result.ok) {
  doSomething(result.value);
} else {
  console.error(result.error.kind);
}

// Option 2: switch on error.kind
switch (result.error.kind) {
  case 'unexpected_status':
    console.error('HTTP', result.error.statusCode);
    break;
  case 'fetch_failed':
    console.error('Network:', result.error.cause);
    break;
  // TypeScript requires all cases or a default
}

// Option 3: throw if you must
if (!result.ok) throw new Error(result.error.kind);
const data = result.value;
```

### Common Error Kinds

| kind                 | Meaning                          | Example                        |
| -------------------- | -------------------------------- | ------------------------------ |
| `missing_endpoint`   | No endpoint in options           | `createTrembita({})`           |
| `endpoint_invalid_url` | Endpoint URL is malformed        | `endpoint: 'not a url'`        |
| `invalid_request_options` | Missing path or invalid query | `request({ query: 123 })`      |
| `fetch_failed`       | Network error (DNS, timeout)     | Connection reset               |
| `timeout`            | Request exceeded `timeoutMs`    | Exceeded 30s                   |
| `invalid_json`       | Response body isn't JSON         | Response is HTML               |
| `unexpected_status`  | Status not in `expectedCodes`    | Got 404, expected 200          |

---

## Building a Client

### Step 1: Create and validate
```typescript
import { createTrembita, HTTP_OK, HTTP_CREATED } from 'trembita';

const githubApi = createTrembita({
  endpoint: 'https://api.github.com'
});

if (!githubApi.ok) {
  throw new Error(`Bad endpoint: ${githubApi.error.kind}`);
}

const client = githubApi.value; // now safe to use
```

### Step 2: Define request helpers
```typescript
// Encapsulate common patterns
async function getUser(username: string) {
  return client.request({
    path: `/users/${username}`,
    expectedCodes: [HTTP_OK]
  });
}

async function createIssue(repo: string, title: string, body: string) {
  return client.request({
    path: `/repos/octocat/${repo}/issues`,
    method: 'POST',
    headers: { 'Authorization': `Bearer ${process.env.GH_TOKEN}` },
    body: { title, body },
    expectedCodes: [HTTP_CREATED]
  });
}
```

### Step 3: Call and handle
```typescript
const user = await getUser('octocat');

if (user.ok) {
  console.log('Login:', user.value.login);
} else if (user.error.kind === 'unexpected_status' && user.error.statusCode === 404) {
  console.log('User not found');
} else {
  console.error('Request failed:', user.error.kind);
}
```

### Step 4: Type the response (optional)
```typescript
type GitHubUser = { login: string; id: number };

async function getUser(username: string): Promise<Result<GitHubUser, TrembitaRequestError>> {
  const result = await client.request({
    path: `/users/${username}`,
    expectedCodes: [HTTP_OK]
  });

  // Optionally validate with Standard Schema (see Advanced Features)
  return result;
}
```

---

## Error Handling

### Health checks and monitoring
When you need raw status codes:

```typescript
const health = await client.client({ path: '/health' });

if (health.ok) {
  const { statusCode, body } = health.value;
  if (statusCode === 200) {
    console.log('Service healthy');
  } else {
    console.log('Degraded:', body);
  }
} else {
  console.error('Health check failed:', health.error.kind);
}
```

### Retry logic
Use `createRetryingFetch` to wrap fetch with exponential backoff:

```typescript
import { createRetryingFetch } from 'trembita';

const retryingFetch = createRetryingFetch({
  initialDelayMs: 100,
  maxAttempts: 3,
  shouldRetry: (statusCode) => statusCode >= 500 // Retry 5xx only
});

const api = createTrembita({
  endpoint: 'https://api.example.com',
  fetchImpl: retryingFetch
});
```

### Circuit breaker pattern
Prevent cascading failures:

```typescript
const api = createTrembita({
  endpoint: 'https://api.example.com',
  circuitBreaker: {
    failureThreshold: 5,    // open after 5 failures
    cooldownMs: 30_000      // retry after 30s
  }
});

// Later, when circuit is open:
const response = await api.value.request({ path: '/' });
if (!response.ok && response.error.kind === 'circuit_open') {
  // Service is temporarily unavailable
  console.log('Backing off...');
}
```

### Logging
Enable structured logging:

```typescript
const api = createTrembita({
  endpoint: 'https://api.example.com',
  log: {
    trace: (msg, meta) => console.log('[TRACE]', msg, meta),
    debug: (msg, meta) => console.log('[DEBUG]', msg, meta),
    info: (msg, meta) => console.log('[INFO]', msg, meta),
    warn: (msg, meta) => console.warn('[WARN]', msg, meta),
    error: (msg, meta) => console.error('[ERROR]', msg, meta)
  }
});
```

Logs are automatically redacted (auth headers, cookies, API keys hidden).

---

## Advanced Features

### 1. Standard Schema Validation

Validate response bodies at parse time:

```typescript
import { requestWithStandardSchema, validateStandardSchema } from 'trembita';
import { z } from 'zod';

const userSchema = z.object({
  id: z.number(),
  name: z.string(),
  email: z.string().email()
});

// Validate response body
const result = await requestWithStandardSchema(client, {
  path: '/users/123',
  schema: userSchema,
  expectedCodes: [HTTP_OK]
});

if (result.ok) {
  // result.value is typed as Zod schema type
  console.log(result.value.email);
} else if (result.error.kind === 'validation_failed') {
  console.error('Invalid response:', result.error.cause);
}
```

### 2. W3C Trace Context (Distributed Tracing)

Build OpenTelemetry headers:

```typescript
import { traceContextHeaders } from 'trembita';

const headers = traceContextHeaders({
  traceId: '4bf92f3577b34da6a3ce929d0e0e4736',
  spanId: '00f067aa0ba902b7',
  traceFlags: '01',
  traceState: 'congo=t61rcZ94t8w25c'
});

const response = await client.request({
  path: '/api/resource',
  headers // propagates trace to downstream service
});
```

### 3. OpenAPI paths (optional @trembita/openapi)

Generate type-safe paths from OpenAPI specs:

```typescript
import { expandOpenapiPath } from '@trembita/openapi';

// paths comes from `openapi-typescript`
// type paths = { '/users/{id}': {...}, ... }

const expanded = expandOpenapiPath(paths, '/users/{id}', { id: '123' });
// → '/users/123'

if (expanded.ok) {
  const result = await client.request({
    path: expanded.value, // type-safe!
    expectedCodes: [HTTP_OK]
  });
}
```

---

## Testing

### Inject a mock fetch

No global mocking needed:

```typescript
import { vi } from 'vitest';
import { createTrembita, HTTP_OK } from 'trembita';

const mockFetch = vi.fn(() =>
  Promise.resolve(new Response(JSON.stringify({ id: 1 }), { status: 200 }))
);

const api = createTrembita({
  endpoint: 'https://api.test.com',
  fetchImpl: mockFetch
});

const result = await api.value.request({
  path: '/items',
  expectedCodes: [HTTP_OK]
});

expect(result.ok).toBe(true);
expect(mockFetch).toHaveBeenCalledWith('https://api.test.com/items', expect.any(Object));
```

### Test error paths

```typescript
const mockFetch = vi.fn(() =>
  Promise.reject(new Error('DNS failure'))
);

const api = createTrembita({
  endpoint: 'https://api.test.com',
  fetchImpl: mockFetch
});

const result = await api.value.request({ path: '/' });

expect(result.ok).toBe(false);
expect(result.error.kind).toBe('fetch_failed');
```

### Test expected status codes

```typescript
const mockFetch = vi.fn(() =>
  Promise.resolve(new Response('Not found', { status: 404 }))
);

const result = await api.value.request({
  path: '/missing',
  expectedCodes: [200, 201]
});

expect(result.ok).toBe(false);
expect(result.error.kind).toBe('unexpected_status');
expect(result.error.statusCode).toBe(404);
```

---

## Common Patterns

### Pattern 1: Typed REST client

```typescript
import { createTrembita, HTTP_OK, TrembitaRequestError } from 'trembita';

// Define domain types
type User = { id: number; name: string };
type CreateUserPayload = Omit<User, 'id'>;

// Define Result type for clarity
type ApiResult<T> = Promise<Result<T, TrembitaRequestError>>;

class UserApi {
  constructor(private client: TrembitaClient) {}

  getUser(id: number): ApiResult<User> {
    return this.client.request({
      path: `/users/${id}`,
      expectedCodes: [HTTP_OK]
    });
  }

  createUser(payload: CreateUserPayload): ApiResult<User> {
    return this.client.request({
      path: '/users',
      method: 'POST',
      body: payload,
      expectedCodes: [HTTP_CREATED]
    });
  }
}

// Usage
const api = createTrembita({ endpoint: 'https://api.example.com' });
if (!api.ok) throw api.error;

const users = new UserApi(api.value);
const user = await users.getUser(1);
```

### Pattern 2: Fallback cascade

```typescript
async function fetchWithFallback() {
  let result = await primaryApi.request({ path: '/data' });

  if (!result.ok && result.error.kind === 'fetch_failed') {
    // Primary API is down, try backup
    result = await backupApi.request({ path: '/data' });
  }

  return result;
}
```

### Pattern 3: Request middleware

```typescript
async function withAuth(
  path: string,
  token: string
) {
  return client.request({
    path,
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
}

// Usage
const data = await withAuth('/protected', process.env.API_TOKEN);
```

### Pattern 4: Batch requests

```typescript
async function fetchUsers(ids: number[]) {
  const results = await Promise.all(
    ids.map(id => client.request({
      path: `/users/${id}`,
      expectedCodes: [HTTP_OK, 404]
    }))
  );

  const users = results
    .filter(r => r.ok)
    .map(r => r.value);

  const notFound = results
    .filter(r => !r.ok && r.error.kind === 'unexpected_status')
    .map((r, i) => ids[i]);

  return { users, notFound };
}
```

---

## Next Steps

- **Browse [examples/](../examples/)** for real-world use cases
- **Check [API docs](https://oleg-koval.github.io/trembita/)** for full type signatures
- **Read [CONTRIBUTING.md](../CONTRIBUTING.md)** if you want to contribute
- **See [SPEC.md](../SPEC.md)** for design decisions

---

## FAQ

**Q: Why `Result` instead of exceptions?**  
A: Exceptions hide error cases. `Result` forces you to handle both paths at compile time, making bugs rarer.

**Q: Can I use this in the browser?**  
A: Yes—it's ESM and works with any bundler (Vite, webpack, esbuild). Global `fetch` and `URL` required.

**Q: Why no middleware?**  
A: Simple functions are more composable. Wrap `fetchImpl` for retries, or compose request helpers for auth.

**Q: Can I use this with REST frameworks?**  
A: Yes. trembita is a **client**, not a server. Use with Next.js, Express, Fastify, etc. to consume APIs.

**Q: How do I add custom logic between requests?**  
A: Inject a custom `fetchImpl` that wraps the real fetch, or compose request helpers with shared logic.
