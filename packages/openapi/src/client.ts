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
  type TrembitaRequestError,
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
    readonly query?: infer Query;
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

type StatusKey<Op, Status extends number> = Status extends keyof Responses<Op>
  ? Status
  : `${Status}` extends keyof Responses<Op>
    ? `${Status}`
    : never;

type JsonResponse<Op, Status extends number> =
  StatusKey<Op, Status> extends infer Key
    ? Key extends keyof Responses<Op>
      ? Responses<Op>[Key] extends {
          readonly content: { readonly 'application/json': infer Body };
        }
        ? Body
        : unknown
      : unknown
    : unknown;

type RequestBodyOption<Op> =
  JsonRequestBody<Op> extends never
    ? { readonly body?: never }
    : { readonly body: JsonRequestBody<Op> };

export type OpenapiOperationPolicy = Readonly<{
  expectedStatus?: number;
  timeoutMs?: number;
  headers?: Readonly<Record<string, string>>;
}>;

export type OpenapiResponseSchemaMap = Readonly<
  Record<string, StandardSchemaV1>
>;

export type OpenapiClientOptions = Readonly<{
  endpoint: string;
  fetchImpl?: typeof fetch;
  log?: Logger;
  timeoutMs?: number;
  circuitBreaker?: CircuitBreakerOptions;
  policies?: Readonly<Record<string, OpenapiOperationPolicy>>;
  responseSchemas?: OpenapiResponseSchemaMap;
}>;

export type OpenapiInvalidResponseError = Readonly<{
  kind: 'invalid_response';
  method: PublicMethod;
  path: string;
  statusCode: number;
  issues: readonly StandardSchemaIssue[];
}>;

export type OpenapiClientError =
  | ExpandPathError
  | TrembitaSendError
  | TrembitaRequestError
  | OpenapiInvalidResponseError;

export type OpenapiRequestOptions<Op> = Readonly<
  {
    params: PathParams<Op>;
    query?: QueryParams<Op>;
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
  params: Readonly<Record<string, unknown>>;
  query?: Readonly<
    Record<string, string | number | boolean | null | undefined>
  >;
  headers?: Readonly<Record<string, string>>;
  body?: unknown;
  expectedStatus?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
}>;

const policyKey = (method: PublicMethod, path: string): string =>
  `${method} ${path}`;

const schemaKey = (
  method: PublicMethod,
  path: string,
  statusCode: number
): string => `${method} ${path} ${String(statusCode)}`;

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

export const createOpenapiClient = <Paths extends PathRecord>(
  options: OpenapiClientOptions
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
    const expanded = expandOpenapiPath(
      path,
      toPathParams(requestOptions.params)
    );
    if (!expanded.ok) {
      return expanded;
    }

    const policy = options.policies?.[policyKey(method, path)];
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
        statusCode: sent.value.statusCode,
        body: sent.value.body,
        request: {
          endpoint: created.value.endpoint,
          path: sent.value.path,
          expectedCodes: [expectedStatus]
        }
      });
    }

    const schema =
      options.responseSchemas?.[schemaKey(method, path, sent.value.statusCode)];
    if (schema === undefined) {
      return ok(sent.value.body);
    }

    const validated = await validateStandardSchema(sent.value.body, schema);
    if (!validated.ok) {
      return err({
        kind: 'invalid_response',
        method,
        path,
        statusCode: sent.value.statusCode,
        issues: validated.error.issues
      });
    }
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
