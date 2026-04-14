import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';

import { HTTP_OK, createTrembita, isOptionsObject } from '../src/index.js';
import type { TrembitaFetchOptions } from '../src/trembita.js';

const dirname = fileURLToPath(new URL('.', import.meta.url));

const expectedBody = JSON.parse(
  readFileSync(`${dirname}/responses/get-users-page-2.json`, 'utf8')
) as unknown;

const noopLogger = {
  trace: (): void => undefined,
  debug: (): void => undefined,
  info: (): void => undefined,
  warn: (): void => undefined,
  error: (): void => undefined
};

function getFetchMockArgs(
  fetchImpl: { mock: { calls: unknown[][] } },
  callIndex = 0
): [RequestInfo | URL, RequestInit | undefined] {
  const row = fetchImpl.mock.calls[callIndex];
  expect(row).toBeDefined();
  return row as [RequestInfo | URL, RequestInit | undefined];
}

function fetchInputToString(input: RequestInfo | URL): string {
  if (typeof input === 'string') {
    return input;
  }
  if (input instanceof URL) {
    return input.href;
  }
  return input.url;
}

describe('isOptionsObject', () => {
  it('returns false for null', () => {
    expect(isOptionsObject(null)).toBe(false);
  });

  it('returns true for function', () => {
    expect(isOptionsObject((): number => 1)).toBe(true);
  });
});

