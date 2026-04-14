import { DEFAULT_EXPECTED_CODES } from './constants.js';
import type {
  TrembitaInitError,
  TrembitaRequestError,
  TrembitaSendError
} from './errors.js';
import { err, ok, type Result } from './result.js';
import { appendQuery, joinEndpointPath } from './url.js';
import type { Logger } from './validate.js';
import { validateInitOptions } from './validate.js';

export type TrembitaHttpResponse = Readonly<{
  statusCode: number;
  body: unknown;
  /** Resolved request path (from `path` or `url`). */
  path: string;
}>;

export type TrembitaFetchOptions = Readonly<{
  path?: string;
  url?: string;
  method?: string;
  headers?: Readonly<Record<string, string>>;
  query?: Readonly<
    Record<string, string | number | boolean | null | undefined>
  >;
  qs?: Readonly<Record<string, string | number | boolean | null | undefined>>;
  body?: unknown;
  expectedCodes?: readonly number[];
}>;

export type TrembitaClient = Readonly<{
  endpoint: string;
  log: Logger;
  client: (
    options: TrembitaFetchOptions
  ) => Promise<Result<TrembitaHttpResponse, TrembitaSendError>>;
  request: (
    options: TrembitaFetchOptions
  ) => Promise<Result<unknown, TrembitaRequestError>>;
}>;

const SENSITIVE_HEADER_NAMES = new Set([
  'authorization',
  'cookie',
  'set-cookie',
  'x-api-key',
  'proxy-authorization'
]);

const REDACTED_HEADER_VALUE = '[REDACTED]';

const sanitizeHeaders = (
  headers: HeadersInit | undefined
): Readonly<Record<string, string>> => {
  const sanitized: Record<string, string> = {};
  const normalizedHeaders = new Headers(headers);
  normalizedHeaders.forEach((value, key) => {
    sanitized[key] = SENSITIVE_HEADER_NAMES.has(key)
      ? REDACTED_HEADER_VALUE
      : value;
  });
  return sanitized;
};

const callLog = (
  logger: Logger,
  level: keyof Logger,
  event: string,
  details: Readonly<Record<string, unknown>>
): void => {
  const fn = logger[level];
  if (typeof fn !== 'function') {
    return;
  }
  fn(event, details);
};

const resolvePath = (
  options: TrembitaFetchOptions
): Result<string, TrembitaSendError> => {
  const raw = options.url ?? options.path;
  if (raw === undefined) {
    return err({ kind: 'invalid_request_options', reason: 'missing_path' });
  }
  if (typeof raw !== 'string') {
    return err({ kind: 'invalid_request_options', reason: 'path_not_string' });
  }
  return ok(raw);
};

const resolveQuery = (
  options: TrembitaFetchOptions
):
  | Readonly<Record<string, string | number | boolean | null | undefined>>
  | undefined => options.qs ?? options.query;

const buildRequestInit = (options: TrembitaFetchOptions): RequestInit => {
  const method =
    options.method ?? (options.body !== undefined ? 'POST' : 'GET');
  const headers = new Headers(options.headers as HeadersInit | undefined);
  if (options.body !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const body =
    options.body === undefined
      ? undefined
      : typeof options.body === 'string'
        ? options.body
        : JSON.stringify(options.body);
  return { method, headers, body };
};

const parseJsonBody = (text: string): Result<unknown, TrembitaSendError> => {
  if (text.length === 0) {
    return ok(undefined);
  }
  try {
    return ok(JSON.parse(text) as unknown);
  } catch (cause) {
    return err({ kind: 'invalid_json', cause });
  }
};

const makeSend =
  (endpoint: string, fetchImpl: typeof fetch, log: Logger) =>
  async (
    options: TrembitaFetchOptions
  ): Promise<Result<TrembitaHttpResponse, TrembitaSendError>> => {
    const pathResult = resolvePath(options);
    if (!pathResult.ok) {
      return pathResult;
    }
    let fullUrl = joinEndpointPath(endpoint, pathResult.value);
    const query = resolveQuery(options);
    if (query) {
      fullUrl = appendQuery(fullUrl, query);
    }
    const init = buildRequestInit(options);
    const startedAtMs = Date.now();
    callLog(log, 'debug', 'request:start', {
      endpoint,
      path: pathResult.value,
      method: init.method ?? 'GET',
      headers: sanitizeHeaders(init.headers)
    });
    try {
      const response = await fetchImpl(fullUrl, init);
      const text = await response.text();
      const bodyResult = parseJsonBody(text);
      if (!bodyResult.ok) {
        callLog(log, 'error', 'request:invalid_json', {
          endpoint,
          path: pathResult.value,
          statusCode: response.status,
          durationMs: Date.now() - startedAtMs,
          errorKind: bodyResult.error.kind
        });
        return bodyResult;
      }
      callLog(log, 'info', 'request:success', {
        endpoint,
        path: pathResult.value,
        statusCode: response.status,
        durationMs: Date.now() - startedAtMs
      });
      return ok({
        statusCode: response.status,
        body: bodyResult.value,
        path: pathResult.value
      });
    } catch (cause) {
      callLog(log, 'error', 'request:fetch_failed', {
        endpoint,
        path: pathResult.value,
        durationMs: Date.now() - startedAtMs,
        errorKind: 'fetch_failed'
      });
      return err({ kind: 'fetch_failed', cause });
    }
  };

const makeRequest =
  (endpoint: string, send: ReturnType<typeof makeSend>, log: Logger) =>
  async (
    options: TrembitaFetchOptions
  ): Promise<Result<unknown, TrembitaRequestError>> => {
    const sent = await send(options);
    if (!sent.ok) {
      return sent;
    }
    const expectedCodes = options.expectedCodes ?? DEFAULT_EXPECTED_CODES;
    const { statusCode, body, path } = sent.value;
    if (!expectedCodes.includes(statusCode)) {
      callLog(log, 'warn', 'request:unexpected_status', {
        endpoint,
        path,
        statusCode,
        expectedCodes
      });
      return err({
        kind: 'unexpected_status',
        statusCode,
        body,
        request: { endpoint, path, expectedCodes }
      });
    }
    return ok(body);
  };

export const createTrembita = (
  options: unknown
): Result<TrembitaClient, TrembitaInitError> => {
  const validated = validateInitOptions(options);
  if (!validated.ok) {
    return validated;
  }
  const {
    endpoint,
    fetchImpl = globalThis.fetch,
    log = {}
  } = validated.value;
  const send = makeSend(endpoint, fetchImpl, log);
  const request = makeRequest(endpoint, send, log);
  return ok({
    endpoint,
    log,
    client: send,
    request
  });
};
