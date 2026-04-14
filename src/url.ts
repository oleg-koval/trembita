import { err, ok, type Result } from './result.js';
import type { TrembitaInitError } from './errors.js';

export const joinEndpointPath = (endpoint: string, path: string): string => {
  const base = endpoint.replace(/\/$/, '');
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${base}${p}`;
};

export const appendQuery = (
  url: string,
  query: Readonly<Record<string, string | number | boolean | null | undefined>>
): string => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) {
      continue;
    }
    params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `${url}?${qs}` : url;
};

export const validateHttpEndpoint = (
  endpoint: string
): Result<string, TrembitaInitError> => {
  try {
    const u = new URL(endpoint);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') {
      return err({ kind: 'endpoint_invalid_url', reason: 'protocol' });
    }
    return ok(endpoint);
  } catch {
    return err({ kind: 'endpoint_invalid_url', reason: 'parse' });
  }
};
