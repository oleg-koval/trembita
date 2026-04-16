import { describe, expect, it } from 'vitest';
import { expandOpenapiPath } from '../src/expandPath.js';

describe('expandOpenapiPath', () => {
  it('substitutes path params', () => {
    const r = expandOpenapiPath('/pets/{id}', { id: 2 });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe('/pets/2');
  });

  it('returns err when placeholders remain', () => {
    const r = expandOpenapiPath('/pets/{id}', {});
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.kind).toBe('openapi_path_unexpanded');
      expect(r.error.segments).toContain('id');
    }
  });
});
