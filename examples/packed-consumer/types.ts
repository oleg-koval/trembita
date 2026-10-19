import {
  createTrembita,
  requestWithStandardSchema,
  type StandardSchemaV1
} from 'trembita';

const schema: StandardSchemaV1<string> = {
  '~standard': {
    version: 1,
    vendor: 'packed-consumer',
    validate: (value: unknown) =>
      typeof value === 'string'
        ? { value }
        : { issues: [{ message: 'expected a string' }] }
  }
};
const created = createTrembita({ endpoint: 'https://example.test' });
if (created.ok) {
  const result = await requestWithStandardSchema(
    created.value,
    { path: '/name' },
    schema
  );
  if (result.ok) {
    result.value.toUpperCase();
    // @ts-expect-error schema inference must not silently widen to any
    result.value.toFixed();
  } else if (result.error.kind === 'unexpected_status') {
    const status: number = result.error.statusCode;
    const body: unknown = result.error.body;
    void status;
    void body;
  }
}
