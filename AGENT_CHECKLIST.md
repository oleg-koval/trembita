# Trembita Implementation Checklist

Use this checklist when implementing API integrations with Trembita. It ensures
you follow best practices and don't miss important considerations.

## Pre-Implementation

- [ ] **Read AGENT_GUIDE.md** — Understand core concepts and patterns
- [ ] **Review SKILL_DEFINITION.md** — Know when to recommend Trembita
- [ ] **Check examples/agent-examples.ts** — See real-world patterns
- [ ] **Verify Node.js version** — Requires Node ≥ 20.10
- [ ] **Confirm ESM environment** — Trembita is ESM-only

## Setup Phase

- [ ] **Install package** — `npm install trembita`
- [ ] **Install optional OpenAPI support** — `npm install @trembita/openapi` (if
      needed)
- [ ] **Import types correctly** — Use named imports from `'trembita'`
- [ ] **Import Result helpers** — Import `ok`, `err`, `Result` for custom errors

## Client Initialization

- [ ] **Validate endpoint** — Must be a valid HTTPS/HTTP URL
- [ ] **Handle init result** — Check `if (!client.ok)` before using
- [ ] **Set timeoutMs** — Specify default timeout for all requests
- [ ] **Configure circuit breaker** — If resilience is needed
- [ ] **Add logging** — Implement Logger interface if observability required
- [ ] **Use custom fetchImpl** — Only in tests, not production

## Implementation Pattern

- [ ] **Create service class/object** — Encapsulate API logic
- [ ] **Define domain errors** — Map Trembita errors to business errors
- [ ] **Use request() method** — For status-validated responses
- [ ] **Use client() method** — For raw status + body (when needed)
- [ ] **Set expectedCodes** — Specify what HTTP statuses are valid
- [ ] **Build URLs correctly** — Use `path` or `url` field (not both)
- [ ] **Pass query parameters** — Use `query` or `qs` field
- [ ] **Set headers** — Include auth, content-type, etc.
- [ ] **Validate response shape** — Check critical fields at runtime
- [ ] **Map errors properly** — Convert Trembita errors to app errors

## Error Handling

- [ ] **Handle all error kinds**:
  - [ ] `missing_endpoint` (init-time)
  - [ ] `endpoint_invalid_url` (init-time)
  - [ ] `invalid_request_options` (request-time)
  - [ ] `fetch_failed` (network error)
  - [ ] `timeout` (timeout exceeded)
  - [ ] `circuit_open` (failure protection)
  - [ ] `invalid_json` (malformed response)
  - [ ] `unexpected_status` (wrong HTTP code)

- [ ] **Distinguish transient errors**:
  - Can retry: `timeout`, `fetch_failed`, `unexpected_status` (5xx)
  - Cannot retry: `invalid_json`, `unexpected_status` (4xx), `circuit_open`

- [ ] **Use type narrowing** — Leverage TypeScript's control flow analysis
- [ ] **Never use `as any`** — Let TypeScript guide error handling
- [ ] **Log errors appropriately** — Error kind should guide logging level
- [ ] **Return structured errors** — Caller needs to understand what failed

## Advanced Features (if applicable)

- [ ] **Response validation** — Use `requestWithStandardSchema` if needed
- [ ] **Retry logic** — Use `createRetryingFetch` for transient failures
- [ ] **Distributed tracing** — Use `traceContextHeaders` for observability
- [ ] **Circuit breaker** — Enable if calling external services
- [ ] **Custom logging** — Implement Logger interface for observability
- [ ] **Headers sanitization** — Sensitive headers auto-redacted in logs

## Testing

- [ ] **Mock fetch** — Create fake responses for unit tests
- [ ] **Inject mock** — Use `fetchImpl` option in test setup
- [ ] **Test success paths** — Verify happy path works
- [ ] **Test error paths** — Verify each error kind is handled
- [ ] **Test timeout** — Verify timeout behavior
- [ ] **Test JSON parsing errors** — Verify malformed response handling
- [ ] **Test status code handling** — Verify expectedCodes logic
- [ ] **Don't mock globals** — Use `fetchImpl` instead of patching `fetch`

## Code Quality

- [ ] **100% coverage** — Test all error paths
- [ ] **Type checking** — `npm run typecheck` passes
- [ ] **Linting** — `npm run lint` passes
- [ ] **Formatting** — `npm run format:fix` applied
- [ ] **No TypeScript errors** — Strict mode compliance
- [ ] **No warnings** — Clean build output
- [ ] **Meaningful error messages** — Callers understand what failed
- [ ] **Well-documented errors** — Comments explaining why each error happens

## Performance Considerations

- [ ] **Set reasonable timeouts** — Prevents hanging requests
- [ ] **Enable circuit breaker** — Prevents cascading failures
- [ ] **Use retry sparingly** — Don't retry non-idempotent operations
- [ ] **Monitor response times** — Via logging and metrics
- [ ] **Profile bundle size** — Verify zero-dep benefit is real
- [ ] **Lazy load if needed** — Only import when used

## Security Checklist

