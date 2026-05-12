# cursor-animation

> Enterprise-grade terminal animations library for Node.js CLI applications.

**cursor-animation** provides 17 built-in animations (spinner, dots, progress bar, worm, matrix, and more) with a clean, extensible API. Built with TypeScript, ESM + CJS dual format, and zero runtime dependencies.

## Installation

```bash
npm install cursor-animation
```

## Quick Start

```typescript
import { AnimationManager, AnimationType } from 'cursor-animation';

const manager = new AnimationManager();

// Start a spinner
const anim = manager.start({
  type: AnimationType.SPINNER,
  color: 'cyan',
  speed: 80,
  prefix: '  Loading... ',
});

// Stop after 3 seconds
setTimeout(() => {
  manager.stop(anim.id);
}, 3000);
```

## API Reference

### AnimationManager (Facade)

The main entry point. Manages the full lifecycle of animations.

```typescript
const manager = new AnimationManager();
```

#### `start(config: AnimationConfig): IAnimation`

Creates and starts an animation. Returns the animation instance.

```typescript
const anim = manager.start({
  type: AnimationType.WORM,
  color: 'magenta',
  speed: 100,
});
```

#### `stop(id: string): void`

Stops and unregisters an animation by ID.

#### `pause(id: string): void`

Pauses an animation (freezes frame).

#### `resume(id: string): void`

Resumes a paused animation.

#### `destroy(id: string): void`

Destroys an animation and cleans up resources.

#### `destroyAll(): void`

Destroys all active animations and stops the scheduler.

#### `get(id: string): IAnimation | undefined`

Gets an animation by ID.

#### `getAll(): IAnimation[]`

Returns all registered animations.

#### `getByType(type: AnimationType): IAnimation[]`

Returns all animations of a given type.

#### `on(event: AnimationEvent, handler: EventHandler): void`

Subscribes to global events.

```typescript
manager.on(AnimationEvent.START, (data) => {
  console.log(`Animation started: ${data.id}`);
});
```

#### `run<T>(config: AnimationConfig, task: () => Promise<T>): Promise<T>`

Runs an async task with an animation that auto-stops on completion or error.

```typescript
const result = await manager.run(
  { type: AnimationType.DOTS, text: 'Processing', color: 'green' },
  () => someAsyncTask(),
);
```

### AnimationBuilder (Builder Pattern)

Fluent API for building animation configs.

```typescript
import { AnimationBuilder, AnimationType } from 'cursor-animation';

const config = new AnimationBuilder()
  .setType(AnimationType.SPINNER)
  .setColor('cyan')
  .setSpeed(80)
  .setPrefix('  Loading... ')
  .build();

const anim = manager.start(config);
```

### AnimationConfig

| Property    | Type                  | Default     | Description                              |
|-------------|-----------------------|-------------|------------------------------------------|
| `type`      | `AnimationType`       | (required)  | Animation type identifier                |
| `id`        | `string`              | auto-generated | Unique animation ID                   |
| `text`      | `string`              | `''`        | Text content (used by dots, typing, etc.)|
| `color`     | `Color`               | `undefined` | ANSI color name                          |
| `speed`     | `number`              | `80`        | Milliseconds between frames              |
| `prefix`    | `string`              | `''`        | Text prepended to each frame             |
| `suffix`    | `string`              | `''`        | Text appended to each frame              |
| `overwrite` | `boolean`             | `true`      | Overwrite current line on render         |
| `multiline` | `boolean`             | `false`     | Frame spans multiple lines               |
| `frames`    | `string[]`            | `undefined` | Custom frame array (overrides built-in)  |
| `width`     | `number`              | `20`        | Width for progress-bar animation         |
| `total`     | `number`              | `100`       | Total steps for progress-bar animation   |
| `custom`    | `Record<string, unknown>` | `undefined` | Custom data for extended animations    |

### AnimationType Enum

