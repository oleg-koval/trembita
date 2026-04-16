import type {
  TrembitaClient,
  TrembitaFetchOptions,
  TrembitaRequestError
} from 'trembita';
import type { Result } from 'trembita';

import { expandOpenapiPath, type ExpandPathError } from './expandPath.js';

export type RequestOpenapiPathError = ExpandPathError | TrembitaRequestError;

/**
 * Expand an OpenAPI path template, then call **`TrembitaClient.request`** with
 * the resolved path. Path expansion failures stay in the **`Result`** (no
 * throws).
 */
export const requestOpenapiPath = async (
  client: TrembitaClient,
  template: string,
  params: Readonly<Record<string, string | number>>,
  options: Readonly<Omit<TrembitaFetchOptions, 'path' | 'url'>>
): Promise<Result<unknown, RequestOpenapiPathError>> => {
  const expanded = expandOpenapiPath(template, params);
  if (!expanded.ok) {
    return expanded;
  }
  return client.request({
    ...options,
    path: expanded.value
  });
};
