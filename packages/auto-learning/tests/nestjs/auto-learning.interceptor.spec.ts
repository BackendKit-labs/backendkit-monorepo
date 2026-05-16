import { describe, it, expect, vi, beforeEach } from 'vitest';
import { of, throwError } from 'rxjs';
import { AutoLearningInterceptor } from '../../src/nestjs/auto-learning.interceptor.js';
import { AUTO_LEARN_METADATA } from '../../src/nestjs/auto-learning.constants.js';
import { NoopObservabilityAdapter } from '../../src/core/observability/index.js';
import { ok, fail } from '@backendkit-labs/result';
import { storageError } from '../../src/core/errors.js';
import type { AutoLearningCore } from '../../src/core/auto-learning-core.js';
import type { ExecutionContext, CallHandler } from '@nestjs/common';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeReflector(metadata: Record<string, unknown> | null = {}) {
  return { get: vi.fn(() => metadata) };
}

function makeCore(recordResult = ok<void, any>(undefined)) {
  const observability = new NoopObservabilityAdapter();
  vi.spyOn(observability, 'error');
  return {
    recordPattern: vi.fn(() => recordResult),
    observability,
  } as unknown as AutoLearningCore;
}

function makeHttpContext(opts: {
  method?: string;
  routePath?: string;
  url?: string;
  responseStatus?: number;
  contextType?: string;
} = {}) {
  const {
    method = 'GET',
    routePath = '/api/users',
    url = '/api/users',
    responseStatus = 200,
    contextType = 'http',
  } = opts;

  const req = { method, route: { path: routePath }, url };
  const res = { statusCode: responseStatus };

  return {
    getType: vi.fn(() => contextType),
    getHandler: vi.fn(() => ({})),
    switchToHttp: vi.fn(() => ({
      getRequest: vi.fn(() => req),
      getResponse: vi.fn(() => res),
    })),
  } as unknown as ExecutionContext;
}

