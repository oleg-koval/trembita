import { describe, expect, it, vi } from 'vitest';

import { createOpenapiClient, type StandardSchemaV1 } from '../src/index.js';
import type { paths } from '../fixtures/mini-api.paths.js';

type User = Readonly<{ id: string; name: string }>;

const requestInputToString = (input: RequestInfo | URL): string => {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  return input.url;
};

const userSchema = {
  '~standard': {
    version: 1,
    vendor: 'test',
    validate: (value: unknown) => {
      if (
        typeof value === 'object' &&
        value !== null &&
        typeof (value as { readonly id?: unknown }).id === 'string' &&
        typeof (value as { readonly name?: unknown }).name === 'string'
      ) {
        return { value: value as User };
      }
      return { issues: [{ message: 'user_invalid' }] };
    }
  }
} satisfies StandardSchemaV1<User>;

describe('createOpenapiClient e2e', () => {
  it('expands OpenAPI paths, applies policy, validates response, and returns Result data', async () => {
    const fetchImpl = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      expect(requestInputToString(input)).toBe(
        'https://api.example.test/users/alice'
      );
      expect(init?.method).toBe('GET');
      expect(new Headers(init?.headers).get('x-service')).toBe('accounts');
      return Promise.resolve(
        new Response(JSON.stringify({ id: 'alice', name: 'Alice' }), {
          status: 200
        })
      );
    });

    const created = createOpenapiClient<paths>({
      endpoint: 'https://api.example.test',
      fetchImpl,
      policies: {
        'GET /users/{userId}': {
          expectedStatus: 200,
          timeoutMs: 500,
          headers: { 'x-service': 'accounts' }
        }
      },
      responseSchemas: {
        'GET /users/{userId} 200': userSchema
      }
    });

    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const result = await created.value.GET('/users/{userId}', {
      params: { userId: 'alice' }
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.name).toBe('Alice');
    }
  });

  it('returns invalid_response when the downstream body violates the schema', async () => {
    const fetchImpl = vi.fn(() =>
      Promise.resolve(new Response(JSON.stringify({ id: 1 }), { status: 200 }))
    );
    const created = createOpenapiClient<paths>({
      endpoint: 'https://api.example.test',
      fetchImpl,
      responseSchemas: {
        'GET /users/{userId} 200': userSchema
      }
    });

    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const result = await created.value.GET('/users/{userId}', {
      params: { userId: 'alice' }
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('invalid_response');
      if (result.error.kind === 'invalid_response') {
        expect(result.error.operationKey).toBe('GET /users/{userId}');
        expect(result.error.schemaKey).toBe('GET /users/{userId} 200');
        expect(result.error.path).toBe('/users/alice');
        expect(result.error.issues).toContainEqual({ message: 'user_invalid' });
      }
    }
  });

  it('returns unexpected_status before schema validation', async () => {
    const fetchImpl = vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify({ message: 'missing' }), { status: 404 })
      )
    );
    const created = createOpenapiClient<paths>({
      endpoint: 'https://api.example.test',
      fetchImpl
    });

    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const result = await created.value.GET('/users/{userId}', {
      params: { userId: 'alice' }
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('unexpected_status');
      if (result.error.kind === 'unexpected_status') {
        expect(result.error.operationKey).toBe('GET /users/{userId}');
        expect(result.error.template).toBe('/users/{userId}');
      }
    }
  });
});
