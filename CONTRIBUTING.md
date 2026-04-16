# Contributing

## API documentation (GitHub Pages)

TypeDoc output is published by **Deploy GitHub Pages**
(`.github/workflows/pages.yml`) on pushes to `main` or `master`. In the
repository **Settings → Pages**, set **Build and deployment** to **GitHub
Actions** (not “Deploy from a branch”). After the first successful run, the site
is at <https://oleg-koval.github.io/trembita/> (core **`trembita`** sources
only). **`@trembita/openapi`** ships its own **`types`** on npm; see
[packages/openapi/README.md](packages/openapi/README.md).

## npm publishing (monorepo)

Releases use **semantic-release** (`.github/workflows/npm-release.yml`). The
config publishes **two** packages from one run:

1. **`trembita`** — default package root (`.`).
2. **`@trembita/openapi`** — second **`@semantic-release/npm`** plugin with
   **`pkgRoot: packages/openapi`**.

**Prerequisites**

- **Trusted Publishing (recommended):** On npmjs.com, configure **Trusted
  Publishers** (GitHub Actions OIDC) for **both** **`trembita`** and
  **`@trembita/openapi`**. If only the root package is linked, the OpenAPI
  publish step can fall back to **`NPM_TOKEN`** and fail with **EOTP** when your
  npm account has 2FA (one-time password cannot be entered in CI).
- **Optional `NPM_TOKEN`:** A repo secret used for bootstrap or when OIDC is
  unavailable for a package. For CI without interactive 2FA, use an npm
  **Granular access token** (type **Automation**) with publish rights to both
  packages, or rely on OIDC only and **omit** `NPM_TOKEN` once both packages
  have Trusted Publishers (see comments in `.github/workflows/npm-release.yml`).
- Create the **npm org / scope** `@trembita` if it does not exist, and ensure
  maintainers can publish **`@trembita/openapi`**.
- **`publishConfig.access: public`** is already set on **`@trembita/openapi`**
  so scoped packages are public on the registry.

**Versioning**

- semantic-release writes the **same** next version into **both** `package.json`
  files during the prepare step. Keep **`packages/openapi`** semver aligned with
  the root package for releases.

**Consumers**

- Install **`trembita`** and **`@trembita/openapi`** together; the OpenAPI
  package declares **`trembita` ^2** as a **peer dependency** (dev-time link in
  this repo uses **`file:../..`**).

## Versions

In order to contribute make sure that you add a version tag using the following
logic:

| Code Status                                      | Stage         | Rule                   | Example # |
| ------------------------------------------------ | ------------- | ---------------------- | --------- |
| First Release                                    | New Product   | Start with 1.0.0       | 1.0.0     |
| Bug fixes, other minor changes                   | Patch Release | Increment third digit  | 1.0.1     |
| New features that do **NOT** break existing ones | Minor Release | Increment second digit | 1.1.0     |
| Changes that break backward compatibility        | Major Release | Increment first digit  | 2.0.0     |

## Commit message pattern

Commits should follow the following format: `keyword: description`

Keyword is mandatory for **CHANGELOG** If keyword is skipped, commit will not
appear in **CHANGELOG**

### Keywords

| Keyword  | When to use                                      |
| -------- | ------------------------------------------------ |
| breaking | Changes that break backward compatibility        |
| build    | Changes in the build configuration or process    |
| ci       | Changes related to `ci` configuration or process |
| chore    | Changes related to general maintenance           |
| docs     | Changes related to documentation                 |
| feat     | Changes related to a feature                     |
| fix      | Changes related to bug fixing                    |
| other    | Changes that do not fit any other keyword        |
| perf     | Changes related to performance                   |
| refactor | Changes to code that do not change end logic     |
| revert   | Changes that revert to previous code             |
| style    | Changes related to code formating                |
| test     | Changes related to Tests                         |
