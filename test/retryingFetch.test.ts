import { describe, expect, it, vi } from 'vitest';
import { createRetryingFetch } from '../src/retryingFetch.js';

describe('createRetryingFetch', () => {
  it('returns first successful response without delay', async () => {
    const base = vi.fn(() =>
      Promise.resolve(new Response('', { status: 200 }))
    );
    const fetchImpl = createRetryingFetch(base, {
      maxAttempts: 3,
      baseDelayMs: 10,
      jitter: false
    });
    const res = await fetchImpl('https://example.test/x');
    expect(res.status).toBe(200);
    expect(base).toHaveBeenCalledTimes(1);
  });

  it('retries on retryable status then succeeds', async () => {
    const base = vi
      .fn()
      .mockResolvedValueOnce(new Response('', { status: 503 }))
      .mockResolvedValueOnce(new Response('', { status: 200 }));
    const fetchImpl = createRetryingFetch(base, {
      maxAttempts: 3,
      baseDelayMs: 0,
      jitter: false
    });
    const res = await fetchImpl('https://example.test/x');
    expect(res.status).toBe(200);
    expect(base).toHaveBeenCalledTimes(2);
  });

  it('returns last response when retries exhausted', async () => {
    const base = vi.fn(() =>
      Promise.resolve(new Response('', { status: 503 }))
    );
    const fetchImpl = createRetryingFetch(base, {
      maxAttempts: 2,
      baseDelayMs: 0,
      jitter: false
    });
    const res = await fetchImpl('https://example.test/x');
    expect(res.status).toBe(503);
    expect(base).toHaveBeenCalledTimes(2);
  });

  it('retries on thrown fetch when enabled', async () => {
    const base = vi
      .fn()
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce(new Response('', { status: 200 }));
    const fetchImpl = createRetryingFetch(base, {
      maxAttempts: 3,
      baseDelayMs: 0,
      jitter: false
    });
    const res = await fetchImpl('https://example.test/x');
    expect(res.status).toBe(200);
    expect(base).toHaveBeenCalledTimes(2);
  });

  it('throws last error when fetch keeps failing', async () => {
    const err = new Error('down');
    const base = vi.fn(() => Promise.reject(err));
    const fetchImpl = createRetryingFetch(base, {
      maxAttempts: 2,
      baseDelayMs: 0,
      jitter: false,
      retryOnFetchError: true
    });
    await expect(fetchImpl('https://example.test/x')).rejects.toThrow('down');
    expect(base).toHaveBeenCalledTimes(2);
  });

  it('does not retry fetch errors when retryOnFetchError is false', async () => {
    const base = vi.fn(() => Promise.reject(new Error('nope')));
    const fetchImpl = createRetryingFetch(base, {
      maxAttempts: 3,
      baseDelayMs: 0,
      jitter: false,
      retryOnFetchError: false
    });
    await expect(fetchImpl('https://example.test/x')).rejects.toThrow('nope');
    expect(base).toHaveBeenCalledTimes(1);
  });

  it('uses explicit maxDelayMs when option is finite', async () => {
    const base = vi
      .fn()
      .mockResolvedValueOnce(new Response('', { status: 503 }))
      .mockResolvedValueOnce(new Response('', { status: 200 }));
    const fetchImpl = createRetryingFetch(base, {
      maxAttempts: 2,
      baseDelayMs: 0,
      maxDelayMs: 500,
      jitter: false
    });
    const res = await fetchImpl('https://example.test/x');
    expect(res.status).toBe(200);
  });

  it('uses default maxDelay when maxDelayMs is not finite', async () => {
    const base = vi
      .fn()
      .mockResolvedValueOnce(new Response('', { status: 503 }))
      .mockResolvedValueOnce(new Response('', { status: 200 }));
    const fetchImpl = createRetryingFetch(base, {
      maxAttempts: 2,
      baseDelayMs: 0,
      maxDelayMs: Number.NaN,
      jitter: false
    });
    const res = await fetchImpl('https://example.test/x');
    expect(res.status).toBe(200);
  });

  it('applies jitter when enabled', async () => {
    const rand = vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const base = vi
      .fn()
      .mockResolvedValueOnce(new Response('', { status: 503 }))
      .mockResolvedValueOnce(new Response('', { status: 200 }));
    const fetchImpl = createRetryingFetch(base, {
      maxAttempts: 2,
      baseDelayMs: 100,
      jitter: true
    });
    const res = await fetchImpl('https://example.test/x');
    expect(res.status).toBe(200);
    rand.mockRestore();
  });

  it('honors custom empty retry status list (no status retries)', async () => {
    const base = vi.fn(() =>
      Promise.resolve(new Response('', { status: 503 }))
    );
    const fetchImpl = createRetryingFetch(base, {
      maxAttempts: 3,
      baseDelayMs: 0,
      jitter: false,
      retryStatusCodes: []
    });
    const res = await fetchImpl('https://example.test/x');
    expect(res.status).toBe(503);
    expect(base).toHaveBeenCalledTimes(1);
  });
});
