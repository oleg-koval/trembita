---
name: trembita-http-client
description:
  Build resilient, type-safe HTTP integrations with trembita using Result-based
  error handling, retries, and circuit breaker patterns.
---

# Trembita Skill

Use this repository as a practical reference for agents implementing HTTP
clients with `trembita`.

## When to Use

- Build TypeScript integrations for third-party REST APIs.
- Add robust error handling without exception-driven control flow.
- Implement retries, circuit breakers, and timeouts with minimal dependencies.
- Write testable API code by injecting `fetchImpl`.

## Core Patterns

1. Initialize once with `createTrembita()` and handle init `Result`.
2. Use `client.request()` for parsed JSON body responses.
3. Use `client.client()` when you need HTTP metadata (`statusCode`, `body`).
4. Narrow failures by checking `result.error.kind`.
5. Add resilience via `createRetryingFetch` and `circuitBreaker` config.

## Canonical References

- `README.md` - quick overview and install.
- `QUICK_START.md` - shortest path to first success.
- `LEARNING_GUIDE.md` - concepts and progressive examples.
- `EXAMPLES.md` - production-style patterns.
- `ARCHITECTURE.md` - request/error flow diagrams.

## Agent Guardrails

- Prefer `Result` handling over `try/catch` for request outcomes.
- Keep endpoint configuration explicit and validated.
- Prefer `expectedCodes` to document acceptable HTTP outcomes.
- Use `client.client()` for 404/202 branching by status code.
- Inject `fetchImpl` in tests; avoid global fetch patching.
