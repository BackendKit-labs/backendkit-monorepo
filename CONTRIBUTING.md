# Contributing to BackendKit Labs

First off — thanks for being here. BackendKit is in early formation, and every real use case, bug report, and PR shapes what this becomes.

---

## Before you start

**Have a question?** Open a [GitHub Discussion](https://github.com/BackendKit-labs/backendkit-monorepo/discussions) — especially in Q&A. It helps others who hit the same thing.

**Found a bug?** Open an [issue](https://github.com/BackendKit-labs/backendkit-monorepo/issues) with a minimal reproduction. The more specific, the faster it moves.

**Have a feature idea?** Start a Discussion under Ideas before opening a PR. A quick alignment on design saves both sides time.

**Want something to pick up?** Look for issues labeled [`good first issue`](https://github.com/BackendKit-labs/backendkit-monorepo/labels/good%20first%20issue).

---

## Dev environment

**Requirements:** Node.js 18+, npm 10+

```bash
# Clone and install
git clone https://github.com/BackendKit-labs/backendkit-monorepo.git
cd backendkit-monorepo
npm install

# Build all packages
npm run build

# Run all tests
npm test

# Type-check all packages
npm run typecheck

# Lint all packages
npm run lint
```

### Working on a specific package

Each package is self-contained. You can work entirely inside it:

```bash
cd packages/circuit-breaker

npm test              # run tests once
npm run test:watch    # watch mode
npm run test:coverage # coverage report
npm run typecheck     # TypeScript check
npm run lint          # ESLint
npm run build         # build dist/
```

### Docs site (VitePress)

```bash
npm run docs:dev      # start local dev server
npm run docs:build    # production build
```

---

## How to contribute

### 1. Fork and branch

Branch off `master`. Use a descriptive name:

```
fix/circuit-breaker-half-open-race
feat/result-tap-operator
docs/getting-started-guide
chore/bump-vitest
```

### 2. Make your change

- **Write tests** for any new behavior. PRs without tests for new code won't be merged.
- **Keep scope tight.** A focused PR is reviewed and merged faster than one that does five things.
- **Don't add runtime dependencies to core packages.** The zero-runtime-dep guarantee is a hard constraint for `result`, `circuit-breaker`, `bulkhead`, and `pipeline`.
- **Don't add comments** unless the *why* is non-obvious — a hidden constraint, a workaround for a specific bug, a subtle invariant. Code should explain what it does through naming.

### 3. Commit style

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(circuit-breaker): add onStateChange hook to config
fix(bulkhead): clear timeout on dequeue to prevent phantom rejections
docs(result): add withTimeout timer-leak example
chore(pipeline): bump version to 0.2.0
```

Scopes match package names: `result`, `circuit-breaker`, `bulkhead`, `pipeline`, `http-client`, `observability`, `request-scanner`, `auto-learning`, `console-animations`.

### 4. Open a PR

- **Title:** same format as commit message (Conventional Commits)
- **Body:** what changed, why, and how to test it. Link the related issue with `Closes #N`.
- **Tests must pass:** `npm test` and `npm run typecheck` are required to go green.
- **Lint must pass:** `npm run lint` in the affected package.

---

## Code standards

| Rule | Detail |
|------|--------|
| Language | TypeScript strict mode (`strict: true`) |
| Runtime deps | Forbidden in core packages (`result`, `circuit-breaker`, `bulkhead`, `pipeline`) |
| Module format | ESM source, dual ESM+CJS output via `tsup` |
| Test framework | Vitest |
| Coverage | New behavior must have tests; aim for the coverage level of the surrounding code |
| Comments | Only when the *why* is non-obvious |
| Error handling | Validate at boundaries; don't add fallbacks for scenarios that can't happen |

---

## Project structure

```
backendkit-monorepo/
├── packages/
│   ├── result/           # Result<T,E> monad
│   ├── circuit-breaker/  # Circuit breaker
│   ├── bulkhead/         # Concurrency limiting
│   ├── pipeline/         # Chain of responsibility
│   ├── http-client/      # HTTP client (axios + resilience)
│   ├── observability/    # Logging, metrics, OTel for NestJS
│   ├── request-scanner/  # Embedded WAF
│   ├── auto-learning/    # Adaptive resilience tuning
│   └── console-animations/
├── apps/
│   ├── docs/             # VitePress documentation site
│   └── web/              # Next.js marketing site
└── CONTRIBUTING.md
```

Each package follows the same internal layout:

```
packages/<name>/
├── src/
│   ├── <name>/     # core logic
│   ├── nestjs/     # optional NestJS bindings
│   └── index.ts    # public API
├── tests/
│   └── unit/
├── package.json
├── tsconfig.json
└── tsup.config.ts
```

---

## License

By contributing, you agree that your contributions will be licensed under the [Apache-2.0 License](./LICENSE).
