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

## Why not compose openapi-fetch + Zod + neverthrow?

You can, but every team then has to design the same boundary contract: how
transport failures map to validation failures, how unexpected statuses are
reported, how operation names appear in logs, and how empty/error bodies narrow.
Trembita provides one operational contract across those cases: every call
returns `Result`, every failure has stable `error.kind`, and response validation
is colocated with the OpenAPI operation. The goal is not to replace every
generated SDK; it is to make backend service boundaries hard to misuse.

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
import {
  createOpenapiClient,
  openapiOperationKey,
  openapiResponseSchemaKey
} from '@trembita/openapi';

const getUser = openapiOperationKey<paths>('GET', '/users/{userId}');
const getUser200 = openapiResponseSchemaKey<paths>(
  'GET',
  '/users/{userId}',
  200
);

const created = createOpenapiClient<paths>({
  endpoint: 'https://api.example.com',
  policies: {
    [getUser]: {
      expectedStatus: 200,
      timeoutMs: 500,
      headers: { 'x-service': 'accounts' }
    }
  },
  responseSchemas: {
    [getUser200]: userSchema
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

## Backend consumer path

Start minimal: create a client with only `endpoint`, call a typed path, and
branch on `result.ok`. Add `policies` when an operation needs explicit status,
timeout, or headers. Add `responseSchemas` only for boundaries where runtime
shape drift would cause a production incident.

Framework examples live in
[contract-boundary-framework-examples.md](./contract-boundary-framework-examples.md).

## Enterprise/platform notes

The MVP keeps policy as local plain data. That is enough for service-level
adoption. Larger platform teams can wrap `createOpenapiClient` with shared
service presets later, without changing the underlying operation policy shape.
That follow-up should stay additive and avoid global middleware chains.

## Release positioning

Ship and document this as an experimental contract boundary client, not as a
full generated SDK replacement. The promise is backend boundary safety:
OpenAPI-guided calls, explicit operational failures, optional runtime
validation, and policy colocated with the operation.

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
