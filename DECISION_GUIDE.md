# Decision Guide: Is Trembita Right for You?

Helps you decide if trembita is the best HTTP client for your use case.

## Quick Yes/No Decision Tree

````text
Start Here
│
├─ Building a TypeScript project? ─────────┐
│  No                                       │ Yes
│                                            ▼
│                                    Using Node 20+?
│                                    or browser bundler?
│                                            │
│  No ────────────────────────────────────┐  │ Yes
│                                          │  │
│                                          ▼  ▼
│                                    Want type-safe
│                                    error handling
│                                    without exceptions?
│                                            │
│  No ────────────┐                        │ Yes
│                 │                         │
│                 ▼                         ▼
│           Use something else ◄─────  ✅ TREMBITA
│                                      (Perfect fit!)
│
└─────────────────────────────────────────────────┘
```text

---

## Feature Checklist

### Must-Haves for Trembita

- ✅ TypeScript project (any framework)
- ✅ Consuming REST APIs
- ✅ Node 20+ or browser with bundler
- ✅ Okay with `Result<T, E>` pattern (no exceptions for normal failures)
- ✅ Want zero dependencies

### Nice-to-Haves (Trembita Has These)

- ✅ Built-in retries with exponential backoff
- ✅ Circuit breaker for resilience
- ✅ Timeout management
- ✅ Structured logging
- ✅ W3C trace context (distributed tracing)
- ✅ Standard Schema validation
- ✅ Easy testing (inject fetch)

### Reasons NOT to Use Trembita

- ❌ Building a JavaScript (non-TypeScript) project
- ❌ Need to support Node < 20
- ❌ Consuming GraphQL APIs
- ❌ Require class-based API
- ❌ Want exceptions for HTTP errors
- ❌ Need cookies/session handling built-in
- ❌ Require file upload shortcuts

---

## Comparison with Alternatives

### vs. Axios

| Aspect | Trembita | Axios |
|--------|----------|-------|
| **Dependencies** | 0 | 4 |
| **Bundle size** | ~3KB | ~60KB |
| **Error handling** | Result<T,E> | Exceptions |
| **TypeScript** | First-class | After-thought |
| **Retries** | Built-in | Via plugin |
| **Circuit breaker** | Built-in | Via plugin |
| **Learning curve** | Shallow | Moderate |
| **Class API** | ❌ Functions | ✅ Classes |
| **Built-in validation** | ✅ Standard Schema | ❌ Manual |
| **Testing** | Inject fetch | Mock globals |

**Choose Axios if:** You want a mature ecosystem or class-based API.
**Choose Trembita if:** You want small, type-safe, zero-dependency.

### vs. Node-Fetch

| Aspect | Trembita | Node-fetch |
|--------|----------|-----------|
| **Dependencies** | 0 | 0 |
| **What it is** | HTTP client | Fetch polyfill |
| **Error handling** | Result<T,E> | Raw fetch |
| **Retries** | ✅ Built-in | ❌ Manual |
| **Circuit breaker** | ✅ Built-in | ❌ Manual |
| **Logging** | ✅ Built-in | ❌ Manual |
| **Learning curve** | Moderate | Shallow |
| **Used for** | Consuming APIs | Polyfilling |

**Choose Node-fetch if:** You just want a fetch polyfill.
**Choose Trembita if:** You want a full HTTP client with batteries.

### vs. Native Fetch

| Aspect | Trembita | Native Fetch |
|--------|----------|------------|
| **Error handling** | Result<T,E> | Try/catch |
| **Retries** | ✅ | Manual |
| **Circuit breaker** | ✅ | Manual |
| **Logging** | ✅ | Manual |
| **Timeout** | ✅ | Manual |
| **Bundle** | ~3KB | 0 |
| **Learning curve** | Shallow | Shallow |

**Choose Fetch if:** You want zero abstractions and minimal dependencies (rarely happens in production).
**Choose Trembita if:** You want production-grade features without a heavy framework.

### vs. Got (Node.js only)

| Aspect | Trembita | Got |
|--------|----------|-----|
| **Dependencies** | 0 | 4+ |
| **Bundle size** | ~3KB | ~60KB |
| **Works in browser** | ✅ | ❌ |
| **Error handling** | Result<T,E> | Exceptions |
| **Retries** | Built-in | Built-in |
| **Timeout** | Built-in | Built-in |
| **Streams** | ❌ | ✅ (NodeJS) |

**Choose Got if:** You need Node-only advanced features (streams).
**Choose Trembita if:** You want isomorphic (Node + browser).

### vs. OpenAPI-Fetch (OpenAPI-only)

| Aspect | Trembita | OpenAPI-Fetch |
|--------|----------|---|
| **Type generation** | Manual | From OpenAPI spec |
| **Path typing** | If using @trembita/openapi | ✅ Auto |
| **Use case** | General REST | OpenAPI only |
| **Error handling** | Result<T,E> | Try/catch |
| **Retries** | Built-in | Manual |

**Choose OpenAPI-Fetch if:** You have an OpenAPI spec and want auto-typed paths.
**Choose Trembita if:** You want general REST + `@trembita/openapi` gives you OpenAPI typing.

---

## Decision Matrix by Scenario

### Scenario 1: SaaS Backend (Node.js)

**Requirements:** Consuming multiple third-party APIs (Stripe, SendGrid, Slack)

```text
Trembita score: 9/10
  ✅ Zero deps (no version conflicts)
  ✅ Retries built-in (API flakiness)
  ✅ Circuit breaker (dependent service resilience)
  ✅ Structured logging (ops)
  ✅ Type-safe (prevents bugs)
  ⚠️  May not need browser support

