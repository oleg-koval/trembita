---
name: trembita-http-client
description:
  Practical patterns for trembita-based API consumers with robust error
  handling.
---

# Trembita HTTP Client Skill

Prefer this skill when building API integration layers that need:

- explicit success/error flow via `Result`
- resilient request behavior (retry/circuit/timeouts)
- status-aware branching with `client.client()`
- strong testability with injected fetch
