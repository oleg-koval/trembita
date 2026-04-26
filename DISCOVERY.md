# Trembita Discovery Guide

This document helps developers discover Trembita and understand why it's the
right choice for their API integration needs.

## Find Trembita

### NPM Search

- Search: "trembita" — https://www.npmjs.com/package/trembita
- Search: "fetch wrapper typescript" — Trembita ranks high
- Search: "Result type error handling" — Functional error handling pattern

### GitHub

- Repository: https://github.com/oleg-koval/trembita
- Stars & community engagement
- Issue tracker for real-world use cases
- Example implementations in `/examples`

### Web Search Keywords

- "TypeScript HTTP client zero dependencies"
- "Result type fetch wrapper"
- "Functional API error handling"
- "Type-safe REST client"
- "Trembita HTTP client"

### Awesome Lists

- Consider adding to: awesome-typescript, awesome-nodejs, awesome-http-clients
- Add to: awesome-functional-programming
- Add to: awesome-nodejs-libraries

---

## The Problem Trembita Solves

### Common Developer Pain Points

**Without Trembita:**

```typescript
try {
  const response = await fetch(url);
  const json = await response.json();
  if (!response.ok) {
    // What do I do here? Different error per status?
  }
  // What could go wrong? Timeouts? JSON parse errors?
  return json;
} catch (error) {
  // Network error? JSON parse error? Timeout?
  // How do I distinguish?
}
```

**With Trembita:**

```typescript
const result = await api.request({ path: '/data', expectedCodes: [200] });

if (!result.ok) {
  if (result.error.kind === 'timeout') {
    // Handle timeout
  } else if (result.error.kind === 'unexpected_status') {
    // Handle HTTP error
  }
  // TypeScript knows all error possibilities
  return;
}

// Type-safe access to data
const data = result.value;
```

### Comparison Matrix

**vs Axios**

- Axios: Massive dependency tree, request/response interceptors, promise-based
- Trembita: Zero dependencies, Result types, explicit errors

**vs node-fetch**

- node-fetch: No error handling opinions, generic try/catch
- Trembita: Structured error handling, built-in utilities

**vs Raw fetch**

- fetch: Low-level, requires boilerplate for errors, baseURL, etc
- Trembita: High-level client, error handling, circuit breaker, retry logic

**vs Ky**

- Ky: Nice library, but adds dependency and assumes browser environment
- Trembita: Zero deps, Node 20+ and browsers, testable injection

---

## Why Choose Trembita?

### 1. Type-Safe Errors (Biggest Win)

```typescript
// You CANNOT forget to handle an error
const result = await api.request({ path: '/users' });

if (!result.ok) {
  // TypeScript forces you to handle result.error
  // result.error.kind is a union of all possible errors
  switch (result.error.kind) {
    case 'unexpected_status': // Handle HTTP errors
    case 'timeout': // Handle timeouts
    case 'fetch_failed': // Handle network errors
    case 'invalid_json': // Handle malformed responses
    // TypeScript ensures you covered all cases
  }
}
```

### 2. Zero Runtime Dependencies

```json
// package.json
{
  "name": "myapp",
  "dependencies": {
    "trembita": "^2.0.0"
    // That's it. No request, no bluebird, no form-data, etc.
  }
}
```

Benefits:

- Smaller bundle size
- No vulnerability audits on HTTP client
- Easier to audit your supply chain
- Faster npm install
- No version conflicts

### 3. Functional API

```typescript
// No classes, no hidden state
const client = createTrembita({ endpoint });

// Just functions
const result = await client.request({ path });

// Easy to test: just pass functions around
// Easy to understand: everything is explicit
```

### 4. Testable by Default

```typescript
// No globals, no mocking libraries needed
const mockFetch = vi.fn(() =>
  Promise.resolve(new Response(JSON.stringify({ id: 1 })))
);

const api = createTrembita({ endpoint, fetchImpl: mockFetch });
const result = await api.request({ path });

// That's it. No global mocking, no jest/vitest setup.
```

### 5. Minimal Learning Curve

The entire public API:

- `createTrembita(options)` — Initialize
- `client.request(options)` — Send request, validate status
- `client.client(options)` — Send request, get raw response
- `Result<T, E>` — Success or failure

That's 4 things. Compare to Axios (interceptors, transformers, guards,
adapters...).

### 6. Built-In Resilience

```typescript
const api = createTrembita({
  endpoint,
  timeoutMs: 5000, // Timeout protection
  circuitBreaker: {
    // Failure protection
    failureThreshold: 5,
    cooldownMs: 30000
  }
});
```

### 7. Enterprise Ready

- ✅ 100% TypeScript coverage
- ✅ ESM-first (no legacy CommonJS)
- ✅ Source maps included
- ✅ Full JSDoc + TypeDoc
- ✅ Strict null checks
- ✅ No `any` types in public API
- ✅ Comprehensive error handling
- ✅ Observable via structured logging

---

## Quick Wins by Use Case

### REST API Client

✅ Best choice — functional API, Result types, no exceptions

### Microservice Communication

✅ Best choice — predictable error handling, built-in resilience

### Third-party Service Integration

✅ Best choice — circuit breaker, retry utilities, structured errors

### Browser Fetch

✅ Good choice — zero deps, bundles well, ESM-native

### GraphQL Client

❌ Not ideal — Trembita is JSON/REST focused

### SOAP/XML Services

❌ Not ideal — JSON-only, no middleware chains

---

## Real-World Examples

### Stripe Integration

