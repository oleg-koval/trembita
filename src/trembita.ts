import { DEFAULT_EXPECTED_CODES } from './constants.js';
import type {
  TrembitaInitError,
  TrembitaRequestError,
  TrembitaSendError
} from './errors.js';
import { err, ok, type Result } from './result.js';
import { appendQuery, joinEndpointPath } from './url.js';
import type { CircuitBreakerOptions, Logger } from './validate.js';
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
  timeoutMs?: number;
  signal?: AbortSignal;
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
  try {
    fn(event, details);
  } catch {
    /* user logger must not break Result/no-throw contract */
  }
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
  const headers = new Headers(options.headers);
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

type BuiltSignal = Readonly<{
  signal: AbortSignal | undefined;
  didTimeout: () => boolean;
  cleanup: () => void;
}>;

const buildSignal = (
  options: TrembitaFetchOptions,
  defaultTimeoutMs: number | undefined
): BuiltSignal => {
  const timeoutMs = options.timeoutMs ?? defaultTimeoutMs;
  const controller = new AbortController();
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  let timedOut = false;

  const onAbort = (): void => {
    controller.abort();
  };
  options.signal?.addEventListener('abort', onAbort);
  if (options.signal?.aborted) {
    controller.abort();
  }

  if (timeoutMs !== undefined) {
    timeoutHandle = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);
  }

  const signal =
    options.signal === undefined && timeoutMs === undefined
      ? undefined
      : controller.signal;

  return {
    signal,
    didTimeout: () => timedOut,
    cleanup: () => {
      options.signal?.removeEventListener('abort', onAbort);
      if (timeoutHandle !== undefined) {
        clearTimeout(timeoutHandle);
      }
    }
  };
};

type CircuitBreakerState = {
  readonly options: CircuitBreakerOptions;
  failures: number;
  openedUntilMs: number | undefined;
};

const isCircuitOpen = (state: CircuitBreakerState): number | undefined => {
  if (state.openedUntilMs === undefined) {
    return undefined;
  }
  const remaining = state.openedUntilMs - Date.now();
  if (remaining <= 0) {
    state.openedUntilMs = undefined;
    state.failures = 0;
    return undefined;
  }
  return remaining;
};

const registerFailure = (state: CircuitBreakerState): void => {
  state.failures += 1;
  if (state.failures >= state.options.failureThreshold) {
    state.openedUntilMs = Date.now() + state.options.cooldownMs;
  }
};

const registerSuccess = (state: CircuitBreakerState): void => {
  state.failures = 0;
  state.openedUntilMs = undefined;
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
  (
    endpoint: string,
    fetchImpl: typeof fetch,
    log: Logger,
    defaultTimeoutMs: number | undefined,
    circuitBreaker: CircuitBreakerState | undefined
  ) =>
  async (
    options: TrembitaFetchOptions
  ): Promise<Result<TrembitaHttpResponse, TrembitaSendError>> => {
    const pathResult = resolvePath(options);
    if (!pathResult.ok) {
      return pathResult;
    }
    if (circuitBreaker !== undefined) {
      const retryAfterMs = isCircuitOpen(circuitBreaker);
      if (retryAfterMs !== undefined) {
        callLog(log, 'warn', 'request:circuit_open', {
          endpoint,
          path: pathResult.value,
          retryAfterMs
        });
        return err({ kind: 'circuit_open', retryAfterMs });
      }
    }

    let fullUrl = joinEndpointPath(endpoint, pathResult.value);
    const query = resolveQuery(options);
    if (query) {
      fullUrl = appendQuery(fullUrl, query);
    }

    const init = buildRequestInit(options);
    const { signal, didTimeout, cleanup } = buildSignal(
      options,
      defaultTimeoutMs
    );
    if (signal !== undefined) {
      init.signal = signal;
    }

    const timeoutMs = options.timeoutMs ?? defaultTimeoutMs;
    const startedAtMs = Date.now();
    callLog(log, 'debug', 'request:start', {
      endpoint,
      path: pathResult.value,
      method: init.method,
      headers: sanitizeHeaders(init.headers)
    });
    try {
      const response = await fetchImpl(fullUrl, init);
      const text = await response.text();
      const bodyResult = parseJsonBody(text);
      if (!bodyResult.ok) {
        if (circuitBreaker !== undefined) {
          registerFailure(circuitBreaker);
        }
        callLog(log, 'error', 'request:invalid_json', {
          endpoint,
          path: pathResult.value,
          statusCode: response.status,
          durationMs: Date.now() - startedAtMs,
          errorKind: bodyResult.error.kind
        });
        return bodyResult;
      }

      if (circuitBreaker !== undefined) {
        registerSuccess(circuitBreaker);
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
      if (timeoutMs !== undefined && didTimeout()) {
        if (circuitBreaker !== undefined) {
          registerFailure(circuitBreaker);
        }
        callLog(log, 'error', 'request:timeout', {
          endpoint,
          path: pathResult.value,
          durationMs: Date.now() - startedAtMs,
          timeoutMs
        });
        return err({ kind: 'timeout', timeoutMs });
      }
      if (circuitBreaker !== undefined) {
        registerFailure(circuitBreaker);
      }
      callLog(log, 'error', 'request:fetch_failed', {
        endpoint,
        path: pathResult.value,
        durationMs: Date.now() - startedAtMs,
        errorKind: 'fetch_failed'
      });
      return err({ kind: 'fetch_failed', cause });
    } finally {
      cleanup();
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
    log = {},
    timeoutMs,
    circuitBreaker
  } = validated.value;

  const circuitState =
    circuitBreaker === undefined
      ? undefined
      : {
          options: circuitBreaker,
          failures: 0,
          openedUntilMs: undefined
        };

  const send = makeSend(endpoint, fetchImpl, log, timeoutMs, circuitState);
  const request = makeRequest(endpoint, send, log);
  return ok({
    endpoint,
    log,
    client: send,
    request
  });
};
