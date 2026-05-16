# BackendKit Labs

> Open-source utilities for Node.js CLI applications and backend services.

Built and maintained by **[Mairon José Cuello Martínez](https://github.com/mmairon)** — backend engineer focused on developer tooling and TypeScript ecosystems.

---

## Packages

| Package | Version | Description |
|---------|---------|-------------|
| [`@backendkit-labs/console-animations`](https://www.npmjs.com/package/@backendkit-labs/console-animations) | [![npm](https://img.shields.io/npm/v/@backendkit-labs/console-animations?style=flat-square&color=cb3837)](https://www.npmjs.com/package/@backendkit-labs/console-animations) | Enterprise-grade terminal animations for Node.js CLIs |

---

## @backendkit-labs/console-animations

17 built-in animations — spinners, progress bars, loaders and visual effects — with terminal states, CI detection, dynamic updates, and zero runtime dependencies.

```bash
# Preview all animations instantly
npx @backendkit-labs/console-animations
```

```typescript
import { AnimationManager, Presets } from '@backendkit-labs/console-animations';

const manager = new AnimationManager();

const result = await manager.run(
  Presets.build('Compiling TypeScript'),
  () => runBuild(),
);
// ✔ Compiling TypeScript
```

**Features**

- `succeed` / `fail` / `warn` / `info` terminal states
- CI / non-TTY detection — silent in GitHub Actions, only final state printed
- Progress bars with automatic ETA calculation
- Fluent `AnimationBuilder` and ready-to-use `Presets`
- Dual ESM + CJS output, TypeScript declarations included

---

## Stack

TypeScript · Node.js 18+ · Turborepo · tsup · Vitest

---

## Links

- **npm** — [npmjs.com/~backendkit-labs](https://www.npmjs.com/~backendkit-labs)
- **GitHub** — [github.com/BackendKit-labs](https://github.com/BackendKit-labs)
- **Issues** — [github.com/BackendKit-labs/backendkit-monorepo/issues](https://github.com/BackendKit-labs/backendkit-monorepo/issues)
