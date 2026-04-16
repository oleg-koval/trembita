# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with
code in this repository.

## Commands

```bash
npm test                  # vitest run + coverage (root + openapi workspace)
npm run test:watch        # vitest in watch mode (root only)
npm run coverage          # alias for npm test -- --coverage
npm run typecheck         # tsc --noEmit (root + openapi workspace)
npm run lint              # eslint (root + openapi workspace)
npm run lint:fix          # eslint --fix (root + openapi workspace)
npm run format            # prettier check
npm run format:fix        # prettier write
npm run build             # tsup ESM + d.ts (root + openapi workspace)
```

Run a single test file:

```bash
npx vitest run test/trembita.test.ts
```

## Architecture

Monorepo with two packages:

- **`src/`** — core library (`trembita`). ESM-only, zero runtime deps,
  stdlib-first (`fetch`, `URL`). Exports a functional API (`createTrembita`,
  `Result<T,E>`, retry, tracing, Standard Schema validation).
- **`packages/openapi/`** — `@trembita/openapi` workspace. OpenAPI-aware client
  built on the core.

### Core modules (`src/`)

| File                           | Role                                                                 |
| ------------------------------ | -------------------------------------------------------------------- |
| `trembita.ts`                  | `createTrembita` factory — main entry point                          |
| `result.ts`                    | `Result<T,E>` / `Ok` / `Err` — no exceptions in public API           |
| `errors.ts`                    | Type-only error discriminated unions                                 |
| `validate.ts`                  | Init-time option validation, `Logger`, `CircuitBreakerOptions` types |
| `retryingFetch.ts`             | `createRetryingFetch` — exponential-backoff wrapper                  |
| `standardSchema.ts`            | Standard Schema v1 integration                                       |
| `requestWithStandardSchema.ts` | Combines fetch + schema validation                                   |
| `tracing.ts`                   | `traceContextHeaders` — W3C traceparent injection                    |
| `url.ts`                       | URL construction helpers                                             |

### Key design rules (from SPEC.md)

- **No class API** — factory functions only.
- **`Result<T,E>` everywhere** — never throw operational errors; callers narrow
  with `if (!result.ok)`.
- **100% coverage required** on `src/` (branches, lines, functions, statements).
  `src/errors.ts` is excluded (type-only).
- **No runtime dependencies** — stdlib fetch/URL only.
- **ESM-only** (`type: "module"`).

## Release

Releases are automated via `semantic-release` on push to `main` or `beta`.
Conventional commit messages drive version bumps. The workflow uses npm Trusted
Publishing (OIDC) per package; while `NPM_TOKEN` is set, failed OIDC for a
package (e.g. OpenAPI not linked on npm) falls back to token auth and can hit
**EOTP** under 2FA—link Trusted Publishers for **both** `trembita` and
`@trembita/openapi`, or use an Automation granular token.
