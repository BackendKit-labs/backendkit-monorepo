// ---------------------------------------------------------------------------
// @backendkit-labs/saga -- tests/integration/pipeline-adapter.test.ts
//
// Integration tests for pipeline-adapter.ts: SagaPipeline, middlewares.
// ---------------------------------------------------------------------------

import { ok, fail, isOk, isFail } from '@backendkit-labs/result';
import { SagaPipeline, loggingMiddleware, retryMiddleware, timeoutMiddleware } from '../../src/integration/pipeline-adapter';
import type { StepContext, StepHandler } from '../../src/types/step.types';
import type { SagaResult, StepError } from '../../src/types/error.types';

function createContext(overrides?: Partial<StepContext>): StepContext {
  return {
    sagaId: 'saga-1' as any,
    correlationId: 'corr-1',
    stepName: 'test-step',
    attempt: 1,
    input: null,
    previousOutput: null,
    metadata: {},
    ...overrides,
  };
}

// =====================================================================
// SagaPipeline
// =====================================================================

describe('SagaPipeline', () => {
  it('should create a pipeline with use() and build() producing a handler', () => {
    const pipeline = new SagaPipeline();
    const handler: StepHandler = async (_ctx: StepContext) => ok({ done: true }) as SagaResult<unknown>;

    const built = pipeline.build(handler);

    expect(built).toBeInstanceOf(Function);
  });

  it('should execute middleware in order before the handler', async () => {
    const order: string[] = [];

    const pipeline = new SagaPipeline();
    pipeline.use(async (_ctx, next) => {
      order.push('mw1');
      return next();
    });
    pipeline.use(async (_ctx, next) => {
      order.push('mw2');
      return next();
    });

    const handler: StepHandler = async (_ctx: StepContext) => {
      order.push('handler');
      return ok({ done: true }) as SagaResult<unknown>;
    };

    const built = pipeline.build(handler);
    const ctx = createContext();
    await built(ctx);

    expect(order).toEqual(['mw1', 'mw2', 'handler']);
  });

  it('should propagate the handler result through the pipeline', async () => {
    const pipeline = new SagaPipeline();
    const handler: StepHandler = async (_ctx: StepContext) => ok(42) as SagaResult<unknown>;

    const built = pipeline.build(handler);
    const result = await built(createContext());

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value).toBe(42);
    }
  });

  it('should propagate failure through the pipeline', async () => {
    const pipeline = new SagaPipeline();
    const err: StepError = { type: 'BUSINESS_ERROR', step: 'test', cause: new Error('fail'), code: 'ERR' };
    const handler: StepHandler = async (_ctx: StepContext) => fail(err) as SagaResult<unknown>;

    const built = pipeline.build(handler);
    const result = await built(createContext());

    expect(isFail(result)).toBe(true);
    if (isFail(result)) {
      expect((result.error as StepError).type).toBe('BUSINESS_ERROR');
    }
  });

  it('should allow middleware to short-circuit the handler', async () => {
    const pipeline = new SagaPipeline();
    pipeline.use(async (_ctx, _next) => {
      // Return early without calling next
      return ok({ shortCircuited: true }) as SagaResult<unknown>;
    });

    const handler: StepHandler = vi.fn(async (_ctx: StepContext) => ok({}) as SagaResult<unknown>);
    const built = pipeline.build(handler);
    const result = await built(createContext());

    expect(handler).not.toHaveBeenCalled();
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value).toEqual({ shortCircuited: true });
    }
  });
});

// =====================================================================
// loggingMiddleware
// =====================================================================

describe('loggingMiddleware', () => {
  it('should log step start and end with duration', async () => {
    const logger = { info: vi.fn() };
    const pipeline = new SagaPipeline();
    pipeline.use(loggingMiddleware(logger));
    pipeline.use(async (_ctx, next) => {
      // Simulate some delay
      await new Promise((r) => setTimeout(r, 5));
      return next();
    });

    const handler: StepHandler = async (_ctx: StepContext) => ok({ done: true }) as SagaResult<unknown>;
    const built = pipeline.build(handler);
    await built(createContext());

    expect(logger.info).toHaveBeenCalledTimes(2);
    expect(logger.info.mock.calls[0][0]).toBe('Step test-step started');
    expect(logger.info.mock.calls[1][0]).toBe('Step test-step SUCCEEDED');
  });

  it('should log FAILED status on step failure', async () => {
    const logger = { info: vi.fn() };
    const pipeline = new SagaPipeline();
    pipeline.use(loggingMiddleware(logger));

    const err: StepError = { type: 'BUSINESS_ERROR', step: 'test', cause: new Error('fail'), code: 'ERR' };
    const handler: StepHandler = async (_ctx: StepContext) => fail(err) as SagaResult<unknown>;
    const built = pipeline.build(handler);
    await built(createContext());

    expect(logger.info).toHaveBeenCalledTimes(2);
    expect(logger.info.mock.calls[1][0]).toBe('Step test-step FAILED');
  });

  it('should include sagaId and stepName in metadata', async () => {
    const logger = { info: vi.fn() };
    const pipeline = new SagaPipeline();
    pipeline.use(loggingMiddleware(logger));

    const handler: StepHandler = async (_ctx: StepContext) => ok({}) as SagaResult<unknown>;
    const built = pipeline.build(handler);
    const ctx = createContext({ sagaId: 'saga-42' as any, stepName: 'my-step' });
    await built(ctx);

    expect(logger.info.mock.calls[0][1]).toMatchObject({
      sagaId: 'saga-42',
      stepName: 'my-step',
    });
  });
});

