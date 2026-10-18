import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const temporary = mkdtempSync(join(tmpdir(), 'trembita-packed-consumer-'));
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const run = (args, cwd, options = {}) =>
  execFileSync(npm, args, {
    cwd,
    stdio: 'inherit',
    timeout: 180_000,
    env: { ...process.env, npm_config_ignore_scripts: 'false' },
    ...options
  });

try {
  // Build through the package's real lifecycle before packing without its prepack hook,
  // so only the pack metadata—not build output—is captured as JSON.
  run(['run', 'build'], root);
  const packed = JSON.parse(
    run(
      ['pack', '--json', '--ignore-scripts', '--pack-destination', temporary],
      root,
      {
        stdio: ['ignore', 'pipe', 'inherit'],
        encoding: 'utf8'
      }
    )
  );
  assert.equal(packed.length, 1);
  assert.ok(
    packed[0].files.some(
      ({ path }) => path === 'scripts/patch-npm-vendored.mjs'
    ),
    'the published postinstall script must be included'
  );
  const consumer = join(temporary, 'consumer');
  mkdirSync(consumer);
  writeFileSync(
    join(consumer, 'package.json'),
    JSON.stringify({
      name: 'trembita-packed-consumer',
      private: true,
      type: 'module',
      scripts: { verify: 'node main.mjs' }
    })
  );
  cpSync(join(root, 'examples/packed-consumer'), consumer, { recursive: true });
  run(
    [
      'install',
      '--no-fund',
      '--no-audit',
      '--ignore-scripts=false',
      join(temporary, packed[0].filename)
    ],
    consumer
  );
  run(
    ['rebuild', 'trembita', '--foreground-scripts', '--ignore-scripts=false'],
    consumer
  );
  // Resolve declarations from the installed tarball, not source/workspace aliases.
  execFileSync(
    process.execPath,
    [join(root, 'node_modules/typescript/bin/tsc'), '--project', consumer],
    { cwd: consumer, stdio: 'inherit', timeout: 60_000 }
  );
  run(['run', 'verify'], consumer);
  console.log(
    'packed consumer: install scripts, declarations, native fetch OK'
  );
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
