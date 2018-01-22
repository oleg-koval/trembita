# Contributing

## Versions

In order to contribute make sure that you add a version tag using the following logic:

| Code Status | Stage | Rule | Example # |
| --- | --- | --- | --- |
| First Release | New Product | Start with 1.0.0 | 1.0.0 |
| Bug fixes, other minor changes | Patch Release | Increment third digit | 1.0.1 |
| New features that do **NOT** break existing ones | Minor Release | Increment second digit | 1.1.0 |
| Changes that break backward compatibility | Major Release | Increment first digit | 2.0.0 |

## Commit message pattern

Commits should follow the following format:
`keyword: description`

Keyword is mandatory for **CHANGELOG**
If keyword is skipped, commit will not appear in **CHANGELOG**

### Keywords

| Keyword | When to use |
| --- | --- |
| breaking | Changes that break backward compatibility |
| build | Changes in the build configuration or process |
| ci | Changes related to `ci` configuration or process |
| chore | Changes related to general maintenance |
| docs | Changes related to documentation |
| feat | Changes related to a feature|
| fix | Changes related to bug fixing |
| other | Changes that do not fit any other keyword |
| perf | Changes related to performance |
| refactor | Changes to code that do not change end logic |
| revert | Changes that revert to previous code |
| style | Changes related to code formating|
| test | Changes related to Tests |
