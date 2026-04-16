import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';

const WORKFLOW_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '.github',
  'workflows',
  'npm-release.yml'
);

const TOKEN_SET_CONDITION = "secrets.NPM_TOKEN != ''";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function setupNodeWithBlock(doc: unknown): Record<string, unknown> {
  if (!isRecord(doc)) throw new Error('invalid workflow root');
  const jobs = doc['jobs'];
  if (!isRecord(jobs)) throw new Error('invalid jobs');
  const release = jobs['release'];
  if (!isRecord(release)) throw new Error('invalid release job');
  const steps = release['steps'];
  if (!Array.isArray(steps)) throw new Error('invalid steps');
  const setup = steps.find(
    (step): step is Record<string, unknown> =>
      isRecord(step) && step['uses'] === 'actions/setup-node@v4'
  );
  if (!setup) throw new Error('setup-node step missing');
  const withBlock = setup['with'];
  if (!isRecord(withBlock)) throw new Error('setup-node with: missing');
  return withBlock;
}

function innerExpression(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  const match = /^\$\{\{\s*([\s\S]*?)\s*\}\}$/.exec(raw);
  return match?.[1]?.trim() ?? '';
}

describe('npm-release.yml workflow', () => {
  const doc: unknown = parse(readFileSync(WORKFLOW_PATH, 'utf8'));

  describe('setup-node: always-auth conditional (NPM Trusted Publishing)', () => {
    const withBlock = setupNodeWithBlock(doc);

    it('always-auth is set conditionally based on NPM_TOKEN secret', () => {
      expect(withBlock['always-auth']).toBe("${{ secrets.NPM_TOKEN != '' }}");
    });

    it('always-auth and registry-url use the same NPM_TOKEN condition', () => {
      const registryRaw = withBlock['registry-url'];
      const alwaysAuthRaw = withBlock['always-auth'];
      expect(typeof registryRaw).toBe('string');
      expect(typeof alwaysAuthRaw).toBe('string');
      const registryInner = innerExpression(registryRaw);
      const authInner = innerExpression(alwaysAuthRaw);
      expect(authInner).toBe(TOKEN_SET_CONDITION);
      expect(registryInner.startsWith(`${TOKEN_SET_CONDITION} &&`)).toBe(true);
    });
  });
});
