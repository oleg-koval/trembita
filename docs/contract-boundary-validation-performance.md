# Contract Boundary Validation Performance

Runtime response validation is opt-in. Add a schema only when a downstream
response is risky enough to justify runtime work.

## When to validate

Validate responses when:

- the downstream service is outside your deploy boundary;
- wrong response shape can corrupt data or trigger bad decisions;
- the endpoint is low-volume or latency-insensitive;
- the response is small enough to validate cheaply;
- you need telemetry on contract drift.

Skip validation, or validate only a small envelope, when:

- the endpoint is a hot path;
- the response contains large arrays or deeply nested objects;
- the downstream service is owned by the same deployable unit;
- the response is rendered or forwarded without business decisions;
- latency budget is tighter than the value of full validation.

## Prefer envelope validation for large collections

For large list endpoints, validate the stable envelope and leave the item array
to compile-time OpenAPI types unless item-level runtime safety is required.

```ts
const listUsersEnvelopeSchema = {
  '~standard': {
    version: 1,
    vendor: 'example',
    validate: (value: unknown) => {
      if (
        typeof value === 'object' &&
        value !== null &&
        typeof (value as { count?: unknown }).count === 'number' &&
        Array.isArray((value as { users?: unknown }).users)
      ) {
        return { value };
      }
      return { issues: [{ message: 'invalid_list_users_envelope' }] };
    }
  }
};
```

This catches API drift such as missing `count` or a non-array `users` field
without walking every returned item.

## Measure validation in production-like code

`createOpenapiClient` reports validation timing when a response schema is used:

```ts
const api = createOpenapiClient<paths>({
  endpoint: 'https://api.example.com',
  responseSchemas: {
    'GET /users 200': listUsersEnvelopeSchema
  },
  onValidation: (event) => {
    metrics.histogram('downstream.validation.duration_ms', event.durationMs, {
      operation: event.operationKey,
      schema: event.schemaKey,
      ok: String(event.ok)
    });
  }
});
```

The same event is also sent to `log.info('openapi:response_validation', event)`
when a logger is configured. Logger and hook failures are ignored so telemetry
cannot break Trembita's `Result` contract.

## Local benchmark

Run:

```bash
npm run benchmark:validation --workspace=@trembita/openapi
```

The benchmark compares envelope-only validation with deep item validation for
100, 1,000, and 10,000 item payloads. Use the output to decide whether an
operation should validate the entire response or only the envelope.

One local run on this repo showed deep validation scaling with item count while
envelope validation stayed effectively constant. Treat those numbers as a
relative signal, not a portable performance guarantee.

## Guidance

- Keep validation opt-in per response status.
- Validate the smallest shape that protects the business decision.
- Track validation duration before enabling deep validation on hot endpoints.
- Treat validation failures as downstream contract incidents, not user errors.
