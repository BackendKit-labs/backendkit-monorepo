---
title: Console Animations
description: Enterprise-grade terminal animations for Node.js CLI applications — 17 built-in animations, CI detection, zero runtime dependencies.
---

# @backendkit-labs/console-animations

[![npm](https://img.shields.io/npm/v/@backendkit-labs/console-animations?style=flat-square&color=cb3837)](https://www.npmjs.com/package/@backendkit-labs/console-animations)
[![License](https://img.shields.io/npm/l/@backendkit-labs/console-animations?style=flat-square)](https://github.com/BackendKit-labs/backendkit-monorepo/blob/master/LICENSE)
[![Node](https://img.shields.io/node/v/@backendkit-labs/console-animations?style=flat-square)](https://nodejs.org)

> Enterprise-grade terminal animations for Node.js CLI applications and backend processes.

**17 built-in animations** — spinners, progress bars, loaders and visual effects — with terminal states (`succeed` / `fail` / `warn`), dynamic text updates, CI detection, and zero runtime dependencies.

```bash
# Try it instantly
npx @backendkit-labs/console-animations
```

## Installation

```bash
npm install @backendkit-labs/console-animations
```

## Quick Start

```typescript
import { AnimationManager, AnimationType } from '@backendkit-labs/console-animations';

const manager = new AnimationManager();

const spinner = manager.start({
  type:   AnimationType.SPINNER,
  color:  'cyan',
  prefix: '  Installing packages ',
});

setTimeout(() => {
  manager.succeed(spinner.id, 'Packages installed');
}, 3000);
```

## Available Animations

### Spinners & Loaders

| Animation | Type | Use case |
|-----------|------|----------|
| **Spinner** | `SPINNER` | Tasks, installs, fetching |
| **Dots** | `DOTS` | Waiting, processing |
| **Pulse** | `PULSE` | Heartbeat, status check |
| **Worm** | `WORM` | Indeterminate progress |
| **Snake** | `SNAKE` | Scanning, searching |
| **Bouncing Ball** | `BOUNCING_BALL` | Loading, buffering |

### Progress & Fill

| Animation | Type | Use case |
|-----------|------|----------|
| **Progress Bar** | `PROGRESS_BAR` | File download, build steps |
| **Cyberpunk** | `CYBERPUNK` | Deploy, upload, sync |

### Text & Visual Effects

| Animation | Type | Use case |
|-----------|------|----------|
| **Typing** | `TYPING` | Command output, logs |
| **Waves** | `WAVES` | Audio, processing |
| **Matrix** | `MATRIX` | Data stream, encryption |
| **Hacker** | `HACKER` | Hex scan, network |
| **Rain** | `RAIN` | Ambient, idle state |
| **Fire** | `FIRE` | Alerts, hot paths |
| **Stars** | `STARS` | Success, decorative |
| **Particles** | `PARTICLES` | Ambient |
| **Futurista** | `FUTURISTA` | Sci-fi, startup |

## Terminal States

Stop animations with a visible result — the most important feature for professional CLIs:

```typescript
manager.succeed(id, 'Build complete')   // ✔ Build complete   (green)
manager.fail(id, 'Build failed')        // ✖ Build failed     (red)
manager.warn(id, 'Skipped 3 files')     // ⚠ Skipped 3 files  (yellow)
manager.info(id, 'Cache hit')           // ℹ Cache hit        (cyan)
```

## Presets

Ready-to-use configurations for the most common backend and CLI scenarios:

```typescript
import { AnimationManager, Presets } from '@backendkit-labs/console-animations';

const manager = new AnimationManager();

const s = manager.start(Presets.install('Installing dependencies'));
const b = manager.start(Presets.build('Compiling TypeScript'));
const d = manager.start(Presets.deploy('Deploying to production'));
const c = manager.start(Presets.connect('Connecting to database'));
```

| Preset | Animation | Color | Use case |
|--------|-----------|-------|----------|
| `Presets.install(text?)` | `SPINNER` | cyan | npm/package installs |
| `Presets.build(text?)` | `DOTS` | yellow | Compilation, bundling |
| `Presets.deploy(text?)` | `WORM` | magenta | Deployments |
| `Presets.connect(text?)` | `PULSE` | blue | DB / network connections |
| `Presets.migrate(text?)` | `SNAKE` | yellow | DB migrations |
| `Presets.download(text?, total?)` | `PROGRESS_BAR` | cyan | Downloads with ETA |
| `Presets.upload(text?, total?)` | `CYBERPUNK` | green | Uploads |
| `Presets.encrypt(text?)` | `HACKER` | greenBright | Encryption / hashing |
| `Presets.scan(text?)` | `MATRIX` | green | Security scans |
| `Presets.stream(text?)` | `WAVES` | cyan | Data streaming |

## Progress Bar with ETA

```typescript
const bar = manager.start(Presets.download('Downloading package', 100));

bar.setProgress(30);  // [████████░░░░░░░░░░░░░░░░░░░░░░]  30% | ETA: 7s
bar.setProgress(60);  // [████████████████░░░░░░░░░░░░░░]  60% | ETA: 3s
bar.setProgress(100); // [██████████████████████████████] 100% | 1.2s

manager.succeed(bar.id, 'Download complete');
```

## Async Workflow with Auto-stop

```typescript
// run() automatically calls succeed() on resolve, fail() on reject
const result = await manager.run(
  Presets.deploy('Deploying to production'),
  () => deployToProduction(),
  {
    successText: 'Deployed successfully',
    failText:    'Deployment failed',
  },
);
```

## Dynamic Updates

```typescript
const s = manager.start(Presets.install('Resolving packages'));

manager.update(s.id, { prefix: '  Downloading packages ' });
manager.update(s.id, { prefix: '  Linking dependencies ' });

manager.succeed(s.id, 'Installation complete');
```

## CI / Non-TTY Detection

:::tip Automatic CI detection
Animations are automatically disabled in non-interactive environments (CI, piped output). Only terminal states are printed.
:::

```
# In a terminal (interactive)
⠙ Building TypeScript...   ← animated

# In GitHub Actions / CI
✔ Building TypeScript       ← only final state
```

Detection is automatic via `process.stdout.isTTY` and `process.env.CI` — no configuration needed.

## API Reference

### AnimationManager

| Method | Signature | Description |
|--------|-----------|-------------|
| `start` | `(config) → IAnimation` | Creates and starts an animation |
| `stop` | `(id) → void` | Stops silently |
| `succeed` | `(id, text?) → void` | Stops with ✔ (green) |
| `fail` | `(id, text?) → void` | Stops with ✖ (red) |
| `warn` | `(id, text?) → void` | Stops with ⚠ (yellow) |
| `info` | `(id, text?) → void` | Stops with ℹ (cyan) |
| `update` | `(id, partial) → void` | Updates config while running |
| `pause` | `(id) → void` | Freezes current frame |
| `resume` | `(id) → void` | Resumes a paused animation |
| `destroy` | `(id) → void` | Stops and releases resources |
| `destroyAll` | `() → void` | Destroys all active animations |
| `get` | `(id) → IAnimation \| undefined` | Gets animation by ID |
| `run<T>` | `(config, task, opts?) → Promise<T>` | Wraps async task with auto-stop |

### AnimationBuilder

Fluent API for composing configs:

```typescript
const config = new AnimationBuilder()
  .setType(AnimationType.WORM)
  .setColor('magenta')
  .setSpeed(60)
  .setPrefix('  Migrating database ')
  .build();

const anim = manager.start(config);
```

### AnimationConfig

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `type` | `AnimationType` | required | Animation type |
| `id` | `string` | auto | Unique animation ID |
| `color` | `Color` | — | ANSI color |
| `speed` | `number` | `80` | ms between frames |
| `prefix` | `string` | `''` | Text before the animation |
| `suffix` | `string` | `''` | Text after the animation |
| `frames` | `string[]` | — | Custom frame array |
| `width` | `number` | `20` | Progress bar width |
| `total` | `number` | `100` | Progress bar total steps |
| `showEta` | `boolean` | `false` | Show ETA on progress bar |

### Colors

`black` `red` `green` `yellow` `blue` `magenta` `cyan` `white` `gray`  
`redBright` `greenBright` `yellowBright` `blueBright` `magentaBright` `cyanBright` `whiteBright`

### Events

```typescript
manager.on(AnimationEvent.START,        (data) => { /* animation started */ });
manager.on(AnimationEvent.STOP,         (data) => { /* animation stopped */ });
manager.on(AnimationEvent.STATE_CHANGE, (data) => { /* state transition  */ });
manager.on(AnimationEvent.FRAME,        (data) => { /* new frame rendered */ });
manager.on(AnimationEvent.ERROR,        (data) => { /* error occurred     */ });
```

## Custom Animations

```typescript
import { AbstractAnimation, AnimationConfig } from '@backendkit-labs/console-animations';

class MyAnimation extends AbstractAnimation {
  constructor(config: AnimationConfig) { super(config); }

  protected buildFrames(): string[] {
    return ['◐', '◓', '◑', '◒'];
  }
}
```

## Architecture

```
AnimationManager (Facade)
  ├── AnimationFactory    — creates animations by type
  ├── AnimationRegistry   — ID → IAnimation map
  ├── FrameScheduler      — adaptive loop, min 16 ms
  ├── RenderEngine        — stdout writer + ANSI + CI detection
  └── EventEmitter        — observer pattern

AbstractAnimation (Template Method)
  └── 17 concrete animations

AnimationBuilder   — fluent config builder
Presets            — ready-to-use configs for common tasks
```
