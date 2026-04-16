import { describe, expect, it } from 'vitest';
import type { StandardSchemaV1 } from '../src/standardSchema.js';
import { validateStandardSchema } from '../src/standardSchema.js';

describe('validateStandardSchema', () => {
  it('returns ok when validate returns value', async () => {
    const schema: StandardSchemaV1<string> = {
      '~standard': {
        version: 1,
        vendor: 'test',
        validate: (v) =>
          typeof v === 'string'
            ? { value: v }
            : { issues: [{ message: 'expected string' }] }
      }
    };
    const r = await validateStandardSchema('x', schema);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe('x');
  });

  it('returns err when validate returns issues', async () => {
    const schema: StandardSchemaV1<string> = {
      '~standard': {
        version: 1,
        vendor: 'test',
        validate: () => ({ issues: [{ message: 'bad', path: ['a'] }] })
      }
    };
    const r = await validateStandardSchema(1, schema);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.kind).toBe('validation_failed');
      expect(r.error.issues[0]?.message).toBe('bad');
    }
  });

  it('supports async validate', async () => {
    const schema: StandardSchemaV1<number> = {
      '~standard': {
        version: 1,
        vendor: 'test',
        validate: async (v) =>
          typeof v === 'number'
            ? { value: v }
            : { issues: [{ message: 'nope' }] }
      }
    };
    const r = await validateStandardSchema(3, schema);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe(3);
  });

  it('rejects invalid schema object', async () => {
    const schema = {} as StandardSchemaV1<string>;
    const r = await validateStandardSchema('x', schema);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.kind).toBe('validation_failed');
      expect(r.error.issues[0]?.message).toBe('invalid_standard_schema');
    }
  });

  it('rejects non-object schema at runtime', async () => {
    const schema = 42 as unknown as StandardSchemaV1<string>;
    const r = await validateStandardSchema('x', schema);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.issues[0]?.message).toBe('invalid_standard_schema');
    }
  });

  it('rejects null schema at runtime', async () => {
    const schema = null as unknown as StandardSchemaV1<string>;
    const r = await validateStandardSchema('x', schema);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.issues[0]?.message).toBe('invalid_standard_schema');
    }
  });

  it('rejects ~standard that is not an object', async () => {
    const schema = {
      '~standard': 'nope'
    } as unknown as StandardSchemaV1<string>;
    const r = await validateStandardSchema('x', schema);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.issues[0]?.message).toBe('invalid_standard_schema');
    }
  });

  it('rejects ~standard with wrong version or missing validate', async () => {
    const wrongVersion = {
      '~standard': { version: 2, validate: () => ({ value: 'x' }) }
    } as unknown as StandardSchemaV1<string>;
    const r1 = await validateStandardSchema('x', wrongVersion);
    expect(r1.ok).toBe(false);

    const noValidate = {
      '~standard': { version: 1, vendor: 't' }
    } as unknown as StandardSchemaV1<string>;
    const r2 = await validateStandardSchema('x', noValidate);
    expect(r2.ok).toBe(false);
    if (!r2.ok) {
      expect(r2.error.issues[0]?.message).toBe('invalid_standard_schema');
    }
  });

  it('maps unknown issue entries', async () => {
    const schema: StandardSchemaV1<string> = {
      '~standard': {
        version: 1,
        vendor: 'test',
        validate: () => ({ issues: [null, { message: '' }, { path: ['x'] }] })
      }
    };
    const r = await validateStandardSchema(1, schema);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.issues.length).toBe(3);
      expect(r.error.issues[1]?.message).toBe('unknown_issue');
    }
  });

  it('rejects validate return shape without issues or value', async () => {
    const schema: StandardSchemaV1<string> = {
      '~standard': {
        version: 1,
        vendor: 'test',
        validate: () =>
          ({ notIssues: true, notValue: true }) as unknown as {
            readonly value: string;
          }
      }
    };
    const r = await validateStandardSchema('x', schema);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.issues[0]?.message).toBe(
        'standard_schema_validate_shape_unknown'
      );
    }
  });

  it('treats non-array issues as empty issues list', async () => {
    const schema: StandardSchemaV1<string> = {
      '~standard': {
        version: 1,
        vendor: 'test',
        validate: () =>
          ({ issues: 'nope' }) as unknown as { readonly issues: readonly [] }
      }
    };
    const r = await validateStandardSchema('x', schema);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.issues[0]?.message).toBe('schema_issues_empty');
    }
  });
});
