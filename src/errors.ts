export type TrembitaInitError =
  | Readonly<{ kind: 'missing_options' }>
  | Readonly<{ kind: 'options_not_object' }>
  | Readonly<{ kind: 'missing_endpoint' }>
  | Readonly<{ kind: 'endpoint_not_string' }>
  | Readonly<{ kind: 'endpoint_invalid_url'; reason: 'protocol' | 'parse' }>;

export type TrembitaSendError =
  | Readonly<{ kind: 'fetch_failed'; cause: unknown }>
  | Readonly<{ kind: 'timeout'; timeoutMs: number }>
  | Readonly<{ kind: 'circuit_open'; retryAfterMs: number }>
  | Readonly<{ kind: 'invalid_json'; cause: unknown }>
  | Readonly<{
      kind: 'invalid_request_options';
      reason: 'missing_path' | 'path_not_string';
    }>;

export type StandardSchemaIssue = Readonly<{
  message: string;
  path?: readonly PropertyKey[];
}>;

/** Emitted only by `validateStandardSchema` / `requestWithStandardSchema` helpers. */
export type TrembitaValidationError = Readonly<{
  kind: 'validation_failed';
  issues: readonly StandardSchemaIssue[];
}>;

export type TrembitaRequestError =
  | TrembitaSendError
  | Readonly<{
      kind: 'unexpected_status';
      statusCode: number;
      body: unknown;
      request: Readonly<{
        endpoint: string;
        path: string;
        expectedCodes: readonly number[];
      }>;
    }>;
