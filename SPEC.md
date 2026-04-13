# Spec: Trembita — TypeScript, FP, and hardened HTTP wrapper

## Locked decisions


| Topic        | Decision                                                                                                                                                                                                                                                                                          |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Distribution | **npm library** (third-party HTTP wrapper).                                                                                                                                                                                                                                                       |
| Public API   | **Breaking major**: **FP-first** — `**createTrembita` (or equivalent factory)** + **plain functions**; **no legacy class API. TypeScript is the source of truth.                                                                                                                                  |
| Error model  | **More FP**: `**Result` / discriminated unions** for operational outcomes (e.g. unexpected status). Avoid `**instanceof Error` subclasses as the primary contract; document how callers map failures to logging/metrics.                                                                          |
| Node         | **Track latest Node Active LTS** for `engines` and primary CI; bump `engines` when the LTS line rotates. CI may additionally run **Current** to catch forward breakage (optional).                                                                                                                |
| Modules      | **Default ship: ESM-only** (`type: "module"`, `exports` import). **Dual CJS+ESM** is **phase-2 optional** if real consumers still need `require()` — add only with evidence (issues/downloads).                                                                                                   |
| Runtime deps | **Max standard library**: `**fetch`**, `**URL`**, numeric HTTP status constants inline in `src/`; no `validator`, `**http-status-codes**`, `request`, `bluebird`.                                                                                                                                 |
| Tests        | **Vitest** + coverage thresholds.                                                                                                                                                                                                                                                                 |
| Runtimes     | **Node + browser**: same **ESM** surface; consumers use bundlers. Add **documented browser constraints** (global `fetch` / URL). Optional **prebuilt browser bundle** (e.g. **tsup** IIFE/ESM) only if we want script-tag usage — **start with ESM for bundlers**; add bundle artifact if needed. |
| Release      | `**semantic-release`** with **[semantic-release-npm-github-publish](https://oleg-koval.github.io/semantic-release-npm-github-publish/)** for npm + GitHub releases and **semver** (including **breaking majors for this migration).                                                               |


---

## Assumptions (still true unless contradicted)

1. **Effects vs purity** — Network I/O stays behind **injected `fetch`**
  (default `globalThis.fetch`). **Pure** modules for validation, status checks,
   and mapping request options → `Request`.
2. **Typing** — TypeScript `**strict`**, no `any`; JSON parsed as
  `**unknown\*\*` until caller narrows.
3. **Coverage** — **100%** on published `src/`** with **no ignore** unless you
  approve a **documented exception.
4. **Security** — `**npm audit` in CI; no deprecated HTTP client; minimal
  attack surface (stdlib-first).

---

## Objective

**What** — Migrate `trembita` from legacy CommonJS (`request`, `bluebird`, class
API) to **TypeScript**, **functional** API, `**Result`/`union` errors**,
**Vitest**, **stdlib-first** HTTP, **Node + browser** consumers, **100%
coverage**, **semantic-release semver.

**Who** — Maintainers and npm consumers wrapping third-party HTTP APIs in Node
or bundled browser apps.

**Why** — Remove deprecated dependencies; align with FP, strict types, and
automated semver releases.

**Success looks like**

- Published **ESM** (and types); optional **dual CJS** only if phase-2 triggers.
- **No** `request`, **no** `bluebird`, **no** `validator` / `http-status-codes`
unless an exception is explicitly approved later.
- **Vitest** + **100%** coverage gate on `src/`.
- **README** migration section: **v1 class + exceptions** → **v2 factory +
`Result` unions** (and browser notes).
- Releases via **semantic-release** + **semantic-release-npm-github-publish**
(see
[docs](https://oleg-koval.github.io/semantic-release-npm-github-publish/)).

---

## Backwards compatibility

- **Semver major** required: **intentional breaking** API (factory, `Result`
errors, ESM-first, Node `engines` jump).
- **Compatibility note for consumers**: document **migration checklist** in
README + CHANGELOG: replace `new Trembita(opts)` with
`**createTrembita(opts)`**, replace `**catch (UnexpectedStatusCodeError)`**with`**result` narrowing** (`if (!result.ok) { ... }`or`match`), replace `**require('trembita')`** with `**import`** (or wait
for dual-publish phase if adopted).
- **Message strings** for failures are **not** a stability guarantee unless
explicitly documented; prefer **stable `kind` / `code` fields** on union
members for programmatic branching.

---

## Tech stack (target)


| Area         | Choice                                                                                |
| ------------ | ------------------------------------------------------------------------------------- |
| Language     | TypeScript `strict`                                                                   |
| Node         | `engines` = **Active LTS** (update when LTS rotates)                                  |
| HTTP         | `**fetch` (stdlib); injectable for tests                                              |
| Validation   | `**URL`**, small pure helpers (no `validator` dep)                                    |
| Errors       | **Discriminated unions** + `**Result` for request outcomes                            |
| Tests        | **Vitest** (node + `browser` / `jsdom` or `happy-dom` as needed for DOM-lite APIs)    |
| HTTP mocking | **nock** or **MSW** / **undici** `MockAgent` — pick one compatible with `fetch` in CI |
| Lint/format  | ESLint (typescript-eslint) + Prettier                                                 |
| Build        | **tsup** / **unbuild** / **tsc** — emit `**dist/`, `exports` map, `types`             |
| Browser      | **ESM** for bundlers first; optional **bundled** output later                         |


---

## Release & versioning

- Use `**semantic-release` so version bumps and changelog follow
conventional commits.
- Use
**[semantic-release-npm-github-publish](https://oleg-koval.github.io/semantic-release-npm-github-publish/)**
(maintained publish plugin for **npm** + **GitHub** release assets).
- **Breaking** migration ships as **next major** (e.g. **2.0.0**); document
**BREAKING CHANGE** footer in commits per conventional commits.

---

## Commands (target — align `package.json` during implementation)

```bash
npm ci
npm run build
npm test
npm run lint:fix
npm run test -- --coverage
npx semantic-release   # CI only; local dry-run per plugin docs
```

Fix legacy script drift (e.g. missing `test:nyc`).

---

## Project structure (target)

```
src/
  index.ts              # Public exports
  trembita.ts           # createTrembita + request pipeline
  validate.ts           # Pure: options + endpoint (URL)
  status.ts             # Pure: expected status check → Result
  result.ts             # Shared Result / error union types
test/
  *.test.ts
  fixtures/             # reuse JSON from test/responses where useful
dist/
SPEC.md
```

---

## Code style

- **FP-first**: `**const`**, **pure** helpers, **immutable options types
(`readonly`).
- **Operational errors** — `**Result<Success, FailureUnion>`** for HTTP layer;
reserve `**throw`** for **programmer bugs / assert-level invariants if
used at all (prefer total functions + `Result`).
- **No `any`**; `**unknown**` at JSON boundaries.
- **Imports**: static, top of file.

**Sketch (illustrative):**

```typescript
export type TrembitaOptions = Readonly<{
  endpoint: string;
  fetchImpl?: typeof fetch;
  log?: Logger;
}>;

export const createTrembita = (
  options: TrembitaOptions
): Result<TrembitaClient, TrembitaInitError> => {
  // validateOptions → Result
};

export type RequestResult<T> = Result<T, TrembitaRequestError>;
```

---

## Testing strategy

- **Vitest** with `**coverage.thresholds`** = **100%
lines/branches/functions/statements on `src/`.
- **Unit**: pure `validate` / `status` / union narrowing.
- **Integration**: `fetch` + HTTP mock library against real URLs from options.
- **Browser**: at least one **Vitest `environment: 'node'` +
`happy-dom`/`jsdom`** or `**@vitest/browser**` smoke for code paths that
assume `URL`/`fetch` (choose minimal setup that matches shipped surface).
- **Regression**: v1 behaviors re-encoded as v2 **Result** assertions; document
intentional deltas in CHANGELOG.

---

## Boundaries

### Always

- `**npm test`** + `**npm run build\*\*` before merge.
- **Stdlib-first** runtime deps; justify any new runtime dep in PR.
- **Conventional commits** when using semantic-release.

### Ask first

- **Dual CJS publish** (phase 2).
- **Prebundled browser IIFE** artifact (if script-tag consumers appear).
- **New runtime dependencies** or lowering `engines`.
- **Coverage ignore** lines.

### Never

- `**request`**, `**bluebird\*\*`, unmaintained HTTP stacks.
- Secrets in repo; coverage suppression to fake green.

---

## Success criteria (testable)

1. `strict` TS, **no `any`** in `src/`.
2. Vitest **100%** coverage on `src/`.
3. Zero runtime deps from deprecated list; **stdlib-first** per Locked
  decisions.
4. **ESM** `exports` + types; README **Node + browser** + **migration from v1**.
5. **semantic-release** + **semantic-release-npm-github-publish** configured and
  documented for maintainers.

---

## Optional follow-ups (not blocking v2.0)

- **Dual CJS+ESM** if `require()` consumers are confirmed.
- **Dedicated browser bundle** (CDN script tag) if demand exists.

---

## Phase gate

Spec updated with your answers. Next step: **PLAN** (implementation plan) →
**TASKS** → **IMPLEMENT**. Update this file if any decision changes.