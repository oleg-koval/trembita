# Trembita Architecture & Design

A visual guide to how trembita works and how to integrate it.

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Your Application                        │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                     createTrembita()                            │
│  ✓ Validates endpoint (URL)                                     │
│  ✓ Returns Result<TrembitaClient, TrembitaInitError>           │
└────────────────────┬────────────────────────────────────────────┘
                     │
        ┌────────────┴────────────┐
        ▼                         ▼
   ✅ Ok: client              ❌ Error
   (ready to use)         (handle & throw)
        │
        ▼
┌─────────────────────────────────────────────────────────────────┐
│                    client.request(opts)                         │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ 1. Validate options (path/url, headers, body)              ││
│  │ 2. Build URL (endpoint + path + query params)              ││
│  │ 3. Serialize body (JSON)                                   ││
│  │ 4. Apply headers + tracing headers (optional)              ││
│  │ 5. Check circuit breaker status                            ││
│  │ 6. Call fetchImpl with Request                             ││
│  │    ├─ Default: globalThis.fetch                           ││
│  │    ├─ Custom: createRetryingFetch (retries with backoff)  ││
│  │    └─ Test: vi.fn() or mock                               ││
│  │ 7. Handle response                                        ││
│  │    ├─ Parse JSON                                          ││
│  │    ├─ Check status code                                   ││
│  │    └─ Return raw { statusCode, body } or ❌ error        ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│  Returns: Promise<Result<unknown, TrembitaRequestError>>       │
└─────────────────────────────────────────────────────────────────┘
                     │
        ┌────────────┴────────────┐
        ▼                         ▼
   ✅ Ok: parsed                ❌ Error: one of
   JSON value            - fetch_failed
                         - timeout
                         - invalid_json
                         - unexpected_status
                         - circuit_open
                         - (others)
        │
        └─────────────────────────────► Application handles both paths
```

---

## Request Pipeline

### From Request to Response

```
Request Options
    │
    ├─ path: '/users/123'
    ├─ query: { limit: 10 }
    ├─ headers: { Authorization: '...' }
    ├─ body: { name: 'Alice' }
    ├─ expectedCodes: [200, 201]
    └─ timeoutMs: 5000
    │
    ▼
Validation Layer
    ├─ path or url? (one required)
    ├─ headers are Record<string, string>?
    ├─ body is serializable to JSON?
    └─ expectedCodes is number[]?
    │
    ▼
URL Building
    ├─ Start: endpoint ('https://api.example.com')
    ├─ Add path ('/users/123')
    ├─ Append query ('?limit=10')
    └─ Result: 'https://api.example.com/users/123?limit=10'
    │
    ▼
Headers Setup
    ├─ Merge provided headers
    ├─ Add Content-Type: application/json (if body)
    ├─ Add tracing headers (W3C traceparent, if enabled)
    ├─ Redact sensitive headers in logs
    └─ Result: final headers object
    │
    ▼
Circuit Breaker Check
    ├─ Too many failures?
    │  └─ YES: reject with 'circuit_open' error
    └─ NO: continue
    │
    ▼
Fetch (with optional retry)
    ├─ Call fetchImpl (default: globalThis.fetch)
    │  │
    │  └─ If createRetryingFetch:
    │     ├─ Retry on 5xx? YES
    │     ├─ Retry on network error? YES
    │     ├─ Exponential backoff (100ms → 200ms → 400ms...)
    │     └─ Stop after maxAttempts
    │
    ├─ Timeout? NO ──────────────┐
    │                             │
    │ Network error? NO ──────────┤
    │                             │
    ▼                             │
Response Received                 │
    ├─ Status code?               │
    ├─ Body (raw)                 │
    │                             │
    ├─ Parse JSON?                │
    │  ├─ NO: invalid_json ──────────┐
    │  └─ YES: continue              │
    │                                │
    ├─ Status in expectedCodes?      │
    │  ├─ YES: return { ok: true, value: body }
    │  └─ NO: unexpected_status ──────────┐
    │                                      │
    └──────────────────────────────────────┼─────────────┐
                                           │             │
                      Return Result        ▼             ▼
                    ┌─────────────────────────────────────────┐
                    │  { ok: false, error: { kind, ... } }   │
                    └─────────────────────────────────────────┘
```

---

## Error Handling Flow

Every operation returns `Result<Success, Failure>`:

```
Promise<Result<unknown, TrembitaRequestError>>
                        │
                        ├─ fetch_failed
                        │  └─ cause: Error (DNS, connection reset, etc.)
                        │
                        ├─ timeout
                        │  └─ requestedMs: number
                        │
                        ├─ circuit_open
                        │  └─ failureCount: number
                        │
                        ├─ invalid_json
                        │  └─ cause: Error (JSON.parse failed)
                        │
                        ├─ unexpected_status
                        │  ├─ statusCode: number
                        │  └─ expectedCodes: number[]
                        │
                        └─ invalid_request_options
                           └─ (path missing, etc.)
```

**Example error narrowing:**

```typescript
const result = await client.request({ path: '/' });

