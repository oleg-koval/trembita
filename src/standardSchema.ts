import type { StandardSchemaIssue, TrembitaValidationError } from './errors.js';
import { err, ok, type Result } from './result.js';

/**
 * Minimal [Standard Schema](https://github.com/standard-schema/standard-schema)
 * v1 surface — any compliant library (Zod, Valibot, ArkType, …) can be passed to
 * {@link validateStandardSchema}.
 */
export type StandardSchemaV1<Output = unknown> = Readonly<{
  '~standard': {
    readonly version: 1;
    readonly vendor: string;
    validate: (
      value: unknown
    ) =>
      | Readonly<{ readonly issues: readonly unknown[] }>
      | Readonly<{ readonly value: Output }>
      | Promise<
          | Readonly<{ readonly issues: readonly unknown[] }>
          | Readonly<{ readonly value: Output }>
        >;
  };
}>;

const toIssue = (raw: unknown): StandardSchemaIssue => {
  if (typeof raw !== 'object' || raw === null) {
    return { message: 'unknown_issue' };
  }
  const o = raw as Record<string, unknown>;
  const message =
    typeof o.message === 'string' && o.message.length > 0
      ? o.message
      : 'unknown_issue';
  const path = Array.isArray(o.path)
    ? (o.path as readonly PropertyKey[])
    : undefined;
  return path === undefined ? { message } : { message, path };
};

/**
 * Run a Standard Schema v1 `validate` and return a **Result** (no throws).
 */
export const validateStandardSchema = async <Output>(
  value: unknown,
  schema: StandardSchemaV1<Output>
): Promise<Result<Output, TrembitaValidationError>> => {
  const rawSchema = schema as unknown;
  if (typeof rawSchema !== 'object' || rawSchema === null) {
    return err({
      kind: 'validation_failed',
      issues: [{ message: 'invalid_standard_schema' }]
    });
  }
  const std = (rawSchema as Record<string, unknown>)['~standard'];
  if (
    typeof std !== 'object' ||
    std === null ||
    (std as { readonly version?: unknown }).version !== 1 ||
    typeof (std as { readonly validate?: unknown }).validate !== 'function'
  ) {
    return err({
      kind: 'validation_failed',
      issues: [{ message: 'invalid_standard_schema' }]
    });
  }

  const validateFn = (std as StandardSchemaV1<Output>['~standard']).validate;
  const raw: unknown = await Promise.resolve(validateFn(value));

  if (typeof raw === 'object' && raw !== null && 'issues' in raw) {
    const issuesField = (raw as { readonly issues?: unknown }).issues;
    const list = Array.isArray(issuesField) ? issuesField : [];
    const issues = list.map((i: unknown) => toIssue(i));
    if (issues.length === 0) {
      return err({
        kind: 'validation_failed',
        issues: [{ message: 'schema_issues_empty' }]
      });
    }
    return err({
      kind: 'validation_failed',
      issues
    });
  }

  if (typeof raw === 'object' && raw !== null && 'value' in raw) {
    return ok((raw as { readonly value: Output }).value);
  }

  return err({
    kind: 'validation_failed',
    issues: [{ message: 'standard_schema_validate_shape_unknown' }]
  });
};
