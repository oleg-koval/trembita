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

describe('npm-release.yml workflow', () => {
  const doc: unknown = parse(readFileSync(WORKFLOW_PATH, 'utf8'));

  describe('setup-node: OIDC-only npm publishing', () => {
    const withBlock = setupNodeWithBlock(doc);

    it('does not set always-auth', () => {
      expect(withBlock['always-auth']).toBeUndefined();
    });

    it('does not set registry-url for token auth', () => {
      expect(withBlock['registry-url']).toBeUndefined();
    });
  });
});
