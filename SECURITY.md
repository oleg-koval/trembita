# Security Policy

## Reporting a Vulnerability

Please do **not** report security vulnerabilities through public GitHub issues,
discussions, or pull requests.

Report vulnerabilities privately using GitHub’s **“Report a vulnerability”**
feature:

https://github.com/oleg-koval/trembita/security/advisories/new

If private reporting is unavailable, contact the maintainer directly and include
`[SECURITY]` in the subject line. Do not include exploit code, credentials, or
sensitive data in public channels.

Please include:

- A clear description of the issue and its impact
- Affected version(s), branch, or commit
- Minimal steps or proof of concept to reproduce it
- Any relevant configuration, request, response, or dependency details

## Scope

This policy applies to vulnerabilities in `trembita` itself, including:

- Improper handling of API credentials, tokens, or secrets
- Injection into HTTP requests, headers, URLs, or query parameters
- Insecure handling of redirects, proxies, TLS, or third-party API responses
- Server-side request forgery (SSRF) or unintended network access
- Unsafe deserialization or improper validation of API responses
- Vulnerable dependencies introduced by the package

Issues that only affect an application using Trembita, rather than the library
itself, are generally out of scope unless Trembita enables or fails to prevent
the issue in a realistic configuration.

## Supported Versions

Security fixes are applied to the latest released major version.

| Version                        | Supported |
| ------------------------------ | --------- |
| latest `main` / latest release | ✅        |
| older releases                 | ❌        |

## Response Expectations

This is a community-maintained open-source project. The maintainer will try to
acknowledge valid reports within 5 business days and provide a status update
within 30 days, but these are best-effort targets rather than guarantees.

If a report is accepted:

- The issue will be investigated privately.
- A fix will be prepared and released where practical.
- Credit will be given to the reporter unless they prefer anonymity.
- Public disclosure will occur after a fix is available or a coordinated
  disclosure timeline has been agreed.

If a report is declined, the reporter will receive an explanation where
possible.
