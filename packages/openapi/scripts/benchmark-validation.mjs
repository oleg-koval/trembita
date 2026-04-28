import { performance } from 'node:perf_hooks';
import { validateStandardSchema } from '../dist/index.js';

const iterations = 200;

const makePayload = (items) => ({
  ok: true,
  count: items.length,
  items
});

const makeItems = (count) =>
  Array.from({ length: count }, (_, index) => ({
    id: `item_${index}`,
    name: `Item ${index}`,
    active: index % 2 === 0
  }));

const envelopeSchema = {
  '~standard': {
    version: 1,
    vendor: 'benchmark',
    validate: (value) => {
      if (
        typeof value === 'object' &&
        value !== null &&
        value.ok === true &&
        typeof value.count === 'number' &&
        Array.isArray(value.items)
      ) {
        return { value };
      }
      return { issues: [{ message: 'invalid_envelope' }] };
    }
  }
};

const deepSchema = {
  '~standard': {
    version: 1,
    vendor: 'benchmark',
    validate: (value) => {
      if (
        typeof value !== 'object' ||
        value === null ||
        value.ok !== true ||
        typeof value.count !== 'number' ||
        !Array.isArray(value.items)
      ) {
        return { issues: [{ message: 'invalid_envelope' }] };
      }
      for (const item of value.items) {
        if (
          typeof item !== 'object' ||
          item === null ||
          typeof item.id !== 'string' ||
          typeof item.name !== 'string' ||
          typeof item.active !== 'boolean'
        ) {
          return { issues: [{ message: 'invalid_item' }] };
        }
      }
      return { value };
    }
  }
};

const runCase = async (name, schema, payload) => {
  await validateStandardSchema(payload, schema);
  const started = performance.now();
  for (let i = 0; i < iterations; i += 1) {
    const result = await validateStandardSchema(payload, schema);
    if (!result.ok) {
      throw new Error(`benchmark case failed: ${name}`);
    }
  }
  const totalMs = performance.now() - started;
  return {
    name,
    iterations,
    totalMs,
    avgMs: totalMs / iterations
  };
};

const formatMs = (value) => `${value.toFixed(4)}ms`;

const main = async () => {
  const cases = [
    ['envelope only / 100 items', envelopeSchema, makePayload(makeItems(100))],
    ['deep items / 100 items', deepSchema, makePayload(makeItems(100))],
    [
      'envelope only / 1000 items',
      envelopeSchema,
      makePayload(makeItems(1000))
    ],
    ['deep items / 1000 items', deepSchema, makePayload(makeItems(1000))],
    [
      'envelope only / 10000 items',
      envelopeSchema,
      makePayload(makeItems(10000))
    ],
    ['deep items / 10000 items', deepSchema, makePayload(makeItems(10000))]
  ];

  console.log(
    `Standard Schema validation benchmark (${iterations} iterations)`
  );
  console.log('case,total,avg');
  for (const [name, schema, payload] of cases) {
    const result = await runCase(name, schema, payload);
    console.log(
      `${result.name},${formatMs(result.totalMs)},${formatMs(result.avgMs)}`
    );
  }
};

await main();