// =====================================================================
// retryMiddleware
// =====================================================================

describe('retryMiddleware', () => {
  it('should succeed on first attempt if no error', async () => {
    const pipeline = new SagaPipeline();
    pipeline.use(retryMiddleware({ maxAttempts: 3, initialBackoffMs: 10 }));

    const handler: StepHandler = async (_ctx: StepContext) => ok({ done: true }) as SagaResult<unknown>;
    const built = pipeline.build(handler);
    const result = await built(createContext());

    expect(isOk(result)).toBe(true);
  });

  it('should retry on INFRASTRUCTURE_ERROR and eventually succeed', async () => {
    let attempts = 0;
    const pipeline = new SagaPipeline();
    pipeline.use(retryMiddleware({ maxAttempts: 3, initialBackoffMs: 10 }));

    const handler: StepHandler = async (_ctx: StepContext) => {
      attempts++;
      if (attempts < 3) {
        return fail({
          type: 'INFRASTRUCTURE_ERROR',
          step: 'test',
          cause: new Error('timeout #' + attempts),
          code: 'TIMEOUT',
        } satisfies StepError) as SagaResult<unknown>;
      }
      return ok({ done: true, attempts }) as SagaResult<unknown>;
    };

    const built = pipeline.build(handler);
    const result = await built(createContext());

    expect(isOk(result)).toBe(true);
    expect(attempts).toBe(3);
  });

  it('should NOT retry on BUSINESS_ERROR', async () => {
    let attempts = 0;
    const pipeline = new SagaPipeline();
    pipeline.use(retryMiddleware({ maxAttempts: 3, initialBackoffMs: 10 }));

    const handler: StepHandler = async (_ctx: StepContext) => {
      attempts++;
      return fail({
        type: 'BUSINESS_ERROR',
        step: 'test',
        cause: new Error('invalid data'),
        code: 'INVALID',
      } satisfies StepError) as SagaResult<unknown>;
    };

    const built = pipeline.build(handler);
    const result = await built(createContext());

    expect(isFail(result)).toBe(true);
    expect(attempts).toBe(1);
  });

  it('should fail after exhausting retry attempts', async () => {
    let attempts = 0;
    const pipeline = new SagaPipeline();
    pipeline.use(retryMiddleware({ maxAttempts: 2, initialBackoffMs: 10 }));

    const handler: StepHandler = async (_ctx: StepContext) => {
      attempts++;
      return fail({
        type: 'INFRASTRUCTURE_ERROR',
        step: 'test',
        cause: new Error('persistent failure'),
        code: 'ERR',
      } satisfies StepError) as SagaResult<unknown>;
    };

    const built = pipeline.build(handler);
    const result = await built(createContext());

    expect(isFail(result)).toBe(true);
    expect(attempts).toBe(2);
  });
});

// =====================================================================
// timeoutMiddleware
// =====================================================================

describe('timeoutMiddleware', () => {
  it('should pass through and call next', async () => {
    const pipeline = new SagaPipeline();
    pipeline.use(timeoutMiddleware(5000));

    const handler: StepHandler = async (_ctx: StepContext) => ok({ done: true }) as SagaResult<unknown>;
    const built = pipeline.build(handler);
    const result = await built(createContext());

    expect(isOk(result)).toBe(true);
  });

  it('should wrap a handler and return its result', async () => {
    const pipeline = new SagaPipeline();
    pipeline.use(timeoutMiddleware(100));

    const err: StepError = { type: 'BUSINESS_ERROR', step: 'test', cause: new Error('e'), code: 'E' };
    const handler: StepHandler = async (_ctx: StepContext) => fail(err) as SagaResult<unknown>;
    const built = pipeline.build(handler);
    const result = await built(createContext());

    expect(isFail(result)).toBe(true);
  });
});
