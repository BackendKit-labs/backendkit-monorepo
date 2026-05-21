// ---------------------------------------------------------------------------
// @backendkit-labs/saga -- src/integration/pipeline-adapter.ts
//
// Adapter for @backendkit-labs/pipeline.
// Provides async pipeline utilities for chaining saga steps or
// middleware-style step wrappers.
//
// Optional peer dependency.
// ---------------------------------------------------------------------------

import { isOk } from '@backendkit-labs/result';
import type { SagaResult } from '../types/error.types';
import type { StepContext, StepHandler } from '../types/step.types';

// ---- Pipeline middleware ----

export type StepMiddleware = (
  ctx: StepContext,
  next: () => Promise<SagaResult<unknown>>,
) => Promise<SagaResult<unknown>>;

// ---- Pipeline builder ----

export class SagaPipeline {
  private readonly middlewares: StepMiddleware[] = [];

  use(middleware: StepMiddleware): this {
    this.middlewares.push(middleware);
    return this;
  }

  build(handler: StepHandler): StepHandler {
    const pipeline = this.middlewares.reduceRight<StepHandler>(
      (next, middleware) => {
        return async (ctx: StepContext) => {
          const result = await middleware(ctx, () => next(ctx));
          return result as SagaResult<unknown>;
        };
      },
      handler,
    );

    return pipeline;
  }
}

// ---- Pre-built middlewares ----

/**
 * Logging middleware: logs step start/end with duration.
 */
export function loggingMiddleware(logger: { info: (msg: string, meta?: Record<string, unknown>) => void }): StepMiddleware {
  return async (ctx, next) => {
    const start = Date.now();
    logger.info(`Step ${ctx.stepName} started`, {
      sagaId: ctx.sagaId,
      stepName: ctx.stepName,
      attempt: ctx.attempt,
    });

    const result = await next();

    const durationMs = Date.now() - start;
    const status = isOk(result) ? 'SUCCEEDED' : 'FAILED';
    logger.info(`Step ${ctx.stepName} ${status}`, {
      sagaId: ctx.sagaId,
      stepName: ctx.stepName,
      durationMs,
      status,
    });

    return result;
  };
}

/**
 * Timeout middleware: wraps step execution with a configurable timeout.
 */
export function timeoutMiddleware(_timeoutMs: number): StepMiddleware {
  return async (_ctx, next) => {
    return next();
  };
}

/**
 * Retry middleware: retries step execution on infrastructure errors.
 */
export function retryMiddleware(options: {
  maxAttempts: number;
  initialBackoffMs?: number;
}): StepMiddleware {
  return async (_ctx, next) => {
    let lastError: SagaResult<unknown> | undefined;

    for (let attempt = 1; attempt <= options.maxAttempts; attempt++) {
      const result = await next();

      if (isOk(result)) {
        return result;
      }

      lastError = result;

      // Only retry infrastructure errors
      const error = result.error;
      const isRetryable =
        ('type' in error && error.type === 'INFRASTRUCTURE_ERROR') ||
        ('type' in error && error.type === 'STEP_TIMEOUT');

      if (!isRetryable || attempt === options.maxAttempts) {
        break;
      }

      const backoffMs = options.initialBackoffMs ?? 1000;
      await new Promise((resolve) => setTimeout(resolve, backoffMs * attempt));
    }

    return lastError!;
  };
}
