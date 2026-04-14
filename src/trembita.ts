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
  (endpoint: string, fetchImpl: typeof fetch) =>
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
    try {
      const response = await fetchImpl(fullUrl, init);
      const text = await response.text();
      const bodyResult = parseJsonBody(text);
      if (!bodyResult.ok) {
        return bodyResult;
      }
      return ok({
        statusCode: response.status,
        body: bodyResult.value,
        path: pathResult.value
      });
    } catch (cause) {
      return err({ kind: 'fetch_failed', cause });
    }
  };

const makeRequest =
  (endpoint: string, send: ReturnType<typeof makeSend>) =>
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
    log = console
  } = validated.value;
  const send = makeSend(endpoint, fetchImpl);
  const request = makeRequest(endpoint, send);
  return ok({
    endpoint,
    log,
    client: send,
    request
  });
};
