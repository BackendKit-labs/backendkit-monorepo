# @backendkit-labs/console-animations

> Enterprise-grade terminal animations for Node.js CLI applications and backend processes.

**17 built-in animations** — spinners, progress bars, loaders and visual effects — with a clean TypeScript API, ESM + CJS dual format, and zero runtime dependencies.

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
| **Progress Bar** | `PROGRESS_BAR` | `[████████░░░░] 67%` | File download, build steps |
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
| **Hacker** | `HACKER` | `[FF] A3  2B  7C` `[A3] 7C  FF  2B` | Hex scan, network activity |
| **Rain** | `RAIN` | `╷│╵` pattern | Ambient, idle state |
| **Fire** | `FIRE` | `   ▲   ` `  ▲▲▲  ` `▲▲▲█▲▲▲` | Alerts, hot paths |
| **Stars** | `STARS` | `✦  ✧  ✦  ✧` `✧  ✦  ✧  ✦` | Success, decorative |
| **Particles** | `PARTICLES` | `·   ·   ·` `  · · ·  ` `   ···   ` | Ambient, decorative |
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
  speed: 80,
  prefix: '  Installing packages ',
});

setTimeout(() => manager.stop(spinner.id), 3000);
```

### Wrap an async task (auto-stop on finish or error)

```typescript
const result = await manager.run(
  { type: AnimationType.DOTS, color: 'green', prefix: '  Deploying ' },
  () => deployToProduction(),
);
```

### Progress bar with manual control

```typescript
const bar = manager.start({
  type: AnimationType.PROGRESS_BAR,
  width: 30,
  color: 'cyan',
  prefix: '  Uploading ',
});

// Drive progress externally
bar.setProgress(45); // → [█████████████░░░░░░░░░░░░░░░░░] 45%
bar.setProgress(100);
manager.stop(bar.id);
```

---

## API Reference

### AnimationManager

The main entry point. Manages the full lifecycle of animations.

```typescript
const manager = new AnimationManager();
```

| Method | Signature | Description |
|--------|-----------|-------------|
| `start` | `(config) → IAnimation` | Creates and starts an animation |
| `stop` | `(id) → void` | Stops and unregisters an animation |
| `pause` | `(id) → void` | Freezes the current frame |
| `resume` | `(id) → void` | Resumes a paused animation |
| `destroy` | `(id) → void` | Stops and releases all resources |
| `destroyAll` | `() → void` | Destroys all active animations |
| `get` | `(id) → IAnimation \| undefined` | Gets an animation by ID |
| `getAll` | `() → IAnimation[]` | Returns all registered animations |
| `getByType` | `(type) → IAnimation[]` | Filters by type |
| `run<T>` | `(config, task) → Promise<T>` | Wraps an async task with auto-stop |
| `on` | `(event, handler) → void` | Subscribes to global events |

### AnimationBuilder

Fluent API for composing animation configs.

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
| `custom` | `Record<string, unknown>` | `undefined` | Extra data for custom animations |

### Events

```typescript
manager.on(AnimationEvent.START,        (data) => { /* animation started */ });
manager.on(AnimationEvent.STOP,         (data) => { /* animation stopped */ });
manager.on(AnimationEvent.STATE_CHANGE, (data) => { /* state transition */ });
manager.on(AnimationEvent.FRAME,        (data) => { /* new frame rendered */ });
manager.on(AnimationEvent.ERROR,        (data) => { /* error occurred */ });
```

### Colors

`black` `red` `green` `yellow` `blue` `magenta` `cyan` `white` `gray`
`redBright` `greenBright` `yellowBright` `blueBright` `magentaBright` `cyanBright` `whiteBright`

---

## Custom Animations

Extend `AbstractAnimation` and implement `buildFrames()`:

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
  ├── FrameScheduler      — adaptive rAF loop, min 16 ms
  ├── RenderEngine        — stdout writer + ANSI cursor control
  └── EventEmitter        — observer pattern

AbstractAnimation (Template Method)
  └── 17 concrete animations

AnimationBuilder (Fluent Builder)
```

---

## Examples

```bash
git clone https://github.com/backendkit-dev/backendkit-monorepo.git
cd backendkit-monorepo/packages/console-animations
npm install && npm run build

npx tsx examples/basic-usage.ts
npx tsx examples/multi-animation.ts
npx tsx examples/custom-animation.ts
npx tsx examples/async-workflow.ts
```

---

## License

MIT — [BackendKit Labs](https://github.com/backendkit-dev)