function makeHandler(value: unknown = 'ok', error?: Error): CallHandler {
  return {
    handle: vi.fn(() => (error ? throwError(() => error) : of(value))),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AutoLearningInterceptor', () => {
  let core: AutoLearningCore;
  let reflector: ReturnType<typeof makeReflector>;
  let interceptor: AutoLearningInterceptor;

  beforeEach(() => {
    core = makeCore();
    reflector = makeReflector();
    interceptor = new AutoLearningInterceptor(reflector as any, core);
  });

  // ---- non-http context ----

  describe('non-http contexts', () => {
    it('should skip recording and pass through for non-http contexts', () => {
      const context = makeHttpContext({ contextType: 'rpc' });
      const handler = makeHandler();

      interceptor.intercept(context, handler).subscribe();

      expect(core.recordPattern).not.toHaveBeenCalled();
    });

    it('should pass through ws context without recording', () => {
      const context = makeHttpContext({ contextType: 'ws' });
      const handler = makeHandler();

      interceptor.intercept(context, handler).subscribe();

      expect(core.recordPattern).not.toHaveBeenCalled();
    });
  });

  // ---- no @AutoLearn metadata ----

  describe('when @AutoLearn is not set on the handler', () => {
    it('should pass through without recording when metadata is null', () => {
      reflector.get.mockReturnValue(null);
      const context = makeHttpContext();
      const handler = makeHandler();

      interceptor.intercept(context, handler).subscribe();

      expect(core.recordPattern).not.toHaveBeenCalled();
    });
  });

  // ---- successful requests ----

  describe('successful requests', () => {
    it('should record pattern with correct statusCode on success', () => {
      const context = makeHttpContext({ responseStatus: 200 });
      const handler = makeHandler('response body');

      interceptor.intercept(context, handler).subscribe();

      expect(core.recordPattern).toHaveBeenCalledOnce();
      expect(core.recordPattern).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'GET',
          path: '/api/users',
          statusCode: 200,
        }),
      );
    });

    it('should record the route template path (not the raw url)', () => {
      const context = makeHttpContext({ routePath: '/api/users/:id', url: '/api/users/42' });
      const handler = makeHandler();

      interceptor.intercept(context, handler).subscribe();

      expect(core.recordPattern).toHaveBeenCalledWith(
        expect.objectContaining({ path: '/api/users/:id' }),
      );
    });

    it('should record durationMs as a non-negative number', () => {
      const context = makeHttpContext();
      const handler = makeHandler();

      interceptor.intercept(context, handler).subscribe();

      expect(core.recordPattern).toHaveBeenCalledWith(
        expect.objectContaining({ durationMs: expect.any(Number) }),
      );
      const { durationMs } = (core.recordPattern as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(durationMs).toBeGreaterThanOrEqual(0);
    });

    it('should record a timestamp', () => {
      const context = makeHttpContext();
      const handler = makeHandler();

      interceptor.intercept(context, handler).subscribe();

      expect(core.recordPattern).toHaveBeenCalledWith(
        expect.objectContaining({ timestamp: expect.any(Date) }),
      );
    });

    it('should include customMetadata when the option is set', () => {
      const metadata = { userId: 'u1', plan: 'pro' };
      reflector.get.mockReturnValue({
        customMetadata: (_req: unknown) => metadata,
      });
      const context = makeHttpContext();
      const handler = makeHandler();

      interceptor.intercept(context, handler).subscribe();

      expect(core.recordPattern).toHaveBeenCalledWith(
        expect.objectContaining({ metadata }),
      );
    });
  });

  // ---- failed requests (the main bug fix) ----

  describe('failed requests', () => {
    it('should record pattern with status 500 when handler throws a generic Error', () => {
      const context = makeHttpContext();
      const handler = makeHandler(undefined, new Error('something broke'));

      interceptor.intercept(context, handler).subscribe({ error: () => {} });

      expect(core.recordPattern).toHaveBeenCalledOnce();
      expect(core.recordPattern).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 500 }),
      );
    });

    it('should extract statusCode from NestJS HttpException-like errors', () => {
      const httpException = {
        message: 'Unprocessable',
        getStatus: () => 422,
      };
      const context = makeHttpContext();
      const handler = makeHandler(undefined, httpException as unknown as Error);

      interceptor.intercept(context, handler).subscribe({ error: () => {} });

      expect(core.recordPattern).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 422 }),
      );
    });

    it('should extract statusCode from errors with a plain .status property', () => {
      const err = Object.assign(new Error('bad'), { status: 503 });
      const context = makeHttpContext();
      const handler = makeHandler(undefined, err);

      interceptor.intercept(context, handler).subscribe({ error: () => {} });

      expect(core.recordPattern).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 503 }),
      );
    });

    it('should record method and path correctly on error path', () => {
      const context = makeHttpContext({ method: 'POST', routePath: '/api/orders' });
      const handler = makeHandler(undefined, new Error('db timeout'));

      interceptor.intercept(context, handler).subscribe({ error: () => {} });

      expect(core.recordPattern).toHaveBeenCalledWith(
        expect.objectContaining({ method: 'POST', path: '/api/orders' }),
      );
    });

    it('should record durationMs on error path', () => {
      const context = makeHttpContext();
      const handler = makeHandler(undefined, new Error('timeout'));

      interceptor.intercept(context, handler).subscribe({ error: () => {} });

      const { durationMs } = (core.recordPattern as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(durationMs).toBeGreaterThanOrEqual(0);
    });
  });

  // ---- recordPattern failure ----

  describe('when recordPattern returns a failure Result', () => {
    it('should log the error via observability and not rethrow', () => {
      core = makeCore(fail(storageError('disk full')));
      interceptor = new AutoLearningInterceptor(reflector as any, core);
      const context = makeHttpContext();
      const handler = makeHandler();

      let emittedError: unknown;
      interceptor.intercept(context, handler).subscribe({
        error: (e) => { emittedError = e; },
      });

      expect(core.observability.error).toHaveBeenCalledWith(
        'Failed to record pattern',
        expect.objectContaining({ error: expect.objectContaining({ tag: 'STORAGE_ERROR' }) }),
      );
      expect(emittedError).toBeUndefined();
    });
  });
});
