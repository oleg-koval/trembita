# trembita

![Trembita banner](./assets/banner.png)

[![Code Quality](https://github.com/oleg-koval/trembita/actions/workflows/code-quality.yml/badge.svg?branch=main)](https://github.com/oleg-koval/trembita/actions/workflows/code-quality.yml)
[![Coverage Status](https://coveralls.io/repos/github/oleg-koval/trembita/badge.svg?branch=main)](https://coveralls.io/github/oleg-koval/trembita?branch=main)
[![npm version](https://img.shields.io/npm/v/trembita/latest.svg)](https://www.npmjs.com/package/trembita)
[![API docs](https://img.shields.io/badge/docs-GitHub%20Pages-24292e)](https://oleg-koval.github.io/trembita/)

Lightweight **TypeScript HTTP client** for consuming third-party **JSON APIs**.
Built on the platform **`fetch`** API with strict **`Result<T, E>`** error
handling — zero legacy dependencies, no `request`, no Bluebird.

_Named after the Carpathian **trembita** — a long signal horn. One small client,
explicit success/failure at a distance._

**Quick links:** [Install](#install) · [Minimal example](#minimal-example) ·
[Learning guide](#learning-guide) · [Examples](#examples) ·
[Why trembita](#why-trembita) · [Use cases](#use-cases) ·
[@trembita/openapi](#trembitaopenapi-optional) ·
[Error handling](#error-handling) · [API reference](#api-reference) ·
[Migration from v1](#migration-from-v1)

## Install

```shell
npm install trembita
```

Optional OpenAPI helpers (path expansion, `requestOpenapiPath`, Standard Schema
re-exports) live in **`@trembita/openapi`**:

```shell
npm install trembita @trembita/openapi
```

See [packages/openapi/README.md](packages/openapi/README.md).

## Requirements

- **Node** >= 20.10 (Active LTS recommended).
- **Browser**: bundler + global **`fetch`** and **`URL`** (same ESM entry).

## Minimal example

Uses `throw` on bad init so the same snippet works in **Node and browsers** (no
`process.exit`).

```typescript
import { createTrembita, HTTP_OK } from 'trembita';

const api = createTrembita({ endpoint: 'https://api.example.com/v1' });
if (!api.ok) throw new Error('Invalid endpoint');

const json = await api.value.request({
  path: '/resource',
  expectedCodes: [HTTP_OK]
});

if (!json.ok) {
  console.error(json.error.kind);
}
```

## Learning Path

**Choose your starting point based on available time:**

### ⚡ Super Quick (2 minutes)
**[QUICK_START.md](./QUICK_START.md)** — Install, 3-step example, common patterns, error types, FAQ.

### 🎓 Complete Learning (30 minutes)
**[LEARNING_GUIDE.md](./LEARNING_GUIDE.md)** — Core concepts, building clients, error handling, testing, advanced features, patterns.

### 🏗️ System Design (15 minutes)
**[ARCHITECTURE.md](./ARCHITECTURE.md)** — Visual diagrams, request pipeline, error flow, feature matrix, integration patterns.

### 🤔 Right Tool for You? (10 minutes)
**[DECISION_GUIDE.md](./DECISION_GUIDE.md)** — Compare with Axios/Got/Fetch, scenario-based recommendations, migration guides.

### 💡 Real-World Examples (varies)
**[EXAMPLES.md](./EXAMPLES.md)** — 7+ use cases: GitHub API, payments, microservices, health checks, webhooks, search, backups.

### 📝 Starter Code
**[examples/](./examples/)** directory — Copy-paste ready:
- `rest-api-client.ts` — Complete CRUD client
- `testing-with-mock-fetch.test.ts` — Unit test patterns
- `resilience-patterns.ts` — Retries, circuit breaker, failover

**See [examples/README.md](./examples/README.md) for navigation.**

## Why trembita

- **Type-safe errors** — every failure is a tagged discriminated union
  (`error.kind`), not a thrown exception. TypeScript narrows the error for you.
- **Zero runtime dependencies** — uses `fetch` and `URL` from the platform.
  Works in Node >= 20 and browsers (via bundler).
- **Tiny API surface** — `createTrembita()` → `{ request, client }`. No classes,
  no middleware chains, no plugin system.
- **Testable by design** — inject `fetchImpl` to swap `fetch` in unit tests
  without mocking globals.
- **ESM-only, strict TypeScript** — ships `.d.ts` + source maps, tree-shakeable
  with `sideEffects: false`.

## Use cases

### Consuming a REST API in a backend service

When your Node service calls a third-party REST API (payment provider, CRM,
shipping tracker), trembita gives you a typed client with predictable error
handling instead of scattered `try/catch` blocks around raw `fetch`.

```typescript
import { createTrembita, HTTP_OK } from 'trembita';

const stripe = createTrembita({
  endpoint: 'https://api.stripe.com/v1'
});
if (!stripe.ok) throw new Error('Bad Stripe config');

const charges = await stripe.value.request({
  path: '/charges',
  query: { limit: '10' },
  headers: { Authorization: `Bearer ${process.env.STRIPE_KEY}` },
  expectedCodes: [HTTP_OK]
});

if (!charges.ok) {
  if (charges.error.kind === 'unexpected_status') {
    console.error('Stripe returned', charges.error.statusCode);
  }
}
```

### Wrapping a microservice-to-microservice call

Internal services often communicate over HTTP JSON. trembita standardizes how
you send requests and handle non-200 responses across service boundaries.

```typescript
const userService = createTrembita({
  endpoint: 'http://user-service.internal:3000'
});
if (!userService.ok) throw new Error('Bad user-service config');

const user = await userService.value.request({
  path: `/users/${userId}`,
  expectedCodes: [HTTP_OK]
});

if (!user.ok && user.error.kind === 'unexpected_status') {
  if (user.error.statusCode === 404) {
    return null;
  }
}
```

### Health checks and monitoring

Use the lower-level `client` function when you need the raw status code and body
— useful for health checks, readiness probes, or status dashboards.

```typescript
const raw = await api.value.client({ path: '/health' });
if (raw.ok && raw.value.statusCode === 200) {
  console.log('Service healthy:', raw.value.body);
}
```

### Browser fetch with a bundler

trembita works in the browser with any bundler (Vite, webpack, esbuild). The
same ESM entry point uses the global `fetch` and `URL` APIs.

```typescript
import { createTrembita, HTTP_OK } from 'trembita';

const api = createTrembita({
  endpoint: 'https://api.example.com/v1'
});
if (!api.ok) {
  showError('Failed to initialize API client');
}
```

### @trembita/openapi (optional)

Use **`openapi-typescript`** `paths` for templates, then **`expandOpenapiPath`**
or **`requestOpenapiPath`** so path mistakes stay in **`Result`** before HTTP.
The add-on package re-exports **`validateStandardSchema`**,
**`requestWithStandardSchema`**, **`createRetryingFetch`**, and
**`traceContextHeaders`** for one import line. Full notes, bundle spike, and
**`openapi-fetch`** positioning:
[packages/openapi/README.md](packages/openapi/README.md).

### Testing with injected fetch

Pass a mock `fetchImpl` to test your integration layer without touching the
network or patching globals.

```typescript
import { createTrembita, HTTP_OK } from 'trembita';
import { vi } from 'vitest';

const fetchImpl = vi.fn(() =>
  Promise.resolve(new Response(JSON.stringify({ id: 1 }), { status: 200 }))
);

const created = createTrembita({
  endpoint: 'https://api.test.com',
  fetchImpl
});

const result = await created.value.request({
  path: '/items/1',
  expectedCodes: [HTTP_OK]
});

expect(result.ok).toBe(true);
expect(fetchImpl).toHaveBeenCalledOnce();
```

## Functional style

The API is **functional-first**: `createTrembita` returns a **`Result`**, then
plain **`client` / `request`** functions — no class instance. Failures use
**tagged errors** (`error.kind`) so callers narrow with types instead of relying
on **`try/catch`** for normal HTTP outcomes.

This is **not** pure FP end-to-end: **`fetch`**, the network, and logging are
ordinary side effects. Think **FP-style errors and surface area**, not a fully
pure program.

## Error handling

Every operation returns a `Result<T, E>` — either `{ ok: true, value }` or
`{ ok: false, error }`. Errors are tagged unions you can narrow with
`error.kind`:

| `error.kind`              | When                                             |
| ------------------------- | ------------------------------------------------ |
| `missing_options`         | No options passed to `createTrembita`            |
| `options_not_object`      | Options is not an object                         |
| `missing_endpoint`        | `endpoint` field is missing                      |
| `endpoint_not_string`     | `endpoint` is not a string                       |
| `endpoint_invalid_url`    | `endpoint` URL cannot be parsed or bad scheme    |
| `invalid_request_options` | Missing or invalid `path`/`url` in request       |
| `fetch_failed`            | Network error (DNS, timeout, connection reset)   |
| `timeout`                 | Request exceeded configured timeout              |
| `circuit_open`            | Circuit breaker is open; request short-circuited |
| `invalid_json`            | Response body is not valid JSON                  |
| `unexpected_status`       | HTTP status not in `expectedCodes`               |

## API reference

Full TypeDoc documentation is published at
[oleg-koval.github.io/trembita](https://oleg-koval.github.io/trembita/) (core
**`trembita`** entry only). **`@trembita/openapi`** types are published with
that package — see [packages/openapi/README.md](packages/openapi/README.md).

### `createTrembita(options)`

Creates a client bound to a base URL.

| Option           | Type                                               | Default            | Description                          |
| ---------------- | -------------------------------------------------- | ------------------ | ------------------------------------ |
| `endpoint`       | `string` (required)                                | —                  | Base URL for all requests            |
| `fetchImpl`      | `typeof fetch`                                     | `globalThis.fetch` | Custom fetch for testing             |
| `log`            | `Logger`                                           | no-op logger       | Logger with `trace`..`error`.        |
| `timeoutMs`      | `number`                                           | —                  | Default timeout for requests         |
| `circuitBreaker` | `{ failureThreshold: number; cooldownMs: number }` | —                  | Optional consecutive-failure breaker |

Returns `Result<TrembitaClient, TrembitaInitError>`.

### Logging contract

- Logging is opt-in: no logger means no internal logs.
- When `log` is provided, trembita emits lifecycle events:
  - `request:start` (debug): endpoint, path, method, sanitized headers
  - `request:success` (info): endpoint, path, statusCode, durationMs
  - `request:unexpected_status` (warn): endpoint, path, statusCode,
    expectedCodes
  - `request:fetch_failed` / `request:invalid_json` (error): endpoint, path,
    error kind
- Sensitive request headers are redacted in logs (`authorization`, `cookie`,
  `set-cookie`, `x-api-key`, `proxy-authorization`).

### `request(options)`

Sends a request and returns the parsed JSON body if the status matches
`expectedCodes` (default: `[200, 201]`).

Returns `Promise<Result<unknown, TrembitaRequestError>>`.

### `client(options)`

Sends a request and returns `{ statusCode, body, path }` regardless of status.

Returns `Promise<Result<TrembitaHttpResponse, TrembitaSendError>>`.

### Standard Schema, retries, tracing (core)

These ship from **`trembita`** and are also re-exported from
**`@trembita/openapi`** for OpenAPI-shaped call sites:

| Export                          | Role                                                                                                                 |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| **`validateStandardSchema`**    | Run a [Standard Schema](https://github.com/standard-schema/standard-schema) v1 `validate` → **`Result`** (no throw). |
| **`requestWithStandardSchema`** | `request` + optional response body validation.                                                                       |
| **`createRetryingFetch`**       | Wrap `fetch` with backoff retries for status / transport failures.                                                   |
| **`traceContextHeaders`**       | Build `traceparent` / `tracestate` headers (W3C Trace Context).                                                      |

### Request options

| Option          | Type                          | Default                  |
| --------------- | ----------------------------- | ------------------------ |
| `path` or `url` | `string`                      | — (required)             |
| `method`        | `string`                      | `GET` / `POST` with body |
| `headers`       | `Record<string, string>`      | `{}`                     |
| `query` or `qs` | `Record<string, string\|...>` | —                        |
| `body`          | `unknown`                     | —                        |
| `expectedCodes` | `number[]`                    | `[200, 201]`             |
| `timeoutMs`     | `number`                      | init `timeoutMs`         |
| `signal`        | `AbortSignal`                 | —                        |

## Requirements

- **Node** >= 20.10 (Active LTS recommended).
- **Browser**: bundler + global **`fetch`** and **`URL`** (same ESM entry).

## Install

```shell
npm install trembita
```

## Migration from v1.x

This version line is a **breaking v2 migration** to the functional `Result` API.

| v1                                                     | v2                                                                                                                      |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| `const T = require('trembita')` / `new Trembita(opts)` | `import { createTrembita } from 'trembita'` then **`createTrembita(opts)`** → **`Result`**                              |
| `this.request({ url, qs, expectedCodes })` throwing    | `request({ path or url, query or qs, expectedCodes })` → **`Promise<Result<unknown, TrembitaRequestError>>`**           |
| `catch (UnexpectedStatusCodeError)`                    | Narrow **`!result.ok`** and check **`result.error.kind === 'unexpected_status'`** (prefer **`kind`**, not message text) |
| `request` / `bluebird` / `validator`                   | **`fetch`**, **`URL`**, optional **`fetchImpl`** for tests                                                              |

### @trembita/openapi (new in v2 line)

| Topic       | Action                                                                                                                                                                                                                                                                                                                                                    |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Install     | `npm install trembita @trembita/openapi` — **`trembita` is a peer dependency** (^2) of the OpenAPI package.                                                                                                                                                                                                                                               |
| Path typing | Generate `paths` with **`openapi-typescript`**, keep templates aligned with `keyof paths`, expand with **`Result`**.                                                                                                                                                                                                                                      |
| Publishing  | Same **semantic-release** run publishes **`trembita`** then **`@trembita/openapi`**. Use **Trusted Publishing** for **both** packages on npm (or an **Automation** granular token); see [CONTRIBUTING.md](CONTRIBUTING.md). If only `trembita` has OIDC and **`NPM_TOKEN`** is set, OpenAPI may fall back to token auth and fail with **EOTP** under 2FA. |

## Contribute

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT © 2018–2026
