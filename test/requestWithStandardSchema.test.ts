import { describe, expect, it, vi } from 'vitest';
import { HTTP_OK } from '../src/constants.js';
import { createTrembita } from '../src/trembita.js';
import type { StandardSchemaV1 } from '../src/standardSchema.js';
import { requestWithStandardSchema } from '../src/requestWithStandardSchema.js';

describe('requestWithStandardSchema', () => {
  it('returns validation error when body does not match schema', async () => {
    const fetchImpl = vi.fn(() =>
      Promise.resolve(new Response(JSON.stringify({ id: 1 }), { status: 200 }))
    );
    const created = createTrembita({
      endpoint: 'https://api.test',
      fetchImpl
    });
    if (!created.ok) throw new Error('init');
    const schema: StandardSchemaV1<{ id: string }> = {
      '~standard': {
        version: 1,
        vendor: 'test',
        validate: (v) =>
          typeof v === 'object' &&
          v !== null &&
          typeof (v as { id?: unknown }).id === 'string'
            ? { value: v as { id: string } }
            : { issues: [{ message: 'id must be string' }] }
      }
    };
    const r = await requestWithStandardSchema(
      created.value,
      {
        path: '/x',
        expectedCodes: [HTTP_OK]
      },
      schema
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe('validation_failed');
  });

  it('returns request error without running schema', async () => {
    const fetchImpl = vi.fn(() =>
      Promise.resolve(new Response(JSON.stringify({}), { status: 500 }))
    );
    const created = createTrembita({
      endpoint: 'https://api.test',
      fetchImpl
    });
    if (!created.ok) throw new Error('init');
    const schema: StandardSchemaV1<{ id: string }> = {
      '~standard': {
        version: 1,
        vendor: 'test',
        validate: () => ({ issues: [{ message: 'should not run' }] })
      }
    };
    const r = await requestWithStandardSchema(
      created.value,
      {
        path: '/x',
        expectedCodes: [HTTP_OK]
      },
      schema
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe('unexpected_status');
  });

  it('returns typed value when schema passes', async () => {
    const fetchImpl = vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify({ id: 'a' }), { status: 200 })
      )
    );
    const created = createTrembita({
      endpoint: 'https://api.test',
      fetchImpl
    });
    if (!created.ok) throw new Error('init');
    const schema: StandardSchemaV1<{ id: string }> = {
      '~standard': {
        version: 1,
        vendor: 'test',
        validate: (v) =>
          typeof v === 'object' &&
          v !== null &&
          typeof (v as { id?: unknown }).id === 'string'
            ? { value: v as { id: string } }
            : { issues: [{ message: 'bad' }] }
      }
    };
    const r = await requestWithStandardSchema(
      created.value,
      {
        path: '/x',
        expectedCodes: [HTTP_OK]
      },
      schema
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.id).toBe('a');
  });
});
