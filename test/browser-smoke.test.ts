/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it, vi } from 'vitest';

import { createTrembita } from '../src/index.js';

describe('browser-like environment', () => {
  it('createTrembita works with injected fetch', () => {
    const fetchImpl = vi.fn(() =>
      Promise.resolve(new Response('{}', { status: 200 }))
    );
    const created = createTrembita({
      endpoint: 'https://example.com/api',
      fetchImpl
    });
    expect(created.ok).toBe(true);
  });
});