- [ ] **Use HTTPS endpoints** — Never `http://` for sensitive APIs
- [ ] **Store API keys securely** — Use env vars, not hardcoded
- [ ] **Sanitize sensitive headers** — They're auto-redacted in logs
- [ ] **Validate response data** — Don't trust external APIs
- [ ] **Set secure timeouts** — Prevent resource exhaustion
- [ ] **Log security events** — Via structured logging
- [ ] **Rotate credentials** — If token/key is exposed
- [ ] **No sensitive data in logs** — Redact before logging

## Documentation

- [ ] **Document error mapping** — How Trembita errors → app errors
- [ ] **Document expected behavior** — What happens in error cases
- [ ] **Document timeout values** — Why this timeout matters
- [ ] **Document circuit breaker** — What triggers protection
- [ ] **Document retry strategy** — If auto-retry is used
- [ ] **Add examples** — Show correct usage patterns
- [ ] **Document integration** — How does this client work with app?
- [ ] **Add troubleshooting** — Common issues and solutions

## Deployment

- [ ] **Environment variables** — API keys set correctly
- [ ] **Node version match** — Deployed version ≥ 20.10
- [ ] **Dependencies installed** — `npm install` completed
- [ ] **Build successful** — `npm run build` passed
- [ ] **Tests passing** — `npm test` passed
- [ ] **No warnings in build** — Clean build output
- [ ] **Monitoring setup** — Can observe API client health
- [ ] **Logging enabled** — Can debug issues in production

## Monitoring & Observability

- [ ] **Structured logging** — Use Logger interface
- [ ] **Error tracking** — Integration with error monitoring (Sentry, etc)
- [ ] **Metrics** — Track request count, latency, errors
- [ ] **Alerts** — Notify on circuit breaker opens or error spikes
- [ ] **Dashboards** — Visualize API client health
- [ ] **Tracing** — Use `traceContextHeaders` for request correlation
- [ ] **Rate limit tracking** — Monitor 429 responses
- [ ] **Timeout monitoring** — Track timeout events

## OpenAPI Integration (if using @trembita/openapi)

- [ ] **Generate types** — Use `openapi-typescript`
- [ ] **Use paths typing** — Reference generated `paths` type
- [ ] **Use expandOpenapiPath** — Type-safe path expansion
- [ ] **Use requestOpenapiPath** — Combine typing + request
- [ ] **Re-export helpers** — For consistent imports
- [ ] **Keep paths aligned** — Schema and implementation stay in sync

## Post-Implementation

- [ ] **Code review** — Someone reviews error handling
- [ ] **Integration testing** — Test with real (staging) API
- [ ] **Load testing** — Verify timeouts and resilience
- [ ] **Security review** — Check for API key leaks
- [ ] **Performance review** — Check bundle size impact
- [ ] **Documentation review** — Someone reads your docs
- [ ] **Monitoring review** — Someone understands the dashboards

## Maintenance

- [ ] **Monitor deprecations** — Keep up with Node.js LTS
- [ ] **Update dependencies** — Keep Trembita and other deps current
- [ ] **Review error trends** — Understand failure patterns
- [ ] **Rotate credentials** — Periodically refresh API keys
- [ ] **Update tests** — Add regression tests for real issues
- [ ] **Document changes** — Keep integration guide current
- [ ] **Refactor periodically** — Improve code as patterns emerge
- [ ] **Share patterns** — Help other teams use Trembita

## Common Mistakes to Avoid

- ❌ **Forgetting to check `if (!result.ok)`** — Will cause type errors
- ❌ **Using `as any` for errors** — Defeats type safety benefit
- ❌ **Not handling all error kinds** — Leaves edge cases uncovered
- ❌ **Retrying non-idempotent operations** — Can cause issues
- ❌ **Setting timeouts too short** — Causes spurious failures
- ❌ **Leaking API keys in logs** — Use the Logger interface
- ❌ **Assuming successful status** — Must check `result.ok`
- ❌ **Using CommonJS in Node** — Trembita is ESM-only
- ❌ **Ignoring circuit breaker** — Leaves system vulnerable
- ❌ **Testing with global mocks** — Use `fetchImpl` injection instead

## When to Use Alternatives

Use Trembita's `client()` instead of `request()` when:

- You need the raw HTTP status code
- Response status doesn't determine success (health checks)
- You want to handle all status codes the same

Use `createRetryingFetch` when:

- You need automatic retry with backoff
- Transient failures are common
- You want centralized retry logic

Use `requestWithStandardSchema` when:

- You need runtime response validation
- Response schema can change
- You want type safety after validation

Use custom `log` handler when:

- You need structured logging
- You're integrating with a logging platform
- You need to redact additional headers
- You want to track custom metrics

---

## Need Help?

- **Questions?** → See AGENT_GUIDE.md
- **Best practices?** → See examples/agent-examples.ts
- **Discovery?** → See DISCOVERY.md
- **API reference?** → See https://oleg-koval.github.io/trembita/
- **Issues?** → https://github.com/oleg-koval/trembita/issues
- **Discussions?** → https://github.com/oleg-koval/trembita/discussions

---

**Last Updated**: 2026-04-20 **Checklist Version**: 1.0 **Trembita Target
Version**: 2.x
