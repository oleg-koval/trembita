import { statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const pkgRoot = join(here, '..');
const repoRoot = join(pkgRoot, '..', '..');

const kb = (n) => `${(n / 1024).toFixed(2)} KiB`;

const report = (label, absPath) => {
  const { size } = statSync(absPath);
  process.stdout.write(`${label}\t${size} bytes (${kb(size)})\n`);
};

process.stdout.write(
  'Spike bundle metrics (run after `npm run build` in repo root)\n\n'
);

report('trembita dist/index.js', join(repoRoot, 'dist', 'index.js'));
report('trembita dist/index.d.ts', join(repoRoot, 'dist', 'index.d.ts'));
report('@trembita/openapi dist/index.js', join(pkgRoot, 'dist', 'index.js'));
report(
  '@trembita/openapi dist/index.d.ts',
  join(pkgRoot, 'dist', 'index.d.ts')
);
report(
  'openapi-typescript fixture (types only; not bundled)',
  join(pkgRoot, 'fixtures', 'mini-api.paths.ts')
);
