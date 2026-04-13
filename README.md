# trembita

[![Code Quality](https://github.com/oleg-koval/trembita/actions/workflows/code-quality.yml/badge.svg?branch=main)](https://github.com/oleg-koval/trembita/actions/workflows/code-quality.yml)
[![Coverage Status](https://coveralls.io/repos/github/oleg-koval/trembita/badge.svg?branch=main)](https://coveralls.io/github/oleg-koval/trembita?branch=main)
[![npm version](https://img.shields.io/npm/v/trembita/latest.svg)](https://www.npmjs.com/package/trembita)

Small **TypeScript** helper for calling third-party **HTTP JSON** APIs:
**`fetch`**, strict **`Result`** types, **no** legacy `request` / Bluebird
stack.

## Requirements

- **Node** >= 20.10 (Active LTS recommended).
- **Browser**: bundler + global **`fetch`** and **`URL`** (same ESM entry).

## Install

```shell
npm install trembita
```

## Usage

```typescript
import { createTrembita, HTTP_OK } from 'trembita';

const created = createTrembita({
  endpoint: 'https://api.example.com/v1'
});

if (!created.ok) {
  console.error(created.error);
  process.exit(1);
}

const { request, client } = created.value;

const users = await request({
  path: '/users',
  query: { page: '2' },
  expectedCodes: [HTTP_OK]
});

if (!users.ok) {
  if (users.error.kind === 'unexpected_status') {
    console.error(users.error.statusCode, users.error.body);
  }
  process.exit(1);
}

console.log(users.value);

// Lower level: status + parsed JSON body
const raw = await client({ url: '/health' });
if (raw.ok) {
  console.log(raw.value.statusCode, raw.value.body);
}
```

## Migration from v1.x

| v1                                                     | v2                                                                                                                      |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| `const T = require('trembita')` / `new Trembita(opts)` | `import { createTrembita } from 'trembita'` then **`createTrembita(opts)`** → **`Result`**                              |
| `this.request({ url, qs, expectedCodes })` throwing    | `request({ path or url, query or qs, expectedCodes })` → **`Promise<Result<unknown, TrembitaRequestError>>`**           |
| `catch (UnexpectedStatusCodeError)`                    | Narrow **`!result.ok`** and check **`result.error.kind === 'unexpected_status'`** (prefer **`kind`**, not message text) |
| `request` / `bluebird` / `validator`                   | **`fetch`**, **`URL`**, optional **`fetchImpl`** for tests                                                              |

See **`SPEC.md`** and **`CHANGELOG.md`** for design notes and release semantics
(**semantic-release** +
[semantic-release-npm-github-publish](https://oleg-koval.github.io/semantic-release-npm-github-publish/)).

## Contribute

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT © 2018–2026
