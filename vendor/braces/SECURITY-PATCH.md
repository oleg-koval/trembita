# Trembita-local braces security patch

This directory vendors the MIT-licensed `braces` package, based on upstream `braces@3.0.3` (`micromatch/braces` base commit `e53730e6f935498326c72d768889ac194eedc0e0`).

The local package version `3.0.4-trembita.0` is an internal version identifier, **not an upstream npm release**. It applies the nesting-depth and recursive-AST guards from the closed, unmerged upstream PR [micromatch/braces#72](https://github.com/micromatch/braces/pull/72), final commit [`28d440b5dd449dbf1fe6f3506cf94ecca4d02660`](https://github.com/FSDevelop/braces/commit/28d440b5dd449dbf1fe6f3506cf94ecca4d02660). That patch adds a default depth bound of 100 to parsing and recursive AST operations, and detects cyclic AST parent chains during expansion. Its tests were reported passing on Node 8.3/Windows and Node 26.1/Windows in the upstream PR.

The Trembita root npm override selects this local package so the normal full `npm audit` evaluates the patched implementation rather than suppressing the advisory. Regression tests in `test/braces-security.test.ts` exercise deep hostile input and ordinary brace expansion.

Upstream maintainers have disputed the advisory and have not published a fixed release. This vendored fork is therefore a local security maintenance obligation. Remove it only after upstream publishes a release with the fix or the advisory is withdrawn; until then, review this patch when upgrading the dependency.

License: MIT; see `LICENSE`.