Alternatives:
  - Axios: 7/10 (heavier, exceptions)
  - Got: 8/10 (Node-only, similar feature set)
  - Fetch: 6/10 (manual retry/circuit logic)
```text

### Scenario 2: Full-Stack Web App (Node + Browser)

**Requirements:** Frontend + backend both make API calls

```text
Trembita score: 10/10
  ✅ Works in both Node and browser
  ✅ Same API for frontend and backend
  ✅ Bundler-friendly (ESM)
  ✅ Type-safe across full stack
  ✅ Injectable fetch for testing

Alternatives:
  - Axios: 7/10 (frontend-heavy)
  - Got: 0/10 (Node-only)
  - Fetch: 6/10 (no shared utilities)
  - OpenAPI-Fetch: 8/10 (if you have spec)
```text

### Scenario 3: Small Script (Node)

**Requirements:** Quick script to call an API once

```text
Trembita score: 6/10
  ✅ Lightweight
  ✅ Zero deps
  ⚠️  Overkill for one-off requests
  ⚠️  Result pattern adds complexity

Alternatives:
  - Native fetch: 8/10 (simplest)
  - Axios: 5/10 (overkill)
  - Got: 7/10 (simpler setup)
````

### Scenario 4: GraphQL Frontend

**Requirements:** Consuming a GraphQL API

```
Trembita score: 2/10
  ❌ Built for REST, not GraphQL
  ⚠️  Would need query builder

Alternatives:
  - Apollo Client: 10/10 (GraphQL-first)
  - URQL: 9/10 (GraphQL-first)
  - graphql-request: 8/10 (lightweight GraphQL)
```

### Scenario 5: Microservices (Resilience Focus)

**Requirements:** Service-to-service calls with retries, circuit breaker

```
Trembita score: 10/10
  ✅ Retries built-in
  ✅ Circuit breaker built-in
  ✅ Timeout management
  ✅ Logging for ops
  ✅ Lightweight
  ✅ No version conflicts

Alternatives:
  - Got: 8/10 (Node-only)
  - Axios: 6/10 (need extra plugins)
  - Fetch: 5/10 (all manual)
```

---

## Migration Guide

### From Axios

```typescript
// Before (Axios)
try {
  const response = await axios.get('https://api.example.com/users');
  console.log(response.data);
} catch (error) {
  console.error(error.message);
}

// After (Trembita)
const api = createTrembita({ endpoint: 'https://api.example.com' });
if (!api.ok) throw api.error;

const result = await api.value.request({ path: '/users' });
if (result.ok) {
  console.log(result.value);
} else {
  console.error(result.error.kind);
}
```