if (result.ok) {
  // result.value is the JSON
  console.log(result.value);
} else {
  // result.error is the failure
  switch (result.error.kind) {
    case 'fetch_failed':
      console.error('Network:', result.error.cause);
      break;
    case 'unexpected_status':
      console.error('HTTP', result.error.statusCode);
      break;
    default:
      console.error('Other:', result.error.kind);
  }
}
```

---

## Feature Matrix

| Feature | Default | Optional | Notes |
|---------|---------|----------|-------|
| **Fetch implementation** | `globalThis.fetch` | Custom `fetchImpl` | Inject for testing or retries |
| **Retries** | None | `createRetryingFetch()` | Exponential backoff on 5xx |
| **Circuit breaker** | Disabled | `circuitBreaker: {...}` | Fail fast after N failures |
| **Timeout** | Infinite | `timeoutMs: 5000` | Per-request override possible |
| **Logging** | Silent | `log: {...}` | trace/debug/info/warn/error |
| **Tracing** | None | `traceContextHeaders()` | W3C traceparent injection |
| **Validation** | Standard Schema | `requestWithStandardSchema()` | Zod, Valibot, etc. |

---

## Integration Patterns

### Pattern 1: Simple REST Client

```
createTrembita()
    │
    └─ client.request() ──► Result
                             │
                             └─ if (!result.ok) { /* handle */ }
```

### Pattern 2: With Retries

```
createRetryingFetch() ──┐
                        │
createTrembita()◄───────┘
    │
    └─ client.request() ──► Result (auto-retried on 5xx)
```

### Pattern 3: With Circuit Breaker

```
createTrembita({ circuitBreaker: {...} })
    │
    └─ client.request() ──► Result
                             │
                             └─ error.kind === 'circuit_open'
                                (fail fast after N failures)
```

### Pattern 4: Full Stack

```
createRetryingFetch()
        │
        ├─ Retries on 5xx
        │
createTrembita({
  fetchImpl: retrying,
  circuitBreaker: {...},     ──► Fast fail after N failures
  timeoutMs: 10000,          ──► Timeout protection
  log: {...}                 ──► Structured logging
})
    │
    └─ client.request() ──► Production-ready
```

### Pattern 5: Testing

```
vi.fn(() => Response)
        │
        └─ fetchImpl
            │
createTrembita()
    │
    └─ client.request() ──► No network, fully controlled
```

---

## Data Flow: From User Input to HTTP

```
User Code
    │
    ├─ createTrembita({ endpoint: 'https://...' })
    │  └─ Validates endpoint
    │
    ├─ client.request({
    │  │  path: '/users/123',
    │  │  query: { limit: 10 },
    │  │  headers: { Authorization: '...' },
    │  │  body: { name: 'Alice' }
    │  │})
    │  │
    │  ├─ Validates all options
    │  ├─ Builds URL
    │  ├─ Serializes body to JSON
    │  ├─ Merges headers
    │  │
    │  ├─ Check circuit breaker
    │  ├─ Call fetchImpl (with optional retries)
    │  │
    │  ├─ Parse response JSON
    │  ├─ Check status code
    │  │
    │  └─ Return Result<unknown, TrembitaRequestError>
    │
    └─ Handle result
       ├─ if (result.ok) { /* success */ }
       └─ else { /* handle error.kind */ }
```

---

## Module Structure

```
src/
├─ index.ts              ◄─ Public exports
│
├─ trembita.ts           ◄─ createTrembita, client, request
│
├─ result.ts             ◄─ Result<T,E> type + helpers
│
├─ errors.ts             ◄─ Error discriminated unions (types only)
│
├─ validate.ts           ◄─ Options validation, Logger type
│
├─ retryingFetch.ts      ◄─ createRetryingFetch
│
├─ standardSchema.ts     ◄─ validateStandardSchema
│
├─ requestWithStandardSchema.ts ◄─ Validation + fetch combined
│
├─ tracing.ts            ◄─ traceContextHeaders (W3C)
│
└─ url.ts                ◄─ URL building helpers
```

---

## Design Principles

### 1. **Functional API**
- Factory functions (`createTrembita`) not classes
- Pure helpers for validation and building
- No method chaining

### 2. **Result<T, E> Everywhere**
- No exceptions for operational errors
- Errors are data (discriminated unions)
- Callers must handle both paths

### 3. **Zero Dependencies**
- Only `fetch` and `URL` from platform
- All validation inline
- No version conflicts

### 4. **Testability**
- Inject `fetchImpl` to swap fetch
- No global state to mock
- Deterministic and composable

### 5. **Type Safety**
- `strict` TypeScript
- No `any`
- `unknown` at JSON boundaries

---

## When to Use Each Feature

| Feature | When | Example |
|---------|------|---------|
| **Basic request** | Simple API calls | `client.request({ path: '/' })` |
| **Retries** | Flaky or overloaded API | Payment processors, search engines |
| **Circuit breaker** | Dependent services | Microservice-to-microservice |
| **Timeout** | Unresponsive upstream | External APIs, batch jobs |
| **Logging** | Debugging or ops | Production logging for tracing |
| **Tracing** | Distributed systems | OpenTelemetry integration |
| **Validation** | Untrusted responses | Third-party APIs |

---

## Example: Full Lifecycle

```typescript
// 1. Initialize (once)
const api = createTrembita({
  endpoint: 'https://api.stripe.com/v1',
  fetchImpl: createRetryingFetch({ maxAttempts: 3 }),
  circuitBreaker: { failureThreshold: 5, cooldownMs: 60_000 },
  timeoutMs: 10_000,
  log: console
});

if (!api.ok) throw new Error('Stripe config failed');

const client = api.value;

// 2. Request (many times)
const result = await client.request({
  path: '/charges',
  method: 'POST',
  headers: { 'Authorization': `Bearer ${STRIPE_KEY}` },
  body: { amount: 2000, currency: 'usd' },
  expectedCodes: [200]
});

// 3. Handle result
if (result.ok) {
  console.log('Charge created:', result.value);
} else {
  console.error('Charge failed:', result.error.kind);
  // Retries already tried
  // Circuit breaker already checked
  // Timeout already enforced
}
```

Every part is explicit and testable.
