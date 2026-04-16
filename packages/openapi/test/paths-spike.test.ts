import { describe, expect, it } from 'vitest';
import type { paths } from '../fixtures/mini-api.paths.js';
import { expandOpenapiPath } from '../src/expandPath.js';

describe('openapi-typescript paths + expandOpenapiPath', () => {
  it('expands a path template that exists in generated paths', () => {
    const template = '/users/{userId}' as const satisfies keyof paths;
    const r = expandOpenapiPath(template, { userId: 'alice' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe('/users/alice');
  });

  it('expands multi-segment path from spec', () => {
    const template =
      '/repos/{owner}/{repo}/issues/{issue_number}' as const satisfies keyof paths;
    const r = expandOpenapiPath(template, {
      owner: 'octocat',
      repo: 'Hello-World',
      issue_number: 42
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value).toBe('/repos/octocat/Hello-World/issues/42');
    }
  });
});
