/**
 * The `npm` package (pulled in by @semantic-release/npm) vendors deps that do not
 * respect package.json overrides. Replace known-vulnerable copies with patched
 * versions we pin as devDependencies (brace-expansion@5.0.5, picomatch@4.0.4).
 */
import { cpSync, existsSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(join(root, 'package.json'));

const npmRoot = join(root, 'node_modules', 'npm', 'node_modules');
if (!existsSync(npmRoot)) {
  process.exit(0);
}

function replaceVendored(destRelative, packageName) {
  const dest = join(npmRoot, destRelative);
  if (!existsSync(dest)) {
    return;
  }
  const src = dirname(require.resolve(`${packageName}/package.json`));
  rmSync(dest, { recursive: true, force: true });
  cpSync(src, dest, { recursive: true });
}

try {
  replaceVendored('brace-expansion', 'brace-expansion');
  replaceVendored(join('tinyglobby', 'node_modules', 'picomatch'), 'picomatch');
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  console.warn('[patch-npm-vendored] skipped:', message);
}