| Value             | Description                    |
|-------------------|--------------------------------|
| `SPINNER`         | Classic spinner: `| / - \`     |
| `DOTS`            | Bouncing dots: `⠋ ⠙ ⠹ ...`    |
| `PROGRESS_BAR`    | Progress bar: `[====>   ] 50%` |
| `WORM`            | Sliding worm: `[~>~~]`         |
| `STARS`           | Twinkling stars                |
| `PARTICLES`       | Floating particles             |
| `WAVES`           | Wave pattern                   |
| `PULSE`           | Pulsing circle                 |
| `MATRIX`          | Matrix rain effect             |
| `FIRE`            | Fire animation                 |
| `TYPING`          | Typewriter effect              |
| `SNAKE`           | Snake movement                 |
| `BOUNCING_BALL`   | Bouncing ball                  |
| `RAIN`            | Rain drops                     |
| `CYBERPUNK`       | Cyberpunk neon style           |
| `HACKER`          | Hacker terminal style          |
| `FUTURISTA`       | Futuristic sci-fi style        |

### AnimationState Enum

| Value       | Description                        |
|-------------|------------------------------------|
| `IDLE`      | Created but not started            |
| `RUNNING`   | Actively producing frames          |
| `PAUSED`    | Frozen, no frames produced         |
| `DONE`      | Stopped normally                   |
| `ERROR`     | Stopped due to error               |
| `DESTROYED` | Resources released                 |

### AnimationEvent Enum

| Value           | Description                        |
|-----------------|------------------------------------|
| `START`         | Animation started                  |
| `STOP`          | Animation stopped                  |
| `PAUSE`         | Animation paused                   |
| `RESUME`        | Animation resumed                  |
| `DESTROY`       | Animation destroyed                |
| `STATE_CHANGE`  | State transition occurred          |
| `FRAME`         | New frame produced                 |
| `ERROR`         | Error occurred                     |
| `COMPLETE`      | Animation completed                |

### IAnimation Interface

```typescript
interface IAnimation {
  readonly id: string;
  readonly type: string;
  readonly state: AnimationState;

  start(): void;
  stop(): void;
  pause(): void;
  resume(): void;
  destroy(): void;
  nextFrame(timestamp: number): Frame;
  reset(): void;
  on(event: AnimationEvent, handler: EventHandler): void;
  getConfig(): AnimationConfig;
}
```

### Color Type

Supported colors: `'black'`, `'red'`, `'green'`, `'yellow'`, `'blue'`, `'magenta'`, `'cyan'`, `'white'`, `'gray'`, `'grey'`, `'redBright'`, `'greenBright'`, `'yellowBright'`, `'blueBright'`, `'magentaBright'`, `'cyanBright'`, `'whiteBright'`.

## Examples

### Basic Usage

```typescript
import { AnimationManager, AnimationType } from 'cursor-animation';

const manager = new AnimationManager();

const spinner = manager.start({
  type: AnimationType.SPINNER,
  color: 'cyan',
  speed: 80,
  prefix: '  Loading... ',
});

setTimeout(() => {
  manager.stop(spinner.id);
}, 3000);
```

### Multiple Animations

```typescript
const spinner = manager.start({ type: AnimationType.SPINNER, color: 'cyan' });
const dots = manager.start({ type: AnimationType.DOTS, text: 'Task 2', color: 'yellow' });
const worm = manager.start({ type: AnimationType.WORM, color: 'magenta' });

// Stop individually
setTimeout(() => manager.stop(spinner.id), 2000);
setTimeout(() => manager.stop(dots.id), 3500);
setTimeout(() => manager.stop(worm.id), 5000);
```

### Custom Animation

Extend `AbstractAnimation` and implement `buildFrames()`:

```typescript
import { AbstractAnimation, AnimationConfig } from 'cursor-animation';

class MyCustomAnimation extends AbstractAnimation {
  constructor(config: AnimationConfig) {
    super(config);
  }

  protected buildFrames(): string[] {
    return ['◐', '◓', '◑', '◒'];
  }
}
```

### Async Workflow with Auto-stop

```typescript
const result = await manager.run(
  { type: AnimationType.DOTS, text: 'Processing', color: 'green' },
  async () => {
    // Your async task here
    return await someApiCall();
  },
);
```

## Architecture

```
AnimationManager (Facade)
  ├── AnimationFactory (creates animations by type)
  ├── AnimationRegistry (ID → IAnimation map)
  ├── FrameScheduler (adaptive loop, min 16ms)
  ├── RenderEngine (stdout writer, ANSI codes)
  └── EventEmitter (observer pattern)

AbstractAnimation (Template Method)
  └── 17 concrete animations (Spinner, Worm, Matrix, etc.)

AnimationBuilder (Fluent Builder)
```

## Events

```typescript
manager.on(AnimationEvent.START, (data) => {
  console.log(`Animation ${data.id} started`);
});

manager.on(AnimationEvent.STATE_CHANGE, (data) => {
  console.log(`${data.id}: ${data.from} → ${data.to}`);
});

manager.on(AnimationEvent.ERROR, (data) => {
  console.error(`Animation ${data.id} error:`, data.error);
});
```

## Running Examples

```bash
# Clone the repo
git clone https://github.com/your-username/cursor-animation.git
cd cursor-animation

# Install dependencies
npm install

# Build
npm run build

# Run examples
npx tsx examples/basic-usage.ts
npx tsx examples/multi-animation.ts
npx tsx examples/custom-animation.ts
npx tsx examples/async-workflow.ts
```

## Development

```bash
# Type check
npm run typecheck

# Test
npm test

# Build
npm run build

# Watch mode
npm run dev
```

## License

MIT
