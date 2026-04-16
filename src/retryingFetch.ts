const DEFAULT_RETRY_STATUS = Object.freeze([429, 502, 503, 504] as const);

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const computeBackoffMs = (
  attemptIndex: number,
  baseDelayMs: number,
  maxDelayMs: number,
  jitter: boolean
): number => {
  const exp = baseDelayMs * 2 ** attemptIndex;
  const capped = Math.min(maxDelayMs, exp);
  if (!jitter) {
    return capped;
  }
  return Math.floor(capped * (0.5 + Math.random() * 0.5));
};

export type RetryFetchOptions = Readonly<{
  /** Total attempts including the first try (>= 1). */
  maxAttempts: number;
  /** Base delay before the second attempt (ms). Doubles each retry, capped by maxDelayMs. */
  baseDelayMs: number;
  /** Upper bound for backoff delay (ms). Defaults to 30_000. */
  maxDelayMs?: number;
  /** Add jitter to delay (default true). */
  jitter?: boolean;
  /** Retry when response status matches (default 429, 502, 503, 504). */
  retryStatusCodes?: readonly number[];
  /** Retry when `fetch` throws (default true). */
  retryOnFetchError?: boolean;
}>;

const shouldRetryStatus = (status: number, codes: readonly number[]): boolean =>
  codes.includes(status);

/**
 * Wrap `fetch` with bounded retries + exponential backoff (with optional jitter).
 *
 * Safe for **GET** and other idempotent calls. Retrying **POST** may duplicate
 * side effects — gate with {@link RetryFetchOptions} (`retryStatusCodes`,
 * `retryOnFetchError`).
 */
export const createRetryingFetch = (
  baseFetch: typeof fetch,
  options: RetryFetchOptions
): typeof fetch => {
  const maxAttempts = Math.max(1, Math.floor(options.maxAttempts));
  const baseDelayMs = Math.max(0, options.baseDelayMs);
  const maxDelayMs =
    options.maxDelayMs !== undefined && Number.isFinite(options.maxDelayMs)
      ? Math.max(baseDelayMs, options.maxDelayMs)
      : 30_000;
  const jitter = options.jitter !== false;
  const statusCodes = options.retryStatusCodes ?? [...DEFAULT_RETRY_STATUS];
  const retryOnFetchError = options.retryOnFetchError !== false;

  return async (input, init) => {
    let attempt = 0;
    for (;;) {
      try {
        const response = await baseFetch(input, init);
        const retryable =
          attempt < maxAttempts - 1 &&
          shouldRetryStatus(response.status, statusCodes);
        if (retryable) {
          const delayMs = computeBackoffMs(
            attempt,
            baseDelayMs,
            maxDelayMs,
            jitter
          );
          await sleep(delayMs);
          attempt += 1;
          continue;
        }
        return response;
      } catch (cause) {
        if (!retryOnFetchError || attempt >= maxAttempts - 1) {
          throw cause;
        }
        const delayMs = computeBackoffMs(
          attempt,
          baseDelayMs,
          maxDelayMs,
          jitter
        );
        await sleep(delayMs);
        attempt += 1;
      }
    }
  };
};
