import { describe, expect, it, vi } from 'vitest';

import {
  createOpenapiClient,
  openapiOperationKey,
  openapiResponseSchemaKey
} from '../src/client.js';

const requestInputToString = (input: RequestInfo | URL): string => {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  return input.url;
};

const okSchema = {
  '~standard': {
    version: 1,
    vendor: 'test',
    validate: (value: unknown) => ({ value })
  }
} as const;

type edgePaths = {
  '/search': {
    get: {
      parameters: {
        path?: never;
        query: { q: string };
      };
      requestBody?: never;
      responses: { 200: { content: { 'application/json': { ok: true } } } };
    };
  };
  '/users/{userId}': {
    get: {
      parameters: { path: { userId: string } };
      requestBody?: never;
      responses: { 200: { content: { 'application/json': unknown } } };
    };
  };
  '/events': {
    post: {
      parameters: { path?: never };
      requestBody: { content: { 'application/json': { name: string } } };
      responses: { 201: { content: { 'application/json': { id: string } } } };
    };
  };
  '/ping': {
    get: {
      parameters: { path?: never };
      requestBody?: never;
      responses: { 204: { content?: never } };
    };
  };
  '/fallback': {
    get: {
      parameters: { path?: never };
      requestBody?: never;
      responses: {
        default: { content: { 'application/json': { ok: boolean } } };
      };
    };
  };
};

describe('createOpenapiClient edge cases', () => {
  it('builds typed operation and response schema keys', () => {
    expect(
      openapiOperationKey<edgePaths, 'GET', '/search'>('GET', '/search')
    ).toBe('GET /search');
    expect(
      openapiResponseSchemaKey<edgePaths, 'GET', '/search', 200>(
        'GET',
        '/search',
        200
      )
    ).toBe('GET /search 200');
  });

  it('returns init errors from the core client', () => {
    const created = createOpenapiClient<edgePaths>({ endpoint: 'ftp://bad' });
    expect(created.ok).toBe(false);
    if (!created.ok) {
      expect(created.error.kind).toBe('endpoint_invalid_url');
    }
  });

  it('returns path expansion errors before calling fetch', async () => {
    const fetchImpl = vi.fn(() =>
      Promise.resolve(new Response('{}', { status: 200 }))
    );
    const created = createOpenapiClient<edgePaths>({
      endpoint: 'https://api.example.test',
      fetchImpl
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const result = await created.value.GET('/users/{userId}', {
      params: { userId: {} } as never
    });

    expect(result.ok).toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
    if (!result.ok) {
      expect(result.error.kind).toBe('openapi_path_unexpanded');
    }
  });

  it('returns send errors from the core client', async () => {
    const fetchImpl = vi.fn(() =>
      Promise.resolve(new Response('{', { status: 200 }))
    );
    const created = createOpenapiClient<edgePaths>({
      endpoint: 'https://api.example.test',
      fetchImpl
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const result = await created.value.GET('/search', {
      query: { q: 'typed' }
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('invalid_json');
    }
  });

  it('ignores validation telemetry failures to preserve Result contract', async () => {
    const fetchImpl = vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify({ ok: true }), { status: 200 })
      )
    );
    const logInfo = vi.fn(() => {
      throw new Error('logger failed');
    });
    const onValidation = vi.fn(() => {
      throw new Error('hook failed');
    });
    const created = createOpenapiClient<edgePaths>({
      endpoint: 'https://api.example.test',
      fetchImpl,
      log: {
        info: logInfo
      },
      onValidation,
      responseSchemas: {
        'GET /search 200': okSchema
      }
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const result = await created.value.GET('/search', {
      query: { q: 'typed' }
    });

    expect(result.ok).toBe(true);
    expect(logInfo).toHaveBeenCalledTimes(1);
    expect(onValidation).toHaveBeenCalledTimes(1);
  });

  it('returns unvalidated bodies when no response schema is configured', async () => {
    const fetchImpl = vi.fn((input: RequestInfo | URL) => {
      expect(requestInputToString(input)).toBe(
        'https://api.example.test/search?q=typed'
      );
      return Promise.resolve(
        new Response(JSON.stringify({ ok: true }), { status: 200 })
      );
    });
    const created = createOpenapiClient<edgePaths>({
      endpoint: 'https://api.example.test',
      fetchImpl
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const result = await created.value.GET('/search', {
      query: { q: 'typed' }
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({ ok: true });
    }
  });

  it('supports 204 responses with no JSON content', async () => {
    const fetchImpl = vi.fn(() =>
      Promise.resolve(new Response(null, { status: 204 }))
    );
    const created = createOpenapiClient<edgePaths>({
      endpoint: 'https://api.example.test',
      fetchImpl
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const result = await created.value.GET('/ping', { expectedStatus: 204 });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBeUndefined();
    }
  });

  it('uses default response schema fallback when status-specific schema is absent', async () => {
    const fetchImpl = vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify({ ok: true }), { status: 202 })
      )
    );
    const created = createOpenapiClient<edgePaths>({
      endpoint: 'https://api.example.test',
      fetchImpl,
      responseSchemas: {
        'GET /fallback default': okSchema
      }
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const result = await created.value.GET('/fallback', {
      expectedStatus: 202
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({ ok: true });
    }
  });

  it('sends JSON bodies and request-level headers', async () => {
    const fetchImpl = vi.fn((_: RequestInfo | URL, init?: RequestInit) => {
      expect(init?.method).toBe('POST');
      expect(init?.body).toBe(JSON.stringify({ name: 'created' }));
      expect(new Headers(init?.headers).get('x-request')).toBe('yes');
      return Promise.resolve(
        new Response(JSON.stringify({ id: 'evt_1' }), { status: 201 })
      );
    });
    const created = createOpenapiClient<edgePaths>({
      endpoint: 'https://api.example.test',
      fetchImpl
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const result = await created.value.POST('/events', {
      headers: { 'x-request': 'yes' },
      body: { name: 'created' },
      expectedStatus: 201
    });

    expect(result.ok).toBe(true);
  });

  it('forwards request-level timeout and abort signal', async () => {
    const controller = new AbortController();
    const fetchImpl = vi.fn((_: RequestInfo | URL, init?: RequestInit) => {
      expect(init?.signal).toBeInstanceOf(AbortSignal);
      return Promise.resolve(
        new Response(JSON.stringify({ ok: true }), { status: 200 })
      );
    });
    const created = createOpenapiClient<edgePaths>({
      endpoint: 'https://api.example.test',
      fetchImpl
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const result = await created.value.GET('/search', {
      query: { q: 'typed' },
      timeoutMs: 100,
      signal: controller.signal
    });

    expect(result.ok).toBe(true);
  });
});
