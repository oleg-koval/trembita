# @trembita/openapi

Workspace spike: **OpenAPI path expansion** plus re-exports of trembita helpers
that pair well with **`openapi-typescript`** `paths` types.

## Verification — `openapi-fetch` (2026-02 upstream types)

`openapi-fetch` models responses as a union of
`{ data; error?: never } | { data?: never; error }` (see
[`packages/openapi-fetch/src/index.d.ts`](https://github.com/openapi-ts/openapi-typescript/blob/main/packages/openapi-fetch/src/index.d.ts)
— `FetchResponse`).

There is **no** `responseOk` discriminant in that union. GitHub issue
[#2071](https://github.com/openapi-ts/openapi-typescript/issues/2071) (empty
error body + `if (error)` footgun) was **closed without** adding a boolean
discriminant; maintainers prefer fixing schemas/endpoints for empty payloads.

**Positioning for trembita:** every HTTP outcome from `createTrembita` /
`request` is an explicit **`Result`** with **`ok`** + tagged **`error.kind`** —
no truthiness check on an `error` field that might be empty.

## API

- **`expandOpenapiPath(template, params)`** — `Result<string, ExpandPathError>`
- **`createOpenapiClient<paths>(options)`** — contract boundary client with
  typed OpenAPI paths, `Result` errors, operation policy, optional Standard
  Schema response validation, and validation timing events.
- Re-exports: `createTrembita`, `HTTP_OK`, `createRetryingFetch`,
  `traceContextHeaders`, `validateStandardSchema`, `requestWithStandardSchema`,
  and common types.

## Contract boundary client

`createOpenapiClient<paths>()` turns an `openapi-typescript` `paths` type into a
small backend boundary client. It expands path params, applies per-operation
policy, checks the expected status, and optionally validates successful response
bodies with Standard Schema.

```typescript
import type { paths } from './fixtures/mini-api.paths.js';
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
    [getUser]: { expectedStatus: 200, timeoutMs: 500 }
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
  // ExpandPathError | TrembitaSendError | unexpected_status | invalid_response
  console.error(
    user.error.kind,
    'operationKey' in user.error ? user.error.operationKey : undefined
  );
}
```

For small API clients, skip policies and schemas at first:

```typescript
const created = createOpenapiClient<paths>({
  endpoint: 'https://api.example.com'
});
const user = created.ok
  ? await created.value.GET('/users/{userId}', { params: { userId: 'alice' } })
  : created;
```

See [docs/contract-boundary-client.md](../../docs/contract-boundary-client.md)
for the design notes,
[framework examples](../../docs/contract-boundary-framework-examples.md), and
[validation performance guidance](../../docs/contract-boundary-validation-performance.md).

## Real `paths` fixture + DX

This package ships a **minimal OpenAPI 3.1** spec and the
**`openapi-typescript`** output so CI proves the story without hand-waving:

| Artifact                         | Role                                                                                         |
| -------------------------------- | -------------------------------------------------------------------------------------------- |
| `fixtures/mini-api.openapi.yaml` | Source spec (two path templates).                                                            |
| `fixtures/mini-api.paths.ts`     | Generated **`paths`** / `operations` (run `npm run gen:fixtures` after editing YAML).        |
| `test/paths-spike.test.ts`       | Asserts `expandOpenapiPath` + `keyof paths` stay aligned (`as const satisfies keyof paths`). |

**Regenerate types after changing the YAML:**

```bash
npm run gen:fixtures --workspace=@trembita/openapi
```

**Typical app flow (DX):** generate `paths` once per API revision, keep path
templates type-checked against `keyof paths`, expand with **`Result`**, then
pass the string URL into `createTrembita` / `request`. The generated file is
**types-only** — it does not ship in the runtime bundle unless you import it
from runtime code (usually you import it from the same module that builds
requests, and bundlers drop type-only imports).

```typescript
import type { paths } from './fixtures/mini-api.paths.js';
import { createTrembita, expandOpenapiPath } from '@trembita/openapi';

const template = '/users/{userId}' as const satisfies keyof paths;
const pathResult = expandOpenapiPath(template, { userId: 'alice' });
if (!pathResult.ok) {
  // handle ExpandPathError — e.g. log pathResult.error.segments
  throw new Error('path expansion failed');
}

const created = createTrembita({ endpoint: 'https://api.example.com' });
if (!created.ok) {
  throw new Error('client init failed');
}

const res = await created.value.request({
  path: pathResult.value,
  method: 'GET',
  expectedCodes: [200]
});
if (!res.ok) {
  // TrembitaRequestError — explicit branch, not `if (error)` on fetch client
}
```

## Bundle / install spike (measured)

Run from repo root after `npm ci` and **`npm run build`**:

```bash
npm run spike:bundle --workspace=@trembita/openapi
```

**Byte sizes (one run, 2026-04-16):**

| Artifact                              | Bytes | Notes                                         |
| ------------------------------------- | ----: | --------------------------------------------- |
| `trembita` `dist/index.js`            | 14249 | Core client.                                  |
| `trembita` `dist/index.d.ts`          |  6372 |                                               |
| `@trembita/openapi` `dist/index.js`   |   922 | Thin wrapper + `expandOpenapiPath`.           |
| `@trembita/openapi` `dist/index.d.ts` |   706 |                                               |
| `fixtures/mini-api.paths.ts`          |  2427 | **Compile-time only** in a normal app layout. |

**`npm pack` (published surface — `files: ["dist"]` only):**

| Package             | Tarball on disk | Unpacked (npm notice) |
| ------------------- | --------------: | --------------------: |
| `trembita`          |       ~19.9 KiB |             ~73.9 KiB |
| `@trembita/openapi` |        ~2.8 KiB |              ~6.5 KiB |

**Consumer install check** (optional): pack the core tarball and install into
the workspace without saving to root `package.json`:

```bash
npm pack -w trembita --pack-destination /tmp && \
  npm install /tmp/trembita-*.tgz -w @trembita/openapi --no-save
```

Convenience (build + print metrics):

```bash
npm run spike:openapi
```

## Status

**Published** alongside **`trembita`**: the same **semantic-release** workflow
runs a second **`@semantic-release/npm`** step with
**`pkgRoot: packages/openapi`**. Configure **Trusted Publishing** for
**`@trembita/openapi`** on npm (not only the root **`trembita`** package), or CI
may fall back to **`NPM_TOKEN`** and return **EOTP** if your npm account uses
2FA. Details: [CONTRIBUTING.md](../../CONTRIBUTING.md).

**Peer dependency:** consumers should install **`trembita` ^2** next to
**`@trembita/openapi`** (`peerDependencies` in published manifest; this repo
uses **`file:../..`** under **`devDependencies`** for workspace development).
