import {
  createTrembita,
  err,
  ok,
  validateStandardSchema,
  type CircuitBreakerOptions,
  type Logger,
  type Result,
  type StandardSchemaIssue,
  type StandardSchemaV1,
  type TrembitaInitError,
  type TrembitaSendError
} from 'trembita';

import { expandOpenapiPath, type ExpandPathError } from './expandPath.js';

type OpenapiMethod =
  | 'get'
  | 'put'
  | 'post'
  | 'delete'
  | 'options'
  | 'head'
  | 'patch'
  | 'trace';

type PublicMethod = Uppercase<OpenapiMethod>;

type LowerMethod<M extends PublicMethod> = Lowercase<M> & OpenapiMethod;

type PathRecord = object;

type MethodOperation<PathItem, M extends PublicMethod> =
  LowerMethod<M> extends keyof PathItem
    ? NonNullable<PathItem[LowerMethod<M>]>
    : never;

type PathsForMethod<Paths extends PathRecord, M extends PublicMethod> = {
  [Path in keyof Paths]: MethodOperation<Paths[Path], M> extends never
    ? never
    : Path;
}[keyof Paths] &
  string;

type Operation<
  Paths extends PathRecord,
  M extends PublicMethod,
  Path extends keyof Paths
> = MethodOperation<Paths[Path], M>;

type OperationParameters<Op> = Op extends {
  readonly parameters: infer Parameters;
}
  ? Parameters
  : Record<string, never>;

type PathParams<Op> =
  OperationParameters<Op> extends {
    readonly path: infer Params;
  }
    ? Params extends never
      ? Record<string, never>
      : Params
    : Record<string, never>;

type QueryParams<Op> =
  OperationParameters<Op> extends {
    readonly query: infer Query;
  }
    ? Query extends never
      ? Record<string, never>
      : Query
    : Record<string, never>;

type HeaderParams<Op> =
  OperationParameters<Op> extends {
    readonly header?: infer Header;
  }
    ? Header extends never
      ? Record<string, string>
      : Header
    : Record<string, string>;

type JsonRequestBody<Op> = Op extends {
  readonly requestBody: {
    readonly content: { readonly 'application/json': infer Body };
  };
}
  ? Body
  : never;

type Responses<Op> = Op extends { readonly responses: infer R } ? R : never;

type StatusFromKey<Key> = Key extends number
  ? Key
  : Key extends `${infer Status extends number}`
    ? Status
    : never;

type KnownStatus<Op> = StatusFromKey<keyof Responses<Op>>;

type StatusKey<Op, Status extends number> = Status extends keyof Responses<Op>
  ? Status
  : `${Status}` extends keyof Responses<Op>
    ? `${Status}`
    : 'default' extends keyof Responses<Op>
      ? 'default'
      : never;

type JsonResponse<Op, Status extends number> =
  StatusKey<Op, Status> extends infer Key
    ? Key extends keyof Responses<Op>
      ? Responses<Op>[Key] extends {
          readonly content: { readonly 'application/json': infer Body };
        }
        ? Body
        : undefined
      : unknown
    : unknown;

type EmptyObject<T> = [T] extends [Record<string, never>]
  ? true
  : keyof T extends never
    ? true
    : false;

type PathParamsOption<Op> =
  EmptyObject<PathParams<Op>> extends true
    ? { readonly params?: never }
    : { readonly params: PathParams<Op> };

type QueryOption<Op> =
  EmptyObject<QueryParams<Op>> extends true
    ? { readonly query?: never }
    : { readonly query: QueryParams<Op> };

type RequestBodyOption<Op> =
  JsonRequestBody<Op> extends never
    ? { readonly body?: never }
    : { readonly body: JsonRequestBody<Op> };

export type OpenapiOperationKey<Paths extends PathRecord> = {
  [M in PublicMethod]: `${M} ${PathsForMethod<Paths, M>}`;
}[PublicMethod];

export type OpenapiResponseSchemaKey<Paths extends PathRecord> = {
  [M in PublicMethod]: {
    [Path in PathsForMethod<Paths, M>]:
      | `${M} ${Path} ${KnownStatus<Operation<Paths, M, Path>>}`
      | `${M} ${Path} default`;
  }[PathsForMethod<Paths, M>];
}[PublicMethod];

export type OpenapiOperationPolicy = Readonly<{
  expectedStatus?: number;
  timeoutMs?: number;
  headers?: Readonly<Record<string, string>>;
}>;

export type OpenapiPolicyMap<Paths extends PathRecord> = Readonly<
  Partial<Record<OpenapiOperationKey<Paths>, OpenapiOperationPolicy>>
>;

export type OpenapiResponseSchemaMap<Paths extends PathRecord> = Readonly<
  Partial<Record<OpenapiResponseSchemaKey<Paths>, StandardSchemaV1>>
