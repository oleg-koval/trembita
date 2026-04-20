# Trembita Examples

Copy-paste-ready code examples for common use cases. Each file is a self-contained, runnable example.

## Quick Navigation

| File | Purpose | Level |
|------|---------|-------|
| **[rest-api-client.ts](./rest-api-client.ts)** | Complete CRUD client for a REST API | Beginner |
| **[testing-with-mock-fetch.test.ts](./testing-with-mock-fetch.test.ts)** | Unit test patterns without network mocking | Beginner |
| **[resilience-patterns.ts](./resilience-patterns.ts)** | Retries, circuit breaker, fallbacks, bulkheads | Intermediate |

---

## 1. REST API Client

**File:** `rest-api-client.ts`

A complete, typed client for a TODO API with CRUD operations.

**Covers:**
- Creating a client with options validation
- GET requests with response handling
- POST requests with body serialization
- PATCH/DELETE requests
- Error mapping to user-friendly messages
- Status code branching (404 vs network errors)

**Key patterns:**
```typescript
// Create client once
const api = createTrembita({ endpoint: '...' });
if (!api.ok) throw api.error;

const client = api.value;

// Type your responses
async function listTodos(): ApiResult<TodoItem[]> {
  const result = await client.request({ path: '/todos' });
  if (!result.ok) return { data: null, error: '...' };
  return { data: result.value, error: null };
}
```

**Run it:**
```bash
npx ts-node examples/rest-api-client.ts
```

---

## 2. Testing with Mock Fetch

**File:** `testing-with-mock-fetch.test.ts`

Comprehensive vitest examples showing how to test your API integrations.

**Covers:**
- Mock fetch for success/failure scenarios
- Testing request validation
- Verifying headers and body encoding
- Batch request handling
- Query parameter encoding

**Key patterns:**
```typescript
// No global mocking — inject via options
const mockFetch = vi.fn(() =>
  Promise.resolve(new Response(JSON.stringify({}), { status: 200 }))
);

const api = createTrembita({
  endpoint: 'https://api.example.com',
  fetchImpl: mockFetch  // ← Inject here
});

// Verify behavior
expect(mockFetch).toHaveBeenCalledWith(
  'https://api.example.com/users/1',
  expect.any(Object)
);
```

**Run tests:**
```bash
npm test examples/testing-with-mock-fetch.test.ts
```

---

## 3. Resilience Patterns

**File:** `resilience-patterns.ts`

Advanced patterns for building robust clients that handle failures gracefully.

**Covers:**

### 3.1 Exponential Backoff Retries
Automatically retry transient failures (5xx, timeouts) with increasing delays.

```typescript
const retryingFetch = createRetryingFetch({
  initialDelayMs: 100,
  maxAttempts: 5,
  shouldRetry: (statusCode) => statusCode >= 500
});
```

### 3.2 Circuit Breaker
Stop hammering a failing service — return errors quickly after N failures.

```typescript
createTrembita({
  circuitBreaker: {
    failureThreshold: 5,
    cooldownMs: 60_000
  }
});
```

### 3.3 Fallback Chain
Try primary API, then secondary, then cache.

```typescript
const result = await requestWithFallback(config, '/data');
// Returns { data, source: 'primary' | 'secondary' | 'cache' }
```

### 3.4 Bulkhead Isolation
Limit concurrent requests to prevent overwhelming upstream.

```typescript
const bulkhead = new BulkheadClient(client, 10); // Max 10 concurrent
await bulkhead.request({ path: '/data' });
```

### 3.5 Adaptive Timeouts
Increase timeout on retry to handle slow responses.

```typescript
const data = await requestWithAdaptiveTimeout(client, '/endpoint', {
  initialTimeoutMs: 3_000,
  maxTimeoutMs: 30_000,
  retryCount: 3
});
```

### 3.6 Full Stack
Combine retries + circuit breaker + timeout + logging.

```typescript
const api = createFullStackResilientClient('https://api.example.com');
// Single call gets all resilience features automatically
```

### 3.7 Health-Aware Client Pool
Select the healthiest endpoint from multiple options.

```typescript
const pool = new HealthAwareClientPool([
  'https://api-1.example.com',
  'https://api-2.example.com'
]);
const result = await pool.request({ path: '/data' });
```

---

## How to Use These Examples

### Option 1: Copy and adapt
1. Copy the file that matches your use case
2. Replace `endpoint`, API paths, and types with your own
3. Run with `npx ts-node file.ts`

### Option 2: Reference for patterns
1. Skim the examples to understand patterns
2. Refer back when building your own client

### Option 3: Test against real APIs
Most examples use public APIs (GitHub, JSONPlaceholder) or mock fetch:
```bash
# Requires no credentials
npx ts-node examples/rest-api-client.ts
```

---

## Common Questions

**Q: Should I copy these files into my project?**  
A: No. Use them as reference and write your own. Your API likely has different endpoints and response shapes.

**Q: Can I combine patterns?**  
A: Yes! See `createFullStackResilientClient` which combines retries + circuit breaker + timeout + logging.

**Q: Do I need all these patterns?**  
A: Start simple. Add resilience patterns only when you hit issues (retries for flaky APIs, circuit breaker for dependent services, etc.).

**Q: How do I test my client?**  
A: See `testing-with-mock-fetch.test.ts` — inject `fetchImpl` to avoid network calls in tests.

---

## Next Steps

- **[LEARNING_GUIDE.md](../LEARNING_GUIDE.md)** — Deep dive into concepts
- **[EXAMPLES.md](../EXAMPLES.md)** — More use-case examples
- **[API Docs](https://oleg-koval.github.io/trembita/)** — Full type signatures
- **[SPEC.md](../SPEC.md)** — Design decisions
