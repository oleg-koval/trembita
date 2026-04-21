/**
 * Testing Trembita with Mock Fetch
 *
 * Shows how to test your API integrations without touching the network.
 * Uses vitest (no global mocking needed).
 */

import { describe, it, expect, vi } from 'vitest';
import {
  createTrembita,
  HTTP_OK,
  HTTP_CREATED,
  type TrembitaClient
} from 'trembita';

const HTTP_NOT_FOUND = 404;

// ============================================================================
// Example: User API Service
// ============================================================================

interface User {
  id: number;
  name: string;
  email: string;
}

async function getUser(client: TrembitaClient, id: number) {
  const result = await client.client({
    path: `/users/${id}`
  });

  if (!result.ok) {
    throw new Error(`Request failed: ${result.error.kind}`);
  }

  const { statusCode, body } = result.value;

  if (statusCode === HTTP_NOT_FOUND) {
    return null;
  }

  return body as User;
}

// ============================================================================
// Tests
// ============================================================================

describe('API Client Tests', () => {
  describe('getUser', () => {
    it('returns user when found', async () => {
      // Mock successful response
      const mockFetch = vi.fn(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              id: 1,
              name: 'Alice',
              email: 'alice@example.com'
            }),
            { status: 200 }
          )
        )
      );

      const api = createTrembita({
        endpoint: 'https://api.example.com',
        fetchImpl: mockFetch
      });

      if (!api.ok) throw api.error;

      const user = await getUser(api.value, 1);

      expect(user).toEqual({
        id: 1,
        name: 'Alice',
        email: 'alice@example.com'
      });

      // Verify fetch was called with correct URL
      expect(mockFetch).toHaveBeenCalledOnce();
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/users/1',
        expect.any(Object)
      );
    });

    it('returns null when user not found', async () => {
      const mockFetch = vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify({ error: 'Not found' }), {
            status: HTTP_NOT_FOUND
          })
        )
      );

      const api = createTrembita({
        endpoint: 'https://api.example.com',
        fetchImpl: mockFetch
      });

      if (!api.ok) throw api.error;

      const user = await getUser(api.value, 999);

      expect(user).toBeNull();
    });

    it('throws when request fails', async () => {
      const mockFetch = vi.fn(() =>
        Promise.reject(new Error('Network timeout'))
      );

      const api = createTrembita({
        endpoint: 'https://api.example.com',
        fetchImpl: mockFetch
      });

      if (!api.ok) throw api.error;

      await expect(getUser(api.value, 1)).rejects.toThrow(
        'Request failed: fetch_failed'
      );
    });

    it('throws on invalid JSON response', async () => {
      const mockFetch = vi.fn(() =>
        Promise.resolve(new Response('Invalid JSON {', { status: 200 }))
      );

      const api = createTrembita({
        endpoint: 'https://api.example.com',
        fetchImpl: mockFetch
      });

      if (!api.ok) throw api.error;

      await expect(getUser(api.value, 1)).rejects.toThrow(
        'Request failed: invalid_json'
      );
    });
  });

  describe('Multiple requests', () => {
    it('handles batch requests', async () => {
      let callCount = 0;

      const mockFetch = vi.fn(() => {
        callCount++;

        return Promise.resolve(
          new Response(
            JSON.stringify({
              id: callCount,
              name: `User ${callCount}`,
              email: `user${callCount}@example.com`
            }),
            { status: 200 }
          )
        );
      });

      const api = createTrembita({
        endpoint: 'https://api.example.com',
        fetchImpl: mockFetch
      });

      if (!api.ok) throw api.error;

      const users = await Promise.all([
        getUser(api.value, 1),
        getUser(api.value, 2),
        getUser(api.value, 3)
      ]);

      expect(users).toHaveLength(3);
      expect(users[0]?.name).toBe('User 1');
      expect(users[1]?.name).toBe('User 2');
      expect(users[2]?.name).toBe('User 3');

      expect(mockFetch).toHaveBeenCalledTimes(3);
    });
  });

  describe('Request validation', () => {
    it('validates endpoint on init', () => {
      const result = createTrembita({
        endpoint: 'not a valid url'
      });

      expect(result.ok).toBe(false);
      expect(result.error.kind).toBe('endpoint_invalid_url');
    });

    it('rejects missing endpoint', () => {
      const result = createTrembita({} as any);

      expect(result.ok).toBe(false);
      expect(result.error.kind).toBe('missing_endpoint');
    });
  });

  describe('Custom headers', () => {
    it('sends custom headers', async () => {
      const mockFetch = vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify({ ok: true }), { status: 200 })
        )
      );

      const api = createTrembita({
        endpoint: 'https://api.example.com',
        fetchImpl: mockFetch
      });

      if (!api.ok) throw api.error;

      await api.value.request({
        path: '/secure',
        headers: {
          Authorization: 'Bearer token123'
        },
        expectedCodes: [HTTP_OK]
      });

      const callArgs = mockFetch.mock.calls[0];
      const requestInit = callArgs[1];

      expect(requestInit.headers.get('Authorization')).toBe('Bearer token123');
    });
  });

  describe('Query parameters', () => {
    it('encodes query params', async () => {
      const mockFetch = vi.fn(() =>
        Promise.resolve(new Response(JSON.stringify([]), { status: 200 }))
      );

      const api = createTrembita({
        endpoint: 'https://api.example.com',
        fetchImpl: mockFetch
      });

      if (!api.ok) throw api.error;

      await api.value.request({
        path: '/users',
        query: {
          search: 'alice',
          limit: '10'
        },
        expectedCodes: [HTTP_OK]
      });

      const url = mockFetch.mock.calls[0][0];

      expect(url).toContain('search=alice');
      expect(url).toContain('limit=10');
    });
  });

  describe('POST requests', () => {
    it('sends JSON body', async () => {
      const mockFetch = vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify({ id: 1, name: 'Bob' }), { status: 201 })
        )
      );

      const api = createTrembita({
        endpoint: 'https://api.example.com',
        fetchImpl: mockFetch
      });

      if (!api.ok) throw api.error;

      await api.value.request({
        path: '/users',
        method: 'POST',
        body: { name: 'Bob', email: 'bob@example.com' },
        expectedCodes: [HTTP_CREATED]
      });

      const callArgs = mockFetch.mock.calls[0];
      const requestInit = callArgs[1];

      expect(requestInit.method).toBe('POST');
      expect(JSON.parse(requestInit.body)).toEqual({
        name: 'Bob',
        email: 'bob@example.com'
      });
    });
  });
});