>;

export type OpenapiValidationEvent = Readonly<{
  operationKey: string;
  schemaKey: string;
  method: PublicMethod;
  template: string;
  path: string;
  statusCode: number;
  durationMs: number;
  ok: boolean;
  issueCount: number;
}>;

export type OpenapiClientOptions<Paths extends PathRecord> = Readonly<{
  endpoint: string;
  fetchImpl?: typeof fetch;
  log?: Logger;
  timeoutMs?: number;
  circuitBreaker?: CircuitBreakerOptions;
  policies?: OpenapiPolicyMap<Paths>;
  responseSchemas?: OpenapiResponseSchemaMap<Paths>;
  onValidation?: (event: OpenapiValidationEvent) => void;
}>;

export type OpenapiInvalidResponseError = Readonly<{
  kind: 'invalid_response';
  operationKey: string;
  schemaKey: string;
  method: PublicMethod;
  template: string;
  path: string;
  statusCode: number;
  issues: readonly StandardSchemaIssue[];
}>;

export type OpenapiUnexpectedStatusError = Readonly<{
  kind: 'unexpected_status';
  operationKey: string;
  method: PublicMethod;
  template: string;
  statusCode: number;
  body: unknown;
  request: Readonly<{
    endpoint: string;
    path: string;
    expectedCodes: readonly number[];
  }>;
}>;

export type OpenapiClientError =
  | ExpandPathError
  | TrembitaSendError
  | OpenapiUnexpectedStatusError
  | OpenapiInvalidResponseError;

export type OpenapiRequestOptions<Op> = Readonly<
  PathParamsOption<Op> &
    QueryOption<Op> & {
      headers?: HeaderParams<Op> & Readonly<Record<string, string>>;
      expectedStatus?: number;
      timeoutMs?: number;
      signal?: AbortSignal;
    } & RequestBodyOption<Op>
>;

type OpenapiCall<Paths extends PathRecord, M extends PublicMethod> = <
  Path extends PathsForMethod<Paths, M>,
  Status extends number = 200
>(
  path: Path,
  options: OpenapiRequestOptions<Operation<Paths, M, Path>> &
    Readonly<{ expectedStatus?: Status }>
) => Promise<
  Result<JsonResponse<Operation<Paths, M, Path>, Status>, OpenapiClientError>
>;

export type OpenapiClient<Paths extends PathRecord> = Readonly<{
  GET: OpenapiCall<Paths, 'GET'>;
  PUT: OpenapiCall<Paths, 'PUT'>;
  POST: OpenapiCall<Paths, 'POST'>;
  DELETE: OpenapiCall<Paths, 'DELETE'>;
  PATCH: OpenapiCall<Paths, 'PATCH'>;
}>;

type RuntimeRequestOptions = Readonly<{
  params?: Readonly<Record<string, unknown>>;
  query?: Readonly<
    Record<string, string | number | boolean | null | undefined>
  >;
  headers?: Readonly<Record<string, string>>;
  body?: unknown;
  expectedStatus?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
}>;

export const openapiOperationKey = <
  Paths extends PathRecord,
  M extends PublicMethod = PublicMethod,
  Path extends PathsForMethod<Paths, M> = PathsForMethod<Paths, M>
>(
  method: M,
  path: Path
): `${M} ${Path}` => `${method} ${path}`;

export const openapiResponseSchemaKey = <
  Paths extends PathRecord,
  M extends PublicMethod = PublicMethod,
  Path extends PathsForMethod<Paths, M> = PathsForMethod<Paths, M>,
  Status extends KnownStatus<Operation<Paths, M, Path>> | 'default' =
    | KnownStatus<Operation<Paths, M, Path>>
    | 'default'
>(
  method: M,
  path: Path,
  status: Status
): `${M} ${Path} ${Status}` =>
  `${method} ${path} ${String(status)}` as `${M} ${Path} ${Status}`;

const toPathParams = (
  params: Readonly<Record<string, unknown>>
): Readonly<Record<string, string | number>> => {
  const converted: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'string' || typeof value === 'number') {
      converted[key] = value;
    }
  }
  return converted;
};

const mergeHeaders = (
  policyHeaders: Readonly<Record<string, string>> | undefined,
  requestHeaders: Readonly<Record<string, string>> | undefined
): Readonly<Record<string, string>> | undefined => {
  if (policyHeaders === undefined && requestHeaders === undefined) {
    return undefined;
  }
  return {
    ...(policyHeaders ?? {}),
    ...(requestHeaders ?? {})
  };
};

const nowMs = (): number => performance.now();

