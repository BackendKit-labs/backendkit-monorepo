# Changelog

## [0.2.0] — 2026-09-14

### Features

- implement idempotency — cache successful results, skip duplicate executions (`2291067`)

### Bug Fixes

- fix broken NestJS DI, non-functional budget/idempotency/classifiers, and add real attempt cancellation (`7fbf20e`)
- fix uppercase Retry paths and AgainExecutor refs in test files (`ef9c9f6`)
- remove UTF-8 BOM from all source files (`82059d1`)

### Documentation

- fix minimal-Retry path casing in README Minimal Example section (`67b64fd`)

### Chores

- bump version to 0.1.2 (`8c37c80`)