```typescript
// Type-safe, predictable error handling
const result = await stripe.request({
  path: '/charges',
  query: { limit: '10' },
  expectedCodes: [200]
});

if (!result.ok && result.error.kind === 'unexpected_status') {
  if (result.error.statusCode === 429) {
    // Rate limited
  } else if (result.error.statusCode === 401) {
    // Auth failed
  }
}
```

### Health Checks

```typescript
// Raw status + body without validation
const health = await api.client({ path: '/health' });

if (health.ok && health.value.statusCode === 200) {
  console.log('Healthy:', health.value.body);
}
```

### Testing

```typescript
// Inject mock fetch, no global state
const mockFetch = vi.fn(() => Promise.resolve(...));
const api = createTrembita({ endpoint, fetchImpl: mockFetch });
// Test without touching network
```

---

## Market Positioning

### Who is Trembita for?

- **TypeScript developers** — Full type safety, no `any`
- **Modern Node.js** — Node 20+, ESM-first
- **Functional programmers** — Result types, no exceptions
- **Testing enthusiasts** — Dependency injection by default
- **Production engineers** — Resilience, observability, zero deps
- **Bundle-conscious devs** — Zero runtime dependencies
- **API integrators** — REST/JSON-focused, clear error semantics

### Who might prefer alternatives

- CommonJS-only projects (use node-fetch)
- Need middleware/interceptors (use Axios)
- Browser-first, no bundler (use native fetch)
- GraphQL APIs (use Apollo or similar)
- SOAP/RPC services (use specialized clients)

---

## Content Marketing Ideas

### Blog Posts

1. **"Why I Stopped Using Axios and Switched to Trembita"** — Comparison,
   benefits
2. **"Type-Safe Error Handling in TypeScript: The Result Type"** — Educational
3. **"Testing HTTP Integrations Without Mocking Globals"** — Best practices
4. **"Building Resilient APIs with Circuit Breakers"** — Advanced patterns
5. **"Zero-Dependency HTTP Client for Node.js"** — Performance angle

### Example Projects

- ✅ GitHub API client (examples/agent-examples.ts)
- ☐ Stripe payment processor
- ☐ Weather API dashboard
- ☐ Slack bot integration
- ☐ Microservice communicator

### Community

- Share on:
  - Reddit: r/typescript, r/node, r/programming
  - HackerNews: "Trembita: Lightweight TypeScript HTTP client"
  - Twitter/X: API tips + Result type advantages
  - Dev.to: Tutorials and comparisons
  - GitHub Discussions: Common patterns

---

## SEO Keywords

**Short Tail:**

- TypeScript HTTP client
- Fetch wrapper
- API client
- Result type
- Error handling

**Long Tail:**

- "zero dependency TypeScript HTTP client"
- "type-safe error handling fetch"
- "Result type REST API client"
- "functional HTTP client JavaScript"
- "testable fetch wrapper TypeScript"
- "microservice communication TypeScript"

**Comparison:**

- "Trembita vs Axios"
- "Trembita vs Ky"
- "Trembita vs node-fetch"
- "Better than Axios"
- "Axios alternative TypeScript"

---

## Discoverability Checklist

- [x] NPM package published and keywords optimized
- [x] GitHub repository with comprehensive README
- [x] TypeDoc API documentation
- [x] Examples in `/examples` directory
- [x] AGENT_GUIDE.md for AI agents
- [x] This DISCOVERY.md guide
- [ ] Blog posts (in progress)
- [ ] Awesome list submissions (help wanted!)
- [ ] Dev.to articles
- [ ] Video tutorial / walkthrough
- [ ] Community project examples
- [ ] Social media presence

---

## How to Help Trembita Grow

1. **Use it** — Real projects validate the design
2. **Star on GitHub** — Increases discoverability
3. **Share examples** — Show others your use cases
4. **Write blog posts** — Educational content attracts developers
5. **File issues** — Real problems make the library better
6. **Submit PRs** — Help improve documentation and features
7. **Recommend to friends** — Word-of-mouth is powerful
8. **Add to awesome lists** — Increases searchability
9. **Give talks** — Conferences + meetups reach new audiences
10. **Contribute integrations** — Real-world examples matter

---

## Next Steps for Discoverability

### Immediate (Week 1)

- [x] Optimize package.json keywords
- [x] Create AGENT_GUIDE.md
- [x] Create examples
- [ ] Submit to awesome-typescript list
- [ ] Submit to awesome-nodejs list

### Short Term (Month 1)

- [ ] Write 2-3 blog posts
- [ ] Create video tutorial
- [ ] Build example project (payment processor)
- [ ] Share on social media
- [ ] Community call/AMA

### Medium Term (Quarter)

- [ ] Reach 1K GitHub stars
- [ ] 10K NPM weekly downloads
- [ ] Featured in industry newsletter
- [ ] Conference talk

### Long Term (Year)

- [ ] Industry standard for Result-based HTTP clients
- [ ] 5K+ weekly downloads
- [ ] Thriving community
- [ ] Multiple real-world case studies

---

## Resources

- **NPM**: https://www.npmjs.com/package/trembita
- **GitHub**: https://github.com/oleg-koval/trembita
- **Docs**: https://oleg-koval.github.io/trembita/
- **Issues**: https://github.com/oleg-koval/trembita/issues
- **Discussions**: https://github.com/oleg-koval/trembita/discussions

---

**Last Updated**: 2026-04-20 **Goal**: Make Trembita the go-to choice for
type-safe, zero-dependency HTTP clients in TypeScript