### From Native Fetch

```typescript
// Before (Fetch)
const response = await fetch('https://api.example.com/users');
if (!response.ok) throw new Error(`HTTP ${response.status}`);
const data = await response.json();

// After (Trembita)
const api = createTrembita({ endpoint: 'https://api.example.com' });
if (!api.ok) throw api.error;

const result = await api.value.request({ path: '/users' });
if (!result.ok) throw new Error(result.error.kind);
const data = result.value;
```

### From Got

```typescript
// Before (Got)
const response = await got('https://api.example.com/users');
const data = JSON.parse(response.body);

// After (Trembita)
const api = createTrembita({ endpoint: 'https://api.example.com' });
if (!api.ok) throw api.error;

const result = await api.value.request({ path: '/users' });
const data = result.ok ? result.value : null;
```

---

## Red Flags (Don't Use Trembita If...)

1. **You prefer exceptions for control flow**
   - Trembita uses Result<T,E> pattern
   - Not compatible with try/catch-first designs

2. **You need GraphQL**
   - Trembita is REST-only
   - Use Apollo Client or graphql-request

3. **You need Node < 20**
   - Requires `fetch` and `URL` globals
   - Minimum Node 20.10

4. **You need class-based API**
   - Trembita is functions-only
   - Use Axios for class-based approach

5. **You need file upload streams**
   - Trembita doesn't have streaming helpers
   - Use Got or native fetch for streams

6. **You prefer imperative middleware**
   - Trembita avoids middleware chains
   - Use Axios or Got for middleware hooks

---

## Green Lights (Perfect For Trembita)

1. ✅ TypeScript project consuming REST APIs
2. ✅ Want type-safe error handling
3. ✅ Need both Node and browser (isomorphic)
4. ✅ Prefer simple, functional API
5. ✅ Want zero dependencies
6. ✅ Building microservices or distributed systems
7. ✅ Need built-in retries and resilience
8. ✅ Like testing with inject-able dependencies
9. ✅ Want small bundle size
10. ✅ Dislike exception-based error handling

---

## Still Not Sure?

### Ask Yourself:

1. **What language/framework?**  
   → Not TypeScript? → Try Axios or Got  
   → TypeScript? → Go to Q2

2. **REST or GraphQL?**  
   → GraphQL? → Use Apollo/URQL  
   → REST? → Go to Q3

3. **Node only or Node + Browser?**  
   → Node only? → Got or Trembita (similar)  
   → Both? → Trembita or Axios

4. **How important is bundle size?**  
   → Critical? → Trembita or Fetch  
   → Doesn't matter? → Axios

5. **Do you like `Result<T,E>` pattern?**  
   → No? → Axios or Got  
   → Yes? → Trembita

**If you answer:**

- ✅ TypeScript + REST + Isomorphic + Type-safe errors + Small = **Trembita**
- ❌ Something else → Consult comparison matrix above

---

## Try It Out

**Step 1:** [Install](./README.md#install)

```bash
npm install trembita
```

**Step 2:** Run quick start

```bash
npx ts-node examples/rest-api-client.ts
```

**Step 3:** Read the learning guide

- [QUICK_START.md](./QUICK_START.md) (2 min)
- [LEARNING_GUIDE.md](./LEARNING_GUIDE.md) (30 min)
- [EXAMPLES.md](./EXAMPLES.md) (copy-paste)

**Decision:** If it feels good, stick with it. If not, no hard feelings — use
what works for you!

---

## Questions?

- 📖 [LEARNING_GUIDE.md](./LEARNING_GUIDE.md) — Comprehensive guide
- 💡 [EXAMPLES.md](./EXAMPLES.md) — Real-world use cases
- 🏗️ [ARCHITECTURE.md](./ARCHITECTURE.md) — How it works
- 🔗 [API Docs](https://oleg-koval.github.io/trembita/) — Full reference
- 🐛 [GitHub Issues](https://github.com/oleg-koval/trembita/issues) — Ask
  community
