import { describe, expect, it, vi } from 'vitest';
import type { TrembitaClient } from 'trembita';
import { err, ok } from 'trembita';
import { requestOpenapiPath } from '../src/requestOpenapiPath.js';

describe('requestOpenapiPath', () => {
  it('returns expand error without calling request', async () => {
    const request = vi.fn();
    const client = { request } as unknown as TrembitaClient;
    const r = await requestOpenapiPath(
      client,
      '/pets/{id}',
      {},
      {
        expectedCodes: [200]
      }
    );
    expect(request).not.toHaveBeenCalled();
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe('openapi_path_unexpanded');
  });

  it('calls request with expanded path', async () => {
    const request = vi.fn(() => Promise.resolve(ok({ id: 3 })));
    const client = { request } as unknown as TrembitaClient;
    const r = await requestOpenapiPath(
      client,
      '/pets/{id}',
      { id: 3 },
      {
        method: 'GET',
        expectedCodes: [200]
      }
    );
    expect(request).toHaveBeenCalledWith({
      method: 'GET',
      expectedCodes: [200],
      path: '/pets/3'
    });
    expect(r.ok).toBe(true);
  });

  it('forwards request failure', async () => {
    const request = vi.fn(() =>
      Promise.resolve(
        err({
          kind: 'unexpected_status',
          statusCode: 404,
          body: null,
          request: {
            endpoint: 'https://x',
            path: '/pets/1',
            expectedCodes: [200]
          }
        })
      )
    );
    const client = { request } as unknown as TrembitaClient;
    const r = await requestOpenapiPath(
      client,
      '/pets/{id}',
      { id: 1 },
      {
        expectedCodes: [200]
      }
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe('unexpected_status');
  });
});
