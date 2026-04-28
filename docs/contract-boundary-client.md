# Contract Boundary Client

## Goal

Make Trembita the safe boundary for backend services that call third-party or
internal HTTP APIs. The client combines OpenAPI path typing, explicit
`Result<T, E>` outcomes, optional Standard Schema response validation, and
per-operation policy in one small API.

## Why this matters

Backend incidents often happen at API boundaries: a downstream service returns a
wrong status, malformed JSON, an empty body, or a response shape that drifted
from the TypeScript contract. Static OpenAPI types help at compile time, but
they do not protect runtime boundaries.

Trembita's differentiator is not another fetch wrapper. It is a contract-first
anti-corruption layer:

- no thrown operational errors;
- no truthiness checks on optional `error` fields;
- tagged `error.kind` for all branches;
- optional runtime validation for untrusted downstream responses;
- timeout/header/status policy colocated with the operation.

## MVP API

```ts
import type { paths } from './generated/paths.js';
import { createOpenapiClient } from '@trembita/openapi';

const created = createOpenapiClient<paths>({
  endpoint: 'https://api.example.com',
  policies: {
    'GET /users/{userId}': {
      expectedStatus: 200,
      timeoutMs: 500,
      headers: { 'x-service': 'accounts' }
    }
  },
  responseSchemas: {
    'GET /users/{userId} 200': userSchema
  }
});

if (!created.ok) throw new Error('invalid client config');

const user = await created.value.GET('/users/{userId}', {
  params: { userId: 'alice' }
});

if (!user.ok) {
  switch (user.error.kind) {
    case 'openapi_path_unexpanded':
    case 'unexpected_status':
    case 'invalid_response':
    case 'timeout':
    case 'fetch_failed':
      break;
  }
}
```

## Design constraints

- Keep core `trembita` unchanged and dependency-free.
- Ship the feature from `@trembita/openapi` first.
- Accept `openapi-typescript` `paths` types; do not require codegen at runtime.
- Use Standard Schema as the validation adapter; do not bind to Zod/Valibot.
- Keep policy plain data keyed by `METHOD /path/{param}`.
- Prefer additive API growth over middleware/plugin systems.

## Follow-up ideas

- Response header typing for generated `responses[status].headers`.
- Typed error response bodies for non-2xx statuses.
- Codegen helper that emits policy/schema keys from an OpenAPI document.
- Optional operation metrics hooks built from the same policy keys.
