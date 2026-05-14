# @backendkit-labs/pipeline

[![npm version](https://img.shields.io/npm/v/@backendkit-labs/pipeline?style=flat-square&color=cb3837)](https://www.npmjs.com/package/@backendkit-labs/pipeline)
[![CI](https://img.shields.io/github/actions/workflow/status/backendkit-dev/backendkit-monorepo/ci.yml?style=flat-square&label=CI)](https://github.com/backendkit-dev/backendkit-monorepo/actions/workflows/ci.yml)
[![License](https://img.shields.io/npm/l/@backendkit-labs/pipeline?style=flat-square)](LICENSE)
[![Node](https://img.shields.io/node/v/@backendkit-labs/pipeline?style=flat-square)](package.json)

> Type-safe async pipeline for Node.js — Chain of Responsibility pattern with stop-on-first / collect-all modes, conditional steps, observability hooks, and optional NestJS integration.

Each step in the pipeline receives the current context, transforms it, and returns a typed result. If a step fails, the pipeline can stop immediately or continue collecting all errors — your choice per pipeline.

---

## Installation

```bash
npm install @backendkit-labs/pipeline
```

NestJS peer dependencies (only for the `/nestjs` subpath):

```bash
npm install @nestjs/common @nestjs/core rxjs
```

---

## TypeScript Configuration

### Subpath exports (`/nestjs`)

This package uses the `exports` field in `package.json` to expose the `/nestjs` subpath. TypeScript's ability to resolve it depends on the `moduleResolution` setting in your `tsconfig.json`.

**Modern resolution (recommended) — no extra config needed:**

```json
// tsconfig.json
{
  "compilerOptions": {
    "moduleResolution": "bundler"
  }
}
```

`"bundler"`, `"node16"`, and `"nodenext"` all understand the `exports` field natively. This is the recommended setting for any project using a bundler (Webpack, esbuild, Vite) or for NestJS projects on TypeScript ≥ 5.

**Legacy resolution (`"node"`) — add `paths` aliases:**

NestJS projects generated before ~2024 default to `"moduleResolution": "node"`, which ignores the `exports` field entirely. TypeScript won't find the types for `@backendkit-labs/pipeline/nestjs` unless you add explicit path aliases:

```json
// tsconfig.json
{
  "compilerOptions": {
    "moduleResolution": "node",
    "paths": {
      "@backendkit-labs/pipeline/nestjs": [
        "./node_modules/@backendkit-labs/pipeline/dist/nestjs/index"
      ]
    }
  }
}
```

> **Why does this happen?** The `"node"` resolver was designed before subpath exports existed. It only knows how to find `main` and `types` at the root of a package — it does not read the `exports` map. The `paths` alias manually points TypeScript to the right `.d.ts` file for the subpath.
>
> The `splitting: true` tsup option (which this package uses) and this `paths` configuration solve completely different problems. `splitting` fixes a **runtime** class identity issue — ensuring there is only one copy of a class in memory across both bundles. The `paths` alias fixes a **compile-time** issue — helping TypeScript find the types. Both may be needed in a legacy project.

---

### NestJS decorator support

NestJS requires two compiler options to be enabled:

```json
// tsconfig.json
{
  "compilerOptions": {
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  }
}
```

And `reflect-metadata` must be imported once at application startup, before any NestJS module is loaded:

```typescript
// main.ts
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(3000);
}
bootstrap();
```

> NestJS CLI scaffolds both of these automatically. You only need to check this if you are setting up a project manually or if decorator-related DI errors appear at runtime.

---

## Quick Start — Framework-agnostic

```typescript
import { pipeline, Ok, Err } from '@backendkit-labs/pipeline';
import type { PipelineStep, StepResult } from '@backendkit-labs/pipeline';

interface OrderCtx {
  productId: string;
  quantity:  number;
  stock:     number;
  price:     number;
  total:     number;
}

interface OrderError {
  code:    string;
  message: string;
}

class StockStep implements PipelineStep<OrderCtx, OrderError> {
  async handle(ctx: OrderCtx): Promise<StepResult<OrderCtx, OrderError>> {
    if (ctx.stock < ctx.quantity) {
      return Err({ code: 'INSUFFICIENT_STOCK', message: 'Not enough stock' });
    }
    return Ok(ctx);
  }
}

class PricingStep implements PipelineStep<OrderCtx, OrderError> {
  async handle(ctx: OrderCtx): Promise<StepResult<OrderCtx, OrderError>> {
    return Ok({ ...ctx, total: ctx.price * ctx.quantity });
  }
}

// Build and run
const result = await pipeline<OrderCtx, OrderError>()
  .pipe(new StockStep())
  .pipe(new PricingStep())
  .run({ productId: 'p1', quantity: 2, stock: 10, price: 50, total: 0 });

if (result.ok) {
  console.log(result.value.total);        // 100
  console.log(result.executedSteps);      // ['StockStep', 'PricingStep']
} else {
  console.log(result.error.failedStep);   // 'StockStep'
  console.log(result.error.cause);        // { code: 'INSUFFICIENT_STOCK', ... }
}
```

---

## Quick Start — NestJS

```typescript
// order.pipeline.ts
import { definePipeline } from '@backendkit-labs/pipeline';
import type { OrderCtx, OrderError } from './order.types';

export const ORDER_PIPELINE = definePipeline<OrderCtx, OrderError>('order');
```

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { PipelineModule } from '@backendkit-labs/pipeline/nestjs';
import { ORDER_PIPELINE } from './order.pipeline';
import { StockStep, PricingStep, NotifyStep } from './steps';

@Module({
  imports: [
    PipelineModule.forRoot({
      pipelines: [
        {
          token:   ORDER_PIPELINE,
          steps:   [StockStep, PricingStep, NotifyStep],
          options: {
            onError: (step, err) => logger.error(`Pipeline failed at ${step}`, err),
          },
        },
      ],
    }),
  ],
})
export class AppModule {}
```

```typescript
// order.service.ts
import { Injectable } from '@nestjs/common';
import { InjectPipeline } from '@backendkit-labs/pipeline/nestjs';
import { Pipeline } from '@backendkit-labs/pipeline';
import { ORDER_PIPELINE } from './order.pipeline';
import type { OrderCtx, OrderError } from './order.types';

@Injectable()
export class OrderService {
  constructor(
    @InjectPipeline(ORDER_PIPELINE)
    private readonly pipeline: Pipeline<OrderCtx, OrderError>,
  ) {}

  async processOrder(ctx: OrderCtx) {
    return this.pipeline.run(ctx);
  }
}
```

---

## API

### `pipeline(options?)`

Creates a new pipeline builder.

```typescript
const p = pipeline<TContext, TError>(options?);
```

#### Options

```typescript
pipeline<Ctx, Err>({
  // 'stop-on-first' — stop and return on the first failure (default)
  // 'collect-all'   — run all steps, accumulate every failure
  mode: 'stop-on-first',

  onStep(stepName, ctx) {
    logger.debug(`[pipeline] → ${stepName}`);
  },

  onStepComplete(stepName, ctx, durationMs) {
    metrics.timing(`step.${stepName}`, durationMs);
  },

  onError(stepName, error) {
    logger.error(`[pipeline] ✗ ${stepName}`, error);
  },

  onComplete(ctx, durationMs) {
    metrics.timing('pipeline.total', durationMs);
  },
});
```

---

### `.pipe(step)`

Adds a step that always runs.

```typescript
p.pipe(new StockStep())
 .pipe(new PricingStep());
```

---

### `.pipeIf(condition, step)`

Adds a step that runs only when `condition(ctx)` returns `true`. The condition receives the context **after** all previous steps have transformed it.

```typescript
p.pipe(new BaseStep())
 .pipeIf(ctx => ctx.hasDiscount, new DiscountStep())
 .pipe(new FinalStep());
```

---

### `.run(ctx)`

Executes the pipeline and returns a `PipelineRunResult`.

```typescript
const result = await p.run(initialCtx);

// Success
result.ok            // true
result.value         // final context
result.executedSteps // ['StockStep', 'PricingStep']
result.durationMs    // total duration

// Failure
result.ok                    // false
result.error.failedStep      // 'StockStep'
result.error.cause           // original typed error
result.error.executedSteps   // steps that ran before the failure
result.error.durationMs      // total duration
result.error.failures        // all failures — one entry for stop-on-first, N for collect-all
result.error.mode            // 'stop-on-first' | 'collect-all'
```

---

### `Ok(value)` / `Err(error)`

Helpers for returning step results.

```typescript
import { Ok, Err } from '@backendkit-labs/pipeline';

async handle(ctx): Promise<StepResult<Ctx, Err>> {
  if (!valid) return Err({ code: 'INVALID' });
  return Ok({ ...ctx, validated: true });
}
```

---

### `PipelineStep<TContext, TError>`

Interface your step classes implement.

```typescript
import type { PipelineStep, StepResult } from '@backendkit-labs/pipeline';

class MyStep implements PipelineStep<Ctx, MyError> {
  // Optional — overrides constructor.name in error reports and hook calls
  readonly stepName = 'MyStep';

  async handle(ctx: Ctx): Promise<StepResult<Ctx, MyError>> {
    // ...
  }
}
```

---

## Error Modes

### `stop-on-first` (default)

Stops at the first failure. Use when later steps depend on earlier ones being successful.

```typescript
pipeline({ mode: 'stop-on-first' })
  .pipe(new AuthStep())      // if this fails → stop, PaymentStep never runs
  .pipe(new PaymentStep())
  .run(ctx);
```

### `collect-all`

Runs every step regardless of failures. Use when steps are independent and you want to report all errors at once — e.g., form validation.

```typescript
pipeline({ mode: 'collect-all' })
  .pipe(new ValidateNameStep())
  .pipe(new ValidateEmailStep())
  .pipe(new ValidatePhoneStep())
  .run(formData);

// result.error.failures → [{ step: 'ValidateEmailStep', cause: ... }, { step: 'ValidatePhoneStep', cause: ... }]
```

---

## NestJS Integration

### `definePipeline<TContext, TError>(name)`

Creates a typed injection token. Define it once and share across module and service.

```typescript
export const ORDER_PIPELINE = definePipeline<OrderCtx, OrderError>('order');
// PipelineToken<OrderCtx, OrderError>
```

### `PipelineModule.forRoot(options)`

Registers pipelines globally. Each step class is resolved via NestJS DI, so steps can inject other services.

```typescript
PipelineModule.forRoot({
  pipelines: [
    {
      token:   ORDER_PIPELINE,
      steps:   [StockStep, PricingStep, NotifyStep],  // resolved via DI
      options: { mode: 'stop-on-first', onError: ... },
    },
  ],
})
```

### `@InjectPipeline(token)`

Parameter decorator for injecting a pipeline into a service.

```typescript
constructor(
  @InjectPipeline(ORDER_PIPELINE)
  private readonly orderPipeline: Pipeline<OrderCtx, OrderError>,
) {}
```

---

## Use Cases

| Scenario | Mode |
|---|---|
| Order processing (stock → payment → notify) | `stop-on-first` |
| Form / DTO validation (collect all field errors) | `collect-all` |
| User onboarding (KYC → plan → welcome email) | `stop-on-first` |
| File processing (validate → scan → compress → upload) | `stop-on-first` |
| Webhook processing (verify signature → parse → deduplicate → route) | `stop-on-first` |
| Pricing pipeline (base → volume discount → tax → currency) | `stop-on-first` |

---

## Design Notes

### Context is immutable by convention

Each step returns a **new** context object rather than mutating the existing one. This makes each step's input/output explicit and easy to trace in logs.

```typescript
// Do this
return Ok({ ...ctx, total: ctx.price * ctx.quantity });

// Not this
ctx.total = ctx.price * ctx.quantity;
return Ok(ctx);
```

### Steps are plain classes

Steps don't extend a base class or require special decorators. They just implement `PipelineStep<TContext, TError>`. This makes them easy to test in isolation:

```typescript
const result = await new StockStep().handle({ stock: 0, quantity: 5, ... });
expect(result.ok).toBe(false);
```

### NestJS DI class identity

`PipelineModule.forRoot()` resolves step classes via NestJS DI and wires them into the pipeline at startup. All steps share the same DI context — no class identity issues.

---

## License

Apache-2.0 — [BackendKit Labs](https://github.com/backendkit-dev)
