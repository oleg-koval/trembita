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

  it('uses console as default log', () => {
    const created = createTrembita({ endpoint: 'https://example.com/api' });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }
    expect(created.value.log).toBe(console);
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
    expect(fetchInputToString(usersUrl)).toBe(
      'https://example.com/api/users'
    );
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
    expect(fetchInputToString(queryUrl)).toBe(
      'https://example.com/api/x?c=1'
    );
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
