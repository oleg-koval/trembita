/**
 * Fails if openapi-fetch adds a responseOk-style discriminant or moves FetchResponse.
 * Run in CI on every PR (network) so docs stay honest without manual re-checks.
 */
const URL =
  'https://raw.githubusercontent.com/openapi-ts/openapi-typescript/main/packages/openapi-fetch/src/index.d.ts';

const res = await fetch(URL);
if (!res.ok) {
  process.stderr.write(
    `check-openapi-fetch-types: HTTP ${res.status} fetching upstream types\n`
  );
  process.exit(1);
}
const text = await res.text();
if (text.includes('responseOk')) {
  process.stderr.write(
    'check-openapi-fetch-types: upstream now defines responseOk — update positioning docs.\n'
  );
  process.exit(1);
}
if (!text.includes('export type FetchResponse')) {
  process.stderr.write(
    'check-openapi-fetch-types: FetchResponse not found — upstream path or API may have changed.\n'
  );
  process.exit(1);
}
process.stdout.write(
  'check-openapi-fetch-types: FetchResponse present; no responseOk (ok).\n'
);
