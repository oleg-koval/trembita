# Trembita Quick Start (2 minutes)

## What is Trembita?

A **lightweight TypeScript HTTP client** that handles errors safely without exceptions:
- ✅ `Result<T, E>` instead of try/catch
- ✅ Zero dependencies (stdlib fetch only)
- ✅ Type-safe error handling
- ✅ Works in Node 20+ and browsers

## Install

```bash
npm install trembita
```

## 1️⃣ Create a client

```typescript
import { createTrembita, HTTP_OK } from 'trembita';

const api = createTrembita({ endpoint: 'https://api.github.com' });
if (!api.ok) throw api.error; // Validate endpoint

const client = api.value;
```

## 2️⃣ Make a request

```typescript
const result = await client.request({
  path: '/users/torvalds',
  expectedCodes: [HTTP_OK]
});
```

## 3️⃣ Handle the result

```typescript
if (result.ok) {
  // ✅ Success
  console.log(result.value); // Parsed JSON
} else {
  // ❌ Failure
  console.error(result.error.kind); // e.g., 'fetch_failed'
}
```

## Common Patterns

### POST request
```typescript
await client.request({
  path: '/repos',
  method: 'POST',
  body: { name: 'my-repo' },
  expectedCodes: [201]
});
```

### With query params
```typescript
await client.request({
  path: '/search',
  query: { q: 'typescript', limit: '10' }
});
```

### With headers
```typescript
await client.request({
  path: '/me',
  headers: { 'Authorization': `Bearer ${token}` }
});
```

### With retries
```typescript
import { createRetryingFetch } from 'trembita';

const retries = createRetryingFetch({
  initialDelayMs: 100,
  maxAttempts: 3,
  shouldRetry: (statusCode) => statusCode >= 500
});

const api = createTrembita({
  endpoint: '...',
  fetchImpl: retries
});
```

### With circuit breaker
```typescript
const api = createTrembita({
  endpoint: '...',
  circuitBreaker: {
    failureThreshold: 5,
    cooldownMs: 60_000
  }
});
```

### Testing (no global mocks)
```typescript
const mockFetch = vi.fn(() =>
  Promise.resolve(new Response(JSON.stringify({ id: 1 }), { status: 200 }))
);

const api = createTrembita({
  endpoint: '...',
  fetchImpl: mockFetch
});
```

## Error Types

| Error | Meaning |
|-------|---------|
| `missing_endpoint` | No endpoint in options |
| `endpoint_invalid_url` | Endpoint URL is malformed |
| `fetch_failed` | Network error |
| `timeout` | Request exceeded timeout |
| `unexpected_status` | Status not in expectedCodes |
| `invalid_json` | Response isn't JSON |
| `circuit_open` | Circuit breaker triggered |

## Key Differences from Other Clients

| Feature | Trembita | Axios | Node-fetch | `fetch` |
|---------|----------|-------|-----------|---------|
| Zero deps | ✅ | ❌ | ❌ | ✅ |
| Result<T,E> | ✅ | ❌ | ❌ | ❌ |
| Retries built-in | ✅ | ❌ | ❌ | ❌ |
| Circuit breaker | ✅ | ❌ | ❌ | ❌ |
| Injectable fetch | ✅ | ❌ | N/A | N/A |
| TypeScript first | ✅ | ❌ | ❌ | ✅ |
| ESM only | ✅ | ❌ | ✅ | ✅ |
| Tiny bundle | ✅ | ❌ | ❌ | ✅ |

## Learn More

- 📖 [LEARNING_GUIDE.md](./LEARNING_GUIDE.md) — Deep dive into concepts
- 💡 [EXAMPLES.md](./EXAMPLES.md) — 7+ real-world use cases
- 📝 [examples/](./examples/) — Copy-paste starter code
- 🔗 [API Docs](https://oleg-koval.github.io/trembita/) — Full reference

## FAQ

**Q: Why no exceptions?**  
A: Exceptions hide error paths. `Result` forces you to handle both success and failure.

**Q: Can I use in the browser?**  
A: Yes! ESM + bundler (Vite, webpack, esbuild) + global `fetch` and `URL`.

**Q: How do I add logging?**  
A: Pass a `log` option with trace/debug/info/warn/error methods.

**Q: Can I compose helpers?**  
A: Yes! Wrap request options or inject custom `fetchImpl` for middleware.

**Q: Does it do GraphQL?**  
A: No, it's REST-focused. For GraphQL, use `@apollo/client` or `graphql-request`.

---

**Start here:** [LEARNING_GUIDE.md](./LEARNING_GUIDE.md)  
**See examples:** [EXAMPLES.md](./EXAMPLES.md)  
**Copy starter code:** [examples/](./examples/)