const reportValidation = (
  logger: Logger | undefined,
  onValidation: ((event: OpenapiValidationEvent) => void) | undefined,
  event: OpenapiValidationEvent
): void => {
  try {
    logger?.info?.('openapi:response_validation', event);
  } catch {
    /* user logger must not break Result/no-throw contract */
  }
  try {
    onValidation?.(event);
  } catch {
    /* user hook must not break Result/no-throw contract */
  }
};

const findResponseSchema = <Paths extends PathRecord>(
  responseSchemas: OpenapiResponseSchemaMap<Paths> | undefined,
  method: PublicMethod,
  path: string,
  statusCode: number
): Readonly<{ key: string; schema: StandardSchemaV1 }> | undefined => {
  const exactKey = `${method} ${path} ${String(statusCode)}`;
  const exact = responseSchemas?.[exactKey as OpenapiResponseSchemaKey<Paths>];
  if (exact !== undefined) {
    return { key: exactKey, schema: exact };
  }
  const defaultKey = `${method} ${path} default`;
  const fallback =
    responseSchemas?.[defaultKey as OpenapiResponseSchemaKey<Paths>];
  return fallback === undefined
    ? undefined
    : { key: defaultKey, schema: fallback };
};

export const createOpenapiClient = <Paths extends PathRecord>(
  options: OpenapiClientOptions<Paths>
): Result<OpenapiClient<Paths>, TrembitaInitError> => {
  const created = createTrembita(options);
  if (!created.ok) {
    return created;
  }

  const request = async (
    method: PublicMethod,
    path: string,
    requestOptions: RuntimeRequestOptions
  ): Promise<Result<unknown, OpenapiClientError>> => {
    const operationKey = `${method} ${path}`;
    const expanded = expandOpenapiPath(
      path,
      toPathParams(requestOptions.params ?? {})
    );
    if (!expanded.ok) {
      return expanded;
    }

    const policy =
      options.policies?.[operationKey as OpenapiOperationKey<Paths>];
    const expectedStatus =
      requestOptions.expectedStatus ?? policy?.expectedStatus ?? 200;
    const headers = mergeHeaders(policy?.headers, requestOptions.headers);
    const timeoutMs = requestOptions.timeoutMs ?? policy?.timeoutMs;
    const sent = await created.value.client({
      path: expanded.value,
      method,
      ...(requestOptions.query === undefined
        ? {}
        : { query: requestOptions.query }),
      ...(headers === undefined ? {} : { headers }),
      ...('body' in requestOptions ? { body: requestOptions.body } : {}),
      expectedCodes: [expectedStatus],
      ...(timeoutMs === undefined ? {} : { timeoutMs }),
      ...(requestOptions.signal === undefined
        ? {}
        : { signal: requestOptions.signal })
    });

    if (!sent.ok) {
      return sent;
    }

    if (sent.value.statusCode !== expectedStatus) {
      return err({
        kind: 'unexpected_status',
        operationKey,
        method,
        template: path,
        statusCode: sent.value.statusCode,
        body: sent.value.body,
        request: {
          endpoint: created.value.endpoint,
          path: sent.value.path,
          expectedCodes: [expectedStatus]
        }
      });
    }

    const schema = findResponseSchema(
      options.responseSchemas,
      method,
      path,
      sent.value.statusCode
    );
    if (schema === undefined) {
      return ok(sent.value.body);
    }

    const validationStartedMs = nowMs();
    const validated = await validateStandardSchema(
      sent.value.body,
      schema.schema
    );
    const durationMs = nowMs() - validationStartedMs;
    if (!validated.ok) {
      reportValidation(options.log, options.onValidation, {
        operationKey,
        schemaKey: schema.key,
        method,
        template: path,
        path: sent.value.path,
        statusCode: sent.value.statusCode,
        durationMs,
        ok: false,
        issueCount: validated.error.issues.length
      });
      return err({
        kind: 'invalid_response',
        operationKey,
        schemaKey: schema.key,
        method,
        template: path,
        path: sent.value.path,
        statusCode: sent.value.statusCode,
        issues: validated.error.issues
      });
    }
    reportValidation(options.log, options.onValidation, {
      operationKey,
      schemaKey: schema.key,
      method,
      template: path,
      path: sent.value.path,
      statusCode: sent.value.statusCode,
      durationMs,
      ok: true,
      issueCount: 0
    });
    return ok(validated.value);
  };

  const call = <M extends PublicMethod>(method: M): OpenapiCall<Paths, M> => {
    return ((path: string, requestOptions: unknown) =>
      request(
        method,
        path,
        requestOptions as RuntimeRequestOptions
      )) as OpenapiCall<Paths, M>;
  };

  return ok({
    GET: call('GET'),
    PUT: call('PUT'),
    POST: call('POST'),
    DELETE: call('DELETE'),
    PATCH: call('PATCH')
  });
};
