# @backendkit-labs/console-animations

[![npm version](https://img.shields.io/npm/v/@backendkit-labs/console-animations?style=flat-square&color=cb3837)](https://www.npmjs.com/package/@backendkit-labs/console-animations)
[![CI](https://img.shields.io/github/actions/workflow/status/BackendKit-labs/backendkit-monorepo/ci.yml?style=flat-square&label=CI)](https://github.com/BackendKit-labs/backendkit-monorepo/actions/workflows/ci.yml)
[![License](https://img.shields.io/npm/l/@backendkit-labs/console-animations?style=flat-square)](LICENSE)
[![Node](https://img.shields.io/node/v/@backendkit-labs/console-animations?style=flat-square)](package.json)
[![Downloads](https://img.shields.io/npm/dm/@backendkit-labs/console-animations?style=flat-square)](https://www.npmjs.com/package/@backendkit-labs/console-animations)

> Enterprise-grade terminal animations for Node.js CLI applications and backend processes.

**17 built-in animations** — spinners, progress bars, loaders and visual effects — with terminal states (`succeed` / `fail` / `warn`), dynamic text updates, CI detection, and zero runtime dependencies.

```bash
# Try it instantly
npx @backendkit-labs/console-animations
```

---

## Animations Preview

### Spinners & Loaders

| Animation | Type | Frames | Use case |
|-----------|------|--------|----------|
| **Spinner** | `SPINNER` | `⠋` `⠙` `⠹` `⠸` `⠼` `⠴` `⠦` `⠧` `⠇` `⠏` | Tasks, installs, fetching |
| **Dots** | `DOTS` | `⣾` `⣽` `⣻` `⢿` `⡿` `⣟` `⣯` `⣷` | Waiting, processing |
| **Pulse** | `PULSE` | `·` `◌` `○` `◎` `●` `◎` `○` `◌` | Heartbeat, status check |
| **Worm** | `WORM` | `[●─────────]` `[────●─────]` `[─────────●]` | Indeterminate progress |
| **Snake** | `SNAKE` | `●·········` `·····●····` `·········●` | Scanning, searching |
| **Bouncing Ball** | `BOUNCING_BALL` | `[◉           ]` `[      ◉     ]` `[           ◉]` | Loading, buffering |

### Progress & Fill

| Animation | Type | Frames | Use case |
|-----------|------|--------|----------|
| **Progress Bar** | `PROGRESS_BAR` | `[████████░░░░] 67% \| ETA: 4s` | File download, build steps |
| **Cyberpunk** | `CYBERPUNK` | `▰▱▱▱▱▱▱▱▱▱` `▰▰▰▰▰▱▱▱▱▱` `▰▰▰▰▰▰▰▰▰▰` | Deploy, upload, sync |

### Text & Typing

| Animation | Type | Frames | Use case |
|-----------|------|--------|----------|
| **Typing** | `TYPING` | `D█` `De█` `Dep█` `Deploy█` | Command output, logs |

### Visual Effects

| Animation | Type | Frames | Use case |
|-----------|------|--------|----------|
| **Waves** | `WAVES` | `▁▂▃▄▅▆▇█▇▆▅▄▃▂` `▂▃▄▅▆▇█▇▆▅▄▃▂▁` | Audio, processing |
| **Matrix** | `MATRIX` | `ｦｱｶｺｻｼｽｾｿ` `ｲｳｴｵﾀﾁﾂﾃﾄ` | Data stream, encryption |
| **Hacker** | `HACKER` | `[FF] A3  2B  7C` `[A3] 7C  FF  2B` | Hex scan, network |
| **Rain** | `RAIN` | `╷│╵` pattern | Ambient, idle state |
| **Fire** | `FIRE` | `   ▲   ` `  ▲▲▲  ` `▲▲▲█▲▲▲` | Alerts, hot paths |
| **Stars** | `STARS` | `✦  ✧  ✦  ✧` `✧  ✦  ✧  ✦` | Success, decorative |
| **Particles** | `PARTICLES` | `·   ·   ·` `  · · ·  ` `   ···   ` | Ambient |
| **Futurista** | `FUTURISTA` | `◆  ◇  ◆` `◇  ◆  ◇` `◈  ◇  ◈` | Sci-fi, startup |

---

## Installation

```bash
npm install @backendkit-labs/console-animations
```

---

## Quick Start

```typescript
import { AnimationManager, AnimationType } from '@backendkit-labs/console-animations';

const manager = new AnimationManager();

const spinner = manager.start({
  type: AnimationType.SPINNER,
  color: 'cyan',
  prefix: '  Installing packages ',
});

setTimeout(() => {
  manager.succeed(spinner.id, 'Packages installed');
}, 3000);
```

---

## Terminal States

Stop animations with a visible result — the most important feature for professional CLIs:

```typescript
manager.succeed(id, 'Build complete')   // ✔ Build complete   (green)
manager.fail(id, 'Build failed')        // ✖ Build failed     (red)
manager.warn(id, 'Skipped 3 files')     // ⚠ Skipped 3 files  (yellow)
manager.info(id, 'Cache hit')           // ℹ Cache hit        (cyan)
```

Works in CI too — animations are silent in non-TTY environments, only the final state is printed.

---

## Presets

Ready-to-use configurations for the most common backend and CLI scenarios:

```typescript
import { AnimationManager, Presets } from '@backendkit-labs/console-animations';

const manager = new AnimationManager();

// One-liner for common tasks
const s = manager.start(Presets.install('Installing dependencies'));
const b = manager.start(Presets.build('Compiling TypeScript'));
const d = manager.start(Presets.deploy('Deploying to production'));
const c = manager.start(Presets.connect('Connecting to database'));

// With auto succeed/fail via run()
const result = await manager.run(
  Presets.build('Building'),
  () => runWebpack(),
);
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

---

## Progress Bar with ETA

```typescript
const bar = manager.start(Presets.download('Downloading package', 100));

// Drive progress externally — ETA is calculated automatically
bar.setProgress(30);  // [████████░░░░░░░░░░░░░░░░░░░░░░]  30% | ETA: 7s
bar.setProgress(60);  // [████████████████░░░░░░░░░░░░░░]  60% | ETA: 3s
bar.setProgress(100); // [██████████████████████████████] 100% | 1.2s

manager.succeed(bar.id, 'Download complete');
```

---

## Dynamic Updates

Change text or config while an animation is running:

```typescript
const s = manager.start(Presets.install('Resolving packages'));

// Update prefix mid-flight
manager.update(s.id, { prefix: '  Downloading packages ' });
manager.update(s.id, { prefix: '  Linking dependencies ' });

manager.succeed(s.id, 'Installation complete');
```

---

## Async Workflow with Auto-stop

```typescript
// run() automatically calls succeed() on resolve, fail() on reject
const result = await manager.run(
  Presets.deploy('Deploying to production'),
  () => deployToProduction(),
  {
    successText: 'Deployed successfully',
    failText: 'Deployment failed',
  },
);
```

---

## CI / Non-TTY Detection

Animations are automatically disabled in non-interactive environments (CI, piped output). Only terminal states are printed:

```
# In a terminal (interactive)
⠙ Building TypeScript...   ← animated

# In GitHub Actions / CI
✔ Building TypeScript       ← only final state, no animation noise
```

No configuration needed — detection is automatic via `process.stdout.isTTY` and `process.env.CI`.

---

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
| `getAll` | `() → IAnimation[]` | Returns all active animations |
| `getByType` | `(type) → IAnimation[]` | Filters by type |
| `run<T>` | `(config, task, opts?) → Promise<T>` | Wraps async task with auto-stop |

### AnimationBuilder

Fluent API for composing configs:

```typescript
import { AnimationBuilder, AnimationType } from '@backendkit-labs/console-animations';

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
| `text` | `string` | `''` | Text for typing animation |
| `color` | `Color` | `undefined` | ANSI color |
| `speed` | `number` | `80` | ms between frames |
| `prefix` | `string` | `''` | Text before the animation |
| `suffix` | `string` | `''` | Text after the animation |
| `overwrite` | `boolean` | `true` | Overwrite current line |
| `multiline` | `boolean` | `false` | Multi-line frame |
| `frames` | `string[]` | `undefined` | Custom frame array |
| `width` | `number` | `20` | Progress bar width |
| `total` | `number` | `100` | Progress bar total steps |
| `showEta` | `boolean` | `false` | Show ETA on progress bar |
| `custom` | `Record<string, unknown>` | `undefined` | Extra data for custom animations |

### Colors

`black` `red` `green` `yellow` `blue` `magenta` `cyan` `white` `gray` `grey`
`redBright` `greenBright` `yellowBright` `blueBright` `magentaBright` `cyanBright` `whiteBright`

### Events

```typescript
manager.on(AnimationEvent.START,        (data) => { /* animation started */ });
manager.on(AnimationEvent.STOP,         (data) => { /* animation stopped */ });
manager.on(AnimationEvent.STATE_CHANGE, (data) => { /* state transition  */ });
manager.on(AnimationEvent.FRAME,        (data) => { /* new frame rendered */ });
manager.on(AnimationEvent.ERROR,        (data) => { /* error occurred     */ });
```

---

## Custom Animations

```typescript
import { AbstractAnimation, AnimationConfig } from '@backendkit-labs/console-animations';

class MyAnimation extends AbstractAnimation {
  constructor(config: AnimationConfig) {
    super(config);
  }

  protected buildFrames(): string[] {
    return ['◐', '◓', '◑', '◒'];
  }
}
```

---

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
terminal / symbols — environment detection utilities
```

---

## Running Examples

```bash
git clone https://github.com/BackendKit-labs/backendkit-monorepo.git
cd backendkit-monorepo/packages/console-animations
npm install && npm run build

npx tsx examples/basic-usage.ts
npx tsx examples/multi-animation.ts
npx tsx examples/custom-animation.ts
npx tsx examples/async-workflow.ts
```

---

## License

Apache-2.0 — [BackendKit Labs](https://github.com/BackendKit-labs)
