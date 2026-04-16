import type {
  TrembitaRequestError,
  TrembitaValidationError
} from './errors.js';
import type { Result } from './result.js';
import type { StandardSchemaV1 } from './standardSchema.js';
import { validateStandardSchema } from './standardSchema.js';
import type { TrembitaClient, TrembitaFetchOptions } from './trembita.js';

/**
 * `request` + Standard Schema validation — JSON is still `unknown` until the
 * schema accepts it.
 */
export const requestWithStandardSchema = async <Output>(
  client: TrembitaClient,
  options: TrembitaFetchOptions,
  schema: StandardSchemaV1<Output>
): Promise<Result<Output, TrembitaRequestError | TrembitaValidationError>> => {
  const json = await client.request(options);
  if (!json.ok) {
    return json;
  }
  return validateStandardSchema(json.value, schema);
};
