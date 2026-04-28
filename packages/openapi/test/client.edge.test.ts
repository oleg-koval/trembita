import { describe, expect, it, vi } from 'vitest';

import { createOpenapiClient } from '../src/client.js';

const requestInputToString = (input: RequestInfo | URL): string => {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  return input.url;
};

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
};

describe('createOpenapiClient edge cases', () => {
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
      params: {},
      query: { q: 'typed' }
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('invalid_json');
    }
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
      params: {},
      query: { q: 'typed' }
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
      params: {},
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
      params: {},
      query: { q: 'typed' },
      timeoutMs: 100,
      signal: controller.signal
    });

    expect(result.ok).toBe(true);
  });
});