describe('createTrembita', () => {
  const clientOptions = {
    endpoint: 'https://example.com/api',
    log: noopLogger
  };

  it('returns client with client, request, endpoint, log', () => {
    const created = createTrembita(clientOptions);
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }
    expect(created.value).toMatchObject({
      endpoint: clientOptions.endpoint
    });
    expect(created.value.client).toBeTypeOf('function');
    expect(created.value.request).toBeTypeOf('function');
    expect(created.value.log).toBe(noopLogger);
  });

  it('fails when options missing', () => {
    const created = createTrembita(undefined);
    expect(created.ok).toBe(false);
    if (created.ok) {
      return;
    }
    expect(created.error).toEqual({ kind: 'missing_options' });
  });

  it('fails when options not object', () => {
    const created = createTrembita(1);
    expect(created.ok).toBe(false);
    if (created.ok) {
      return;
    }
    expect(created.error).toEqual({ kind: 'options_not_object' });
  });

  it('fails when endpoint missing', () => {
    const created = createTrembita({});
    expect(created.ok).toBe(false);
    if (created.ok) {
      return;
    }
    expect(created.error).toEqual({ kind: 'missing_endpoint' });
  });

  it('fails when endpoint not string', () => {
    const created = createTrembita({ endpoint: 1 });
    expect(created.ok).toBe(false);
    if (created.ok) {
      return;
    }
    expect(created.error).toEqual({ kind: 'endpoint_not_string' });
  });

  it('fails when endpoint not valid url', () => {
    const created = createTrembita({ endpoint: '!url' });
    expect(created.ok).toBe(false);
    if (created.ok) {
      return;
    }
    expect(created.error).toEqual({
      kind: 'endpoint_invalid_url',
      reason: 'parse'
    });
  });

  it('fails when endpoint uses unsupported protocol', () => {
    const created = createTrembita({ endpoint: 'ftp://example.com' });
    expect(created.ok).toBe(false);
    if (created.ok) {
      return;
    }
    expect(created.error).toEqual({
      kind: 'endpoint_invalid_url',
      reason: 'protocol'
    });
  });

  it('fails when protocol missing', () => {
    const created = createTrembita({ endpoint: 'example.com' });
    expect(created.ok).toBe(false);
    if (created.ok) {
      return;
    }
    expect(created.error).toEqual({
      kind: 'endpoint_invalid_url',
      reason: 'parse'
    });
  });

  it('fails when host missing', () => {
    const created = createTrembita({ endpoint: 'http://' });
    expect(created.ok).toBe(false);
    if (created.ok) {
      return;
    }
    expect(created.error).toEqual({
      kind: 'endpoint_invalid_url',
      reason: 'parse'
    });
  });

  it('uses no-op logger as default log', () => {
    const created = createTrembita({ endpoint: 'https://example.com/api' });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }
    expect(created.value.log).toEqual({});
  });

  it('does not write to console when logger not provided', async () => {
    const infoSpy = vi
      .spyOn(console, 'info')
      .mockImplementation(() => undefined);
    const warnSpy = vi
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);
    const errorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const fetchImpl = vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify(expectedBody), { status: HTTP_OK })
      )
    );
    const created = createTrembita({
      endpoint: 'https://example.com/api',
      fetchImpl
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }

    const res = await created.value.request({ path: '/users' });
    expect(res.ok).toBe(true);
    expect(infoSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
    infoSpy.mockRestore();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('emits lifecycle logs when logger provided', async () => {
    const logger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn()
    };
    const fetchImpl = vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify(expectedBody), { status: HTTP_OK })
      )
    );
    const created = createTrembita({
      endpoint: 'https://example.com/api',
      fetchImpl,
      log: logger
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }
    const res = await created.value.request({ path: '/users' });
    expect(res.ok).toBe(true);
    expect(logger.debug).toHaveBeenCalledWith(
      'request:start',
      expect.objectContaining({
        endpoint: 'https://example.com/api',
        path: '/users',
        method: 'GET'
      })
    );
    expect(logger.info).toHaveBeenCalledWith(
      'request:success',
      expect.objectContaining({
        endpoint: 'https://example.com/api',
        path: '/users',
        statusCode: HTTP_OK
      })
    );
  });

  it('redacts sensitive headers in request:start logs', async () => {
    const logger = {
      debug: vi.fn()
    };
    const fetchImpl = vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify(expectedBody), { status: HTTP_OK })
      )
    );
    const created = createTrembita({
      endpoint: 'https://example.com/api',
      fetchImpl,
      log: logger
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }
    const res = await created.value.request({
      path: '/users',
      headers: {
        Authorization: 'Bearer super-secret',
        Cookie: 'session=abc',
        'X-Api-Key': 'token',
        'X-Request-Id': 'req-1'
      }
    });
    expect(res.ok).toBe(true);
    expect(logger.debug).toHaveBeenCalledWith(
      'request:start',
      expect.objectContaining({
        headers: {
          authorization: '[REDACTED]',
          cookie: '[REDACTED]',
          'x-api-key': '[REDACTED]',
          'x-request-id': 'req-1'
        }
      })
    );
  });

  it('emits warning on unexpected status', async () => {
    const logger = {
      warn: vi.fn()
    };
    const fetchImpl = vi.fn(() =>
      Promise.resolve(new Response(undefined, { status: 404 }))
    );
    const created = createTrembita({
      endpoint: 'https://example.com/api',
      fetchImpl,
      log: logger
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }
    const res = await created.value.request({
      path: '/missing',
      expectedCodes: [HTTP_OK]
    });
    expect(res.ok).toBe(false);
    expect(logger.warn).toHaveBeenCalledWith(
      'request:unexpected_status',
      expect.objectContaining({
        endpoint: 'https://example.com/api',
        path: '/missing',
        statusCode: 404,
        expectedCodes: [HTTP_OK]
      })
    );
  });

  it('emits error on fetch failure', async () => {
    const logger = {
      error: vi.fn()
    };
    const fetchImpl = vi.fn(() => Promise.reject(new Error('network')));
    const created = createTrembita({
      endpoint: 'https://example.com/api',
      fetchImpl,
      log: logger
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }
    const res = await created.value.request({ path: '/fail' });
    expect(res.ok).toBe(false);
    expect(logger.error).toHaveBeenCalledWith(
      'request:fetch_failed',
      expect.objectContaining({
        endpoint: 'https://example.com/api',
        path: '/fail',
        errorKind: 'fetch_failed'
      })
    );
  });

  it('client returns status and body', async () => {
    const fetchImpl = vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify(expectedBody), { status: HTTP_OK })
      )
    );
    const created = createTrembita({ ...clientOptions, fetchImpl });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }
    const res = await created.value.client({
      url: '/users',
      qs: { page: 2 },
      expectedCodes: [HTTP_OK]
    });
    expect(res.ok).toBe(true);
    if (!res.ok) {
      return;
    }
    expect(res.value.statusCode).toBe(HTTP_OK);
    expect(res.value.body).toEqual(expectedBody);
    expect(res.value.path).toBe('/users');
    expect(fetchImpl).toHaveBeenCalledOnce();
    const [calledUrl] = getFetchMockArgs(fetchImpl);
    expect(fetchInputToString(calledUrl)).toBe(
      'https://example.com/api/users?page=2'
    );
  });

  it('request returns body when expectedCodes match', async () => {
    const fetchImpl = vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify(expectedBody), { status: HTTP_OK })
      )
    );
    const created = createTrembita({ ...clientOptions, fetchImpl });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }
    const res = await created.value.request({
      url: '/users',
      qs: { page: 2 },
      expectedCodes: [HTTP_OK]
    });
    expect(res.ok).toBe(true);
    if (!res.ok) {
      return;
    }
    expect(res.value).toEqual(expectedBody);
  });

  it('request defaults expectedCodes to 200 and 201', async () => {
    const fetchImpl = vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify(expectedBody), { status: HTTP_OK })
      )
    );
    const created = createTrembita({ ...clientOptions, fetchImpl });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }
    const res = await created.value.request({
      url: '/users',
      qs: { page: 2 }
    });
    expect(res.ok).toBe(true);
    if (!res.ok) {
      return;
    }
    expect(res.value).toEqual(expectedBody);
  });

  it('request accepts NOT_FOUND when expected', async () => {
    const fetchImpl = vi.fn(() =>
      Promise.resolve(new Response(undefined, { status: 404 }))
    );
    const created = createTrembita({ ...clientOptions, fetchImpl });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }
    const res = await created.value.request({
      url: '/profiles',
      expectedCodes: [404]
    });
    expect(res.ok).toBe(true);
    if (!res.ok) {
      return;
    }
    expect(res.value).toBeUndefined();
  });

  it('request returns unexpected_status when code not expected', async () => {
    const fetchImpl = vi.fn(() =>
      Promise.resolve(new Response(undefined, { status: 404 }))
    );
    const created = createTrembita({ ...clientOptions, fetchImpl });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }
    const res = await created.value.request({
      url: '/profiles/1',
      expectedCodes: [HTTP_OK]
    });
    expect(res.ok).toBe(false);
    if (res.ok) {
      return;
    }
    expect(res.error).toEqual({
      kind: 'unexpected_status',
      statusCode: 404,
      body: undefined,
      request: {
        endpoint: clientOptions.endpoint,
        path: '/profiles/1',
        expectedCodes: [HTTP_OK]
      }
    });
  });

  it('request fails when path missing', async () => {
    const created = createTrembita(clientOptions);
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }
    const res = await created.value.request({});
    expect(res.ok).toBe(false);
    if (res.ok) {
      return;
    }
    expect(res.error).toEqual({
      kind: 'invalid_request_options',
      reason: 'missing_path'
    });
  });

  it('client fails when path missing', async () => {
    const created = createTrembita(clientOptions);
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }
    const res = await created.value.client({});
    expect(res.ok).toBe(false);
    if (res.ok) {
      return;
    }
    expect(res.error).toEqual({
      kind: 'invalid_request_options',
      reason: 'missing_path'
    });
  });

  it('client fails when path not string', async () => {
    const created = createTrembita(clientOptions);
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }
    const res = await created.value.client({
      path: 1
    } as unknown as TrembitaFetchOptions);
    expect(res.ok).toBe(false);
    if (res.ok) {
      return;
    }
    expect(res.error).toEqual({
      kind: 'invalid_request_options',
      reason: 'path_not_string'
    });
  });

  it('client fails on invalid json body', async () => {
    const fetchImpl = vi.fn(() =>
      Promise.resolve(new Response('{', { status: HTTP_OK }))
    );
    const created = createTrembita({ ...clientOptions, fetchImpl });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }
    const res = await created.value.client({ path: '/x' });
    expect(res.ok).toBe(false);
    if (res.ok) {
      return;
    }
    expect(res.error.kind).toBe('invalid_json');
  });

  it('client fails on fetch throw', async () => {
    const fetchImpl = vi.fn(() => Promise.reject(new Error('network')));
    const created = createTrembita({ ...clientOptions, fetchImpl });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }
    const res = await created.value.client({ path: '/x' });
    expect(res.ok).toBe(false);
    if (res.ok) {
      return;
    }
    expect(res.error.kind).toBe('fetch_failed');
    if (res.error.kind !== 'fetch_failed') {
      return;
    }
    expect(res.error.cause).toBeInstanceOf(Error);
    expect((res.error.cause as Error).message).toBe('network');
  });

  it('supports query alias and path alias', async () => {
    const fetchImpl = vi.fn(() =>
      Promise.resolve(new Response('{}', { status: HTTP_OK }))
    );
    const created = createTrembita({ ...clientOptions, fetchImpl });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }
    const res = await created.value.client({ path: 'ping', query: { a: 1 } });
    expect(res.ok).toBe(true);
    if (!res.ok) {
      return;
    }
    const [pingUrl] = getFetchMockArgs(fetchImpl);
    expect(fetchInputToString(pingUrl)).toBe(
      'https://example.com/api/ping?a=1'
    );
  });

  it('normalizes trailing slash on endpoint', async () => {
    const fetchImpl = vi.fn(() =>
      Promise.resolve(new Response('{}', { status: HTTP_OK }))
    );
    const created = createTrembita({
      endpoint: 'https://example.com/api/',
      log: noopLogger,
      fetchImpl
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }
    await created.value.client({ path: '/users' });
    const [usersUrl] = getFetchMockArgs(fetchImpl);
    expect(fetchInputToString(usersUrl)).toBe('https://example.com/api/users');
  });

  it('uses explicit method when body absent', async () => {
    const fetchImpl = vi.fn(() =>
      Promise.resolve(new Response('{}', { status: HTTP_OK }))
    );
    const created = createTrembita({ ...clientOptions, fetchImpl });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }
    await created.value.client({ path: '/x', method: 'DELETE' });
    const [, deleteInit] = getFetchMockArgs(fetchImpl);
    expect(deleteInit?.method).toBe('DELETE');
  });

  it('POST json body sets content-type', async () => {
    const fetchImpl = vi.fn(() =>
      Promise.resolve(new Response('{}', { status: HTTP_OK }))
    );
    const created = createTrembita({ ...clientOptions, fetchImpl });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }
    await created.value.client({ path: '/p', body: { a: 1 } });
    const [, postInit] = getFetchMockArgs(fetchImpl);
    expect(postInit?.method).toBe('POST');
    expect(postInit?.body).toBe(JSON.stringify({ a: 1 }));
    const headers = new Headers(postInit?.headers);
    expect(headers.get('content-type')).toBe('application/json');
  });

  it('request propagates invalid_json from client', async () => {
    const fetchImpl = vi.fn(() =>
      Promise.resolve(new Response('{', { status: HTTP_OK }))
    );
    const created = createTrembita({ ...clientOptions, fetchImpl });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }
    const res = await created.value.request({ path: '/x' });
    expect(res.ok).toBe(false);
    if (res.ok) {
      return;
    }
    expect(res.error.kind).toBe('invalid_json');
  });

  it('request returns timeout when timeoutMs is exceeded', async () => {
    const fetchImpl = vi.fn((_: RequestInfo | URL, init?: RequestInit) => {
      return new Promise<Response>((_, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(new Error('aborted'));
        });
      });
    });
    const created = createTrembita({
      ...clientOptions,
      fetchImpl
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }
    const res = await created.value.request({
      path: '/slow',
      timeoutMs: 10
    });
    expect(res.ok).toBe(false);
    if (res.ok) {
      return;
    }
    expect(res.error).toEqual({
      kind: 'timeout',
      timeoutMs: 10
    });
  });

  it('request uses init-level timeout when request timeout not provided', async () => {
    const fetchImpl = vi.fn((_: RequestInfo | URL, init?: RequestInit) => {
      return new Promise<Response>((_, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(new Error('aborted'));
        });
      });
    });
    const created = createTrembita({
      ...clientOptions,
      timeoutMs: 10,
      fetchImpl
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }
    const res = await created.value.request({ path: '/slow' });
    expect(res.ok).toBe(false);
    if (res.ok) {
      return;
    }
    expect(res.error).toEqual({
      kind: 'timeout',
      timeoutMs: 10
    });
  });

  it('opens circuit breaker after consecutive failures', async () => {
    const fetchImpl = vi.fn(() => Promise.reject(new Error('network')));
    const created = createTrembita({
      ...clientOptions,
      fetchImpl,
      circuitBreaker: {
        failureThreshold: 2,
        cooldownMs: 1_000
      }
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }

    const first = await created.value.request({ path: '/unstable' });
    expect(first.ok).toBe(false);
    if (!first.ok) {
      expect(first.error.kind).toBe('fetch_failed');
    }

    const second = await created.value.request({ path: '/unstable' });
    expect(second.ok).toBe(false);
    if (!second.ok) {
      expect(second.error.kind).toBe('fetch_failed');
    }

    const third = await created.value.request({ path: '/unstable' });
    expect(third.ok).toBe(false);
    if (third.ok) {
      return;
    }
    expect(third.error.kind).toBe('circuit_open');
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('counts invalid_json failures in circuit breaker', async () => {
    const fetchImpl = vi.fn(() =>
      Promise.resolve(new Response('{', { status: 200 }))
    );
    const created = createTrembita({
      ...clientOptions,
      fetchImpl,
      circuitBreaker: {
        failureThreshold: 1,
        cooldownMs: 1_000
      }
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }

    const first = await created.value.request({ path: '/broken-json' });
    expect(first.ok).toBe(false);
    if (!first.ok) {
      expect(first.error.kind).toBe('invalid_json');
    }

    const second = await created.value.request({ path: '/broken-json' });
    expect(second.ok).toBe(false);
    if (second.ok) {
      return;
    }
    expect(second.error.kind).toBe('circuit_open');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('counts timeout failures in circuit breaker', async () => {
    const fetchImpl = vi.fn((_: RequestInfo | URL, init?: RequestInit) => {
      return new Promise<Response>((_, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(new Error('aborted'));
        });
      });
    });
    const created = createTrembita({
      ...clientOptions,
      fetchImpl,
      circuitBreaker: {
        failureThreshold: 1,
        cooldownMs: 1_000
      }
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }
    const first = await created.value.request({
      path: '/slow',
      timeoutMs: 10
    });
    expect(first.ok).toBe(false);
    if (!first.ok) {
      expect(first.error.kind).toBe('timeout');
    }

    const second = await created.value.request({
      path: '/slow',
      timeoutMs: 10
    });
    expect(second.ok).toBe(false);
    if (second.ok) {
      return;
    }
    expect(second.error.kind).toBe('circuit_open');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('resets circuit breaker failure count after success', async () => {
    const fetchImpl = vi
      .fn()
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce(new Response('{}', { status: 200 }))
      .mockRejectedValueOnce(new Error('network'))
      .mockRejectedValueOnce(new Error('network'));
    const created = createTrembita({
      ...clientOptions,
      fetchImpl,
      circuitBreaker: {
        failureThreshold: 2,
        cooldownMs: 1_000
      }
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }

    const r1 = await created.value.request({ path: '/unstable' });
    expect(r1.ok).toBe(false);
    const r2 = await created.value.request({ path: '/unstable' });
    expect(r2.ok).toBe(true);
    const r3 = await created.value.request({ path: '/unstable' });
    expect(r3.ok).toBe(false);
    if (!r3.ok) {
      expect(r3.error.kind).toBe('fetch_failed');
    }
    const r4 = await created.value.request({ path: '/unstable' });
    expect(r4.ok).toBe(false);
    if (!r4.ok) {
      expect(r4.error.kind).toBe('fetch_failed');
    }
  });

  it('accepts external abort signal', async () => {
    const fetchImpl = vi.fn((_: RequestInfo | URL, init?: RequestInit) => {
      return new Promise<Response>((_, reject) => {
        if (init?.signal?.aborted) {
          reject(new Error('aborted'));
          return;
        }
        init?.signal?.addEventListener('abort', () => {
          reject(new Error('aborted'));
        });
      });
    });
    const created = createTrembita({
      ...clientOptions,
      fetchImpl
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }
    const abortController = new AbortController();
    const reqPromise = created.value.request({
      path: '/signal',
      signal: abortController.signal
    });
    abortController.abort();
    const res = await reqPromise;
    expect(res.ok).toBe(false);
    if (res.ok) {
      return;
    }
    expect(res.error.kind).toBe('fetch_failed');
  });

  it('handles already-aborted external signal', async () => {
    const fetchImpl = vi.fn((_: RequestInfo | URL, init?: RequestInit) => {
      return new Promise<Response>((_, reject) => {
        if (init?.signal?.aborted) {
          reject(new Error('aborted'));
          return;
        }
        reject(new Error('expected aborted signal'));
      });
    });
    const created = createTrembita({
      ...clientOptions,
      fetchImpl
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }
    const abortController = new AbortController();
    abortController.abort();
    const res = await created.value.request({
      path: '/signal-aborted',
      signal: abortController.signal
    });
    expect(res.ok).toBe(false);
    if (res.ok) {
      return;
    }
    expect(res.error.kind).toBe('fetch_failed');
  });

  it('allows requests again after circuit breaker cooldown', async () => {
    vi.useFakeTimers();
    const fetchImpl = vi.fn(() => Promise.reject(new Error('network')));
    const created = createTrembita({
      ...clientOptions,
      fetchImpl,
      circuitBreaker: {
        failureThreshold: 1,
        cooldownMs: 50
      }
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      vi.useRealTimers();
      return;
    }
    const first = await created.value.request({ path: '/unstable' });
    expect(first.ok).toBe(false);
    const second = await created.value.request({ path: '/unstable' });
    expect(second.ok).toBe(false);
    if (!second.ok) {
      expect(second.error.kind).toBe('circuit_open');
    }

    vi.advanceTimersByTime(51);

    const third = await created.value.request({ path: '/unstable' });
    expect(third.ok).toBe(false);
    if (!third.ok) {
      expect(third.error.kind).toBe('fetch_failed');
    }
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it('parses empty response body as undefined', async () => {
    const fetchImpl = vi.fn(() =>
      Promise.resolve(new Response('', { status: HTTP_OK }))
    );
    const created = createTrembita({ ...clientOptions, fetchImpl });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }
    const res = await created.value.request({ path: '/' });
    expect(res.ok).toBe(true);
    if (!res.ok) {
      return;
    }
    expect(res.value).toBeUndefined();
  });

  it('omits query string when all query values are nullish', async () => {
    const fetchImpl = vi.fn(() =>
      Promise.resolve(new Response('{}', { status: HTTP_OK }))
    );
    const created = createTrembita({ ...clientOptions, fetchImpl });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }
    await created.value.client({
      path: '/only-null',
      query: { a: null, b: undefined }
    });
    const [onlyNullUrl] = getFetchMockArgs(fetchImpl);
    expect(fetchInputToString(onlyNullUrl)).toBe(
      'https://example.com/api/only-null'
    );
  });

  it('skips null and undefined query params', async () => {
    const fetchImpl = vi.fn(() =>
      Promise.resolve(new Response('{}', { status: HTTP_OK }))
    );
    const created = createTrembita({ ...clientOptions, fetchImpl });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }
    await created.value.client({
      path: '/x',
      query: { a: null, b: undefined, c: '1' }
    });
    const [queryUrl] = getFetchMockArgs(fetchImpl);
    expect(fetchInputToString(queryUrl)).toBe('https://example.com/api/x?c=1');
  });

  it('allows string body without forcing json content-type when set', async () => {
    const fetchImpl = vi.fn(() =>
      Promise.resolve(new Response('ok', { status: HTTP_OK }))
    );
    const created = createTrembita({ ...clientOptions, fetchImpl });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }
    await created.value.client({
      path: '/p',
      method: 'PUT',
      body: 'plain',
      headers: { 'Content-Type': 'text/plain' }
    });
    const [, putInit] = getFetchMockArgs(fetchImpl);
    expect(putInit?.body).toBe('plain');
  });
});
