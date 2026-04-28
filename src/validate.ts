import { err, ok, type Result } from './result.js';
import type { TrembitaInitError } from './errors.js';
import { validateHttpEndpoint } from './url.js';

export type Logger = Readonly<
  Partial<{
    trace: (...args: readonly unknown[]) => void;
    debug: (...args: readonly unknown[]) => void;
    info: (...args: readonly unknown[]) => void;
    warn: (...args: readonly unknown[]) => void;
    error: (...args: readonly unknown[]) => void;
  }>
>;

export type CircuitBreakerOptions = Readonly<{
  failureThreshold: number;
  cooldownMs: number;
}>;

export type TrembitaInitOptions = Readonly<{
  endpoint: string;
  log?: Logger;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  circuitBreaker?: CircuitBreakerOptions;
}>;

export const isOptionsObject = (value: unknown): boolean => {
  if (value === null) {
    return false;
  }
  const t = typeof value;
  return t === 'object' || t === 'function';
};

export const validateInitOptions = (
  options: unknown
): Result<TrembitaInitOptions, TrembitaInitError> => {
  if (options === undefined || options === null) {
    return err({ kind: 'missing_options' });
  }
  if (!isOptionsObject(options)) {
    return err({ kind: 'options_not_object' });
  }
  const o = options as Record<string, unknown>;
  if (!('endpoint' in o) || o.endpoint === undefined || o.endpoint === null) {
    return err({ kind: 'missing_endpoint' });
  }
  if (typeof o.endpoint !== 'string') {
    return err({ kind: 'endpoint_not_string' });
  }
  const endpointResult = validateHttpEndpoint(o.endpoint);
  if (!endpointResult.ok) {
    return endpointResult;
  }

  const timeoutMs =
    typeof o.timeoutMs === 'number' &&
    Number.isFinite(o.timeoutMs) &&
    o.timeoutMs > 0
      ? o.timeoutMs
      : undefined;

  const circuitBreaker =
    typeof o.circuitBreaker === 'object' && o.circuitBreaker !== null
      ? (o.circuitBreaker as Record<string, unknown>)
      : undefined;
  const failureThreshold =
    typeof circuitBreaker?.failureThreshold === 'number' &&
    Number.isFinite(circuitBreaker.failureThreshold) &&
    circuitBreaker.failureThreshold > 0
      ? Math.floor(circuitBreaker.failureThreshold)
      : undefined;
  const cooldownMs =
    typeof circuitBreaker?.cooldownMs === 'number' &&
    Number.isFinite(circuitBreaker.cooldownMs) &&
    circuitBreaker.cooldownMs > 0
      ? circuitBreaker.cooldownMs
      : undefined;

  return ok({
    endpoint: endpointResult.value,
    ...(typeof o.log === 'object' && o.log !== null ? { log: o.log } : {}),
    ...(typeof o.fetchImpl === 'function'
      ? { fetchImpl: o.fetchImpl as typeof fetch }
      : {}),
    ...(timeoutMs !== undefined ? { timeoutMs } : {}),
    ...(failureThreshold !== undefined && cooldownMs !== undefined
      ? {
          circuitBreaker: {
            failureThreshold,
            cooldownMs
          }
        }
      : {})
  });
};
