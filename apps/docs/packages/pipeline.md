---
title: Pipeline
description: Type-safe async pipeline implementing Chain of Responsibility — conditional steps, two error modes, observability hooks, and NestJS DI integration.
---

# @backendkit-labs/pipeline

[![npm](https://img.shields.io/npm/v/@backendkit-labs/pipeline?style=flat-square&color=cb3837)](https://www.npmjs.com/package/@backendkit-labs/pipeline)
[![License](https://img.shields.io/npm/l/@backendkit-labs/pipeline?style=flat-square)](https://github.com/backendkit-dev/backendkit-monorepo/blob/master/LICENSE)
[![Node](https://img.shields.io/node/v/@backendkit-labs/pipeline?style=flat-square)](https://nodejs.org)

> Type-safe async pipeline implementing the Chain of Responsibility pattern. Steps receive an immutable context, transform it, and return a `StepResult`. Zero runtime dependencies.

Each step either returns `Ok(ctx)` to pass the (possibly mutated copy of the) context to the next step, or `Err(error)` to signal failure. Two error modes control what happens on failure: `stop-on-first` halts immediately, `collect-all` runs every step and aggregates all errors.

## Installation

```bash
npm install @backendkit-labs/pipeline
```

NestJS peer dependencies (only for the `/nestjs` subpath):

```bash
npm install @nestjs/common @nestjs/core rxjs
```

## Quick Start

```typescript
import { pipeline, Ok, Err } from '@backendkit-labs/pipeline';
import type { PipelineStep, StepResult } from '@backendkit-labs/pipeline';

interface RequestCtx {
  token: string;
  userId?: string;
  permissions?: string[];
}
type AppError = { code: string; message: string };

const validateToken: PipelineStep<RequestCtx, AppError> = {
  stepName: 'validate-token',
  async handle(ctx): Promise<StepResult<RequestCtx, AppError>> {
    const userId = await tokenService.verify(ctx.token);
    if (!userId) return Err({ code: 'INVALID_TOKEN', message: 'Token verification failed' });
    return Ok({ ...ctx, userId });
  },
};

const loadPermissions: PipelineStep<RequestCtx, AppError> = {
  stepName: 'load-permissions',
  async handle(ctx): Promise<StepResult<RequestCtx, AppError>> {
    const permissions = await permissionsService.forUser(ctx.userId!);
    return Ok({ ...ctx, permissions });
  },
};

const result = await pipeline<RequestCtx, AppError>({ mode: 'stop-on-first' })
  .pipe(validateToken)
  .pipe(loadPermissions)
  .run({ token: req.headers.authorization });

if (result.ok) {
  console.log('Executed steps:', result.executedSteps); // ['validate-token', 'load-permissions']
  console.log('Duration:', result.durationMs, 'ms');
  const ctx = result.value; // RequestCtx with userId and permissions populated
} else {
  console.error('Failed at:', result.error.failedStep);
  console.error('Cause:', result.error.cause);
}
```

## Core Types

### `StepResult`

```typescript
import { Ok, Err } from '@backendkit-labs/pipeline';

Ok(ctx)   // → { ok: true,  value: ctx }
Err(err)  // → { ok: false, error: err }
```

### `PipelineStep`

```typescript
interface PipelineStep<TContext, TError> {
  stepName?: string;
  handle(ctx: TContext): Promise<StepResult<TContext, TError>>;
}
```

### `PipelineMode`

```typescript
type PipelineMode = 'stop-on-first' | 'collect-all';
```

| Mode | Behaviour |
|---|---|
| `stop-on-first` | Default. Execution halts at the first `Err` result. |
| `collect-all` | All steps run regardless of failures. All errors are collected into `failures[]`. |

## Pipeline API

### `pipeline(options?)`

Creates a new pipeline builder. Type parameters `TContext` and `TError` are inferred from the first `.pipe()` call or set explicitly.

```typescript
import { pipeline } from '@backendkit-labs/pipeline';

const p = pipeline<RequestCtx, AppError>({ mode: 'stop-on-first' })
  .pipe(validateTokenStep)
  .pipe(loadUserStep)
  .pipeIf(ctx => ctx.needsAdmin, checkAdminStep);
```

### `.pipe(step)`

Appends a step unconditionally.

### `.pipeIf(predicate, step)`

Appends a step that runs only when `predicate(ctx)` returns `true`. The predicate receives the context as it exists at that point in the pipeline.

```typescript
pipeline<Ctx, Err>()
  .pipe(validateStep)
  .pipeIf(ctx => ctx.role === 'admin', adminOnlyStep)
  .pipe(auditStep);
```

### `.run(initialCtx)`

Executes the pipeline. Returns `Promise<PipelineRunResult<TContext, TError>>`.

**On success:**

```typescript
{
  ok:             true,
  value:          TContext,   // final context after all steps
  executedSteps:  string[],   // step names in execution order
  durationMs:     number,
}
```

**On failure:**

```typescript
{
  ok:    false,
  error: PipelineError<TError>,
}
```

### `PipelineError`

```typescript
interface PipelineError<TError> {
  mode:          PipelineMode,
  failedStep:    string | undefined,  // name of the first failed step
  cause:         TError,              // error from the first failed step
  executedSteps: string[],
  durationMs:    number,
  failures:      Array<{ step: string | undefined; error: TError }>, // all failures in collect-all
}
```

:::tip collect-all mode
In `collect-all` mode, `cause` is the error from the first step that failed, and `failures` contains every failure. Use `failures` to surface all validation errors to the caller in a single response.
:::

## Observability Hooks

All hooks are optional. Pass them in the `pipeline()` options object.

```typescript
pipeline<Ctx, Err>({
  mode: 'stop-on-first',

  onStep(stepName: string, ctx: Ctx): void {
    // Called before each step executes
    logger.debug(`Running step: ${stepName}`);
  },

  onStepComplete(stepName: string, ctx: Ctx, durationMs: number): void {
    // Called after a step returns Ok
    metrics.record('pipeline.step.duration', durationMs, { step: stepName });
  },

  onError(stepName: string | undefined, error: Err): void {
    // Called when a step returns Err
    logger.warn(`Step failed: ${stepName}`, error);
  },

  onComplete(ctx: Ctx, durationMs: number): void {
    // Called when the pipeline completes successfully
    metrics.record('pipeline.duration', durationMs);
  },
})
```

## NestJS Integration

### Define a pipeline token

```typescript
// auth-pipeline.token.ts
import { definePipeline } from '@backendkit-labs/pipeline';

export const AUTH_PIPELINE = definePipeline<RequestCtx, AppError>('auth');
```

`definePipeline(name)` returns an injection token typed to `Pipeline<TContext, TError>`. The `name` is used for logging and error messages.

### Register with `PipelineModule`

```typescript
// app.module.ts
import { PipelineModule } from '@backendkit-labs/pipeline/nestjs';
import { AUTH_PIPELINE } from './auth-pipeline.token';

@Module({
  imports: [
    PipelineModule.forRoot({
      pipelines: [
        {
          token:   AUTH_PIPELINE,
          steps:   [ValidateTokenStep, LoadUserStep, CheckPermissionsStep],
          options: {
            mode:           'stop-on-first',
            onError:        (step, err) => logger.warn('Auth pipeline error', { step, err }),
            onStepComplete: (step, _ctx, ms) => metrics.record('auth.step', ms, { step }),
          },
        },
      ],
    }),
  ],
})
export class AppModule {}
```

Steps listed in `steps` must be `@Injectable()` NestJS providers resolvable from the module context.

### Inject and use

```typescript
// auth.service.ts
import { InjectPipeline } from '@backendkit-labs/pipeline/nestjs';
import type { Pipeline } from '@backendkit-labs/pipeline';

@Injectable()
export class AuthService {
  constructor(
    @InjectPipeline(AUTH_PIPELINE)
    private readonly authPipeline: Pipeline<RequestCtx, AppError>,
  ) {}

  async authenticate(token: string) {
    const result = await this.authPipeline.run({ token });

    if (!result.ok) {
      throw new UnauthorizedException(result.error.cause.message);
    }

    return result.value;
  }
}
```

## TypeScript Configuration

### Modern bundler (`moduleResolution: bundler` or `node16`)

The package ships ESM subpath exports. No extra configuration needed — the `imports` field in `package.json` resolves subpaths automatically.

```json
{
  "compilerOptions": {
    "moduleResolution": "bundler"
  }
}
```

### Legacy `node` moduleResolution

If your project uses `"moduleResolution": "node"`, add a path alias for the NestJS subpath:

```json
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

## Architecture

```
@backendkit-labs/pipeline              (core — zero runtime dependencies)
  pipeline()                           fluent builder — .pipe() / .pipeIf() / .run()
  Ok() / Err()                         StepResult constructors
  PipelineStep<TContext, TError>        step interface
  PipelineMode                         'stop-on-first' | 'collect-all'
  PipelineError<TError>                structured failure with step attribution
  definePipeline(name)                 typed injection token factory

@backendkit-labs/pipeline/nestjs       (optional NestJS layer)
  PipelineModule                       NestJS module — .forRoot() registration
  InjectPipeline(token)                parameter decorator for DI
```
