import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RetryExecutor, type ExecutorDependencies } from '../../src/retry/retry.executor.js';
import { HookRunner } from '../../src/retry/retry.hooks.js';
import { DefaultErrorClassifier } from '../../src/conditions/error.classifier.js';
import { TimeoutManager } from '../../src/timeout/timeout.manager.js';
import { FixedBackoff } from '../../src/backoff/fixed.backoff.js';
import { defaultRetryCondition, defaultAbortCondition } from '../../src/conditions/http.conditions.js';
import type { RetryConfig } from '../../src/retry/types.js';

function makeDeps(overrides?: Partial<ExecutorDependencies>): ExecutorDependencies {
  return {
    backoff: new FixedBackoff({ baseDelay: 0 }),
    classifier: new DefaultErrorClassifier(),
    timeoutManager: new TimeoutManager({ globalTimeoutMs: 0, attemptTimeoutMs: 0 }),
    RetryCondition: defaultRetryCondition,
    abortCondition: defaultAbortCondition,
    hooks: new HookRunner({}),
    ...overrides,
  };
}

function makeConfig(overrides?: Partial<RetryConfig>): RetryConfig {
  return {
    maxAttempts: 3,
    backoff: { type: 'fixed', baseDelay: 0 },
    ...overrides,
  };
}

describe('RetryExecutor', () => {
  describe('success path', () => {
    it('returns ok on first attempt', async () => {
      const executor = new RetryExecutor(makeDeps(), makeConfig());
      const result = await executor.run(() => Promise.resolve(42));
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value).toBe(42);
    });

    it('returns ok on second attempt after transient failure', async () => {
      let calls = 0;
      const task = () => {
        calls++;
        if (calls === 1) {
          const err = Object.assign(new Error('Service unavailable'), { status: 503 });
          return Promise.reject(err);
        }
        return Promise.resolve('data');
      };

      const executor = new RetryExecutor(makeDeps(), makeConfig({ maxAttempts: 3 }));
      const result = await executor.run(task);
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value).toBe('data');
      expect(calls).toBe(2);
    });

    it('fires onRetrySuccess hook only when attempt > 1', async () => {
      const onRetrySuccess = vi.fn();
      const hooks = new HookRunner({ onRetrySuccess });
      let calls = 0;
      const task = () => {
        calls++;
        if (calls < 2) return Promise.reject(Object.assign(new Error('err'), { status: 503 }));
        return Promise.resolve('ok');
      };
      const executor = new RetryExecutor(makeDeps({ hooks }), makeConfig());
      const result = await executor.run(task);
      expect(result.ok).toBe(true);
      expect(onRetrySuccess).toHaveBeenCalledOnce();
    });

    it('does NOT fire onRetrySuccess when task succeeds on first attempt', async () => {
      const onRetrySuccess = vi.fn();
      const hooks = new HookRunner({ onRetrySuccess });
      const executor = new RetryExecutor(makeDeps({ hooks }), makeConfig());
      await executor.run(() => Promise.resolve('ok'));
      expect(onRetrySuccess).not.toHaveBeenCalled();
    });
  });

  describe('failure path', () => {
    it('returns fail after all attempts exhausted', async () => {
      const task = () => Promise.reject(Object.assign(new Error('down'), { status: 503 }));
      const executor = new RetryExecutor(makeDeps(), makeConfig({ maxAttempts: 3 }));
      const result = await executor.run(task);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.metadata.attempts).toBe(3);
        expect(result.error.type).toBe('http');
        expect(result.error.status).toBe(503);
      }
    });

    it('fires onExhausted hook when all attempts fail', async () => {
      const onExhausted = vi.fn();
      const hooks = new HookRunner({ onExhausted });
      const task = () => Promise.reject(Object.assign(new Error('down'), { status: 503 }));
      const executor = new RetryExecutor(makeDeps({ hooks }), makeConfig({ maxAttempts: 2 }));
      await executor.run(task);
      expect(onExhausted).toHaveBeenCalledOnce();
    });

    it('returns fail immediately on abort condition (no retry)', async () => {
      let calls = 0;
      const task = () => { calls++; return Promise.reject(Object.assign(new Error('bad'), { status: 400 })); };
      const executor = new RetryExecutor(makeDeps(), makeConfig({ maxAttempts: 5 }));
      const result = await executor.run(task);
      expect(result.ok).toBe(false);
      expect(calls).toBe(1); // aborted immediately on 400
    });

    it('does not retry when retryIf returns false', async () => {
      let calls = 0;
      const task = () => { calls++; return Promise.reject(new Error('custom')); };
      const deps = makeDeps({
        RetryCondition: { shouldRetry: () => false },
      });
      const executor = new RetryExecutor(deps, makeConfig({ maxAttempts: 5 }));
      await executor.run(task);
      expect(calls).toBe(1);
    });

    it('invokes fallback on exhaustion and returns ok', async () => {
      const task = () => Promise.reject(Object.assign(new Error('down'), { status: 503 }));
      const fallback = vi.fn().mockResolvedValue('fallback-value');
      const executor = new RetryExecutor(
        makeDeps(),
        makeConfig({ maxAttempts: 2, fallback }),
      );
      const result = await executor.run(task);
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value).toBe('fallback-value');
      expect(fallback).toHaveBeenCalledOnce();
    });
  });

  describe('error classification', () => {
    it('classifies HTTP errors by status code', async () => {
      const task = () => Promise.reject(Object.assign(new Error('not found'), { status: 404 }));
      const executor = new RetryExecutor(makeDeps(), makeConfig({ maxAttempts: 3 }));
      const result = await executor.run(task);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('http');
        expect(result.error.status).toBe(404);
        expect(result.error.metadata.attempts).toBe(1); // 404 is abort → no retries
      }
    });

    it('classifies network errors by error code', async () => {
      const networkErr = Object.assign(new Error('connection refused'), { code: 'ECONNREFUSED' });
      let calls = 0;
      const task = () => { calls++; return Promise.reject(networkErr); };
      const executor = new RetryExecutor(makeDeps(), makeConfig({ maxAttempts: 3 }));
      const result = await executor.run(task);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('network');
        expect(calls).toBe(3); // network errors are retried
      }
    });

    it('classifies axios-style errors via response.status', async () => {
      const err = { message: 'Request failed', response: { status: 502 } };
      const task = () => Promise.reject(err);
      const executor = new RetryExecutor(makeDeps(), makeConfig({ maxAttempts: 2 }));
      const result = await executor.run(task);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.status).toBe(502);
    });
  });

  describe('hooks', () => {
    it('fires beforeRetry and afterRetry for each retry', async () => {
      const beforeRetry = vi.fn();
      const afterRetry = vi.fn();
      const hooks = new HookRunner({ beforeRetry, afterRetry });
      let calls = 0;
      const task = () => {
        calls++;
        if (calls < 3) return Promise.reject(Object.assign(new Error('err'), { status: 503 }));
        return Promise.resolve('ok');
      };
      const executor = new RetryExecutor(makeDeps({ hooks }), makeConfig({ maxAttempts: 3 }));
      await executor.run(task);
      expect(beforeRetry).toHaveBeenCalledTimes(2);
      expect(afterRetry).toHaveBeenCalledTimes(2);
    });
  });

  describe('circuit breaker', () => {
    it('returns fail when circuit breaker is open and maxAttempts reached', async () => {
      const circuitBreaker = {
        canAttempt: vi.fn().mockReturnValue(false),
        onSuccess: vi.fn(),
        onError: vi.fn(),
        getState: vi.fn().mockReturnValue('open'),
      };
      const executor = new RetryExecutor(
        makeDeps({ circuitBreaker }),
        makeConfig({ maxAttempts: 1 }),
      );
      const result = await executor.run(() => Promise.resolve('x'));
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.type).toBe('circuit-open');
    });

    it('calls circuitBreaker.onSuccess after task succeeds', async () => {
      const circuitBreaker = {
        canAttempt: vi.fn().mockReturnValue(true),
        onSuccess: vi.fn(),
        onError: vi.fn(),
        getState: vi.fn().mockReturnValue('closed'),
      };
      const executor = new RetryExecutor(makeDeps({ circuitBreaker }), makeConfig());
      await executor.run(() => Promise.resolve('ok'));
      expect(circuitBreaker.onSuccess).toHaveBeenCalledOnce();
    });
  });

  describe('budget', () => {
    it('stops retries when budget is exhausted', async () => {
      const budget = {
        tryConsume: vi.fn().mockReturnValue(false),
        recordSuccess: vi.fn(),
        recordFailure: vi.fn(),
        recordCall: vi.fn(),
        getMetrics: vi.fn(),
      };
      let calls = 0;
      const task = () => { calls++; return Promise.reject(Object.assign(new Error('err'), { status: 503 })); };
      const executor = new RetryExecutor(makeDeps({ budget }), makeConfig({ maxAttempts: 5 }));
      const result = await executor.run(task);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.metadata.budgetExhausted).toBe(true);
      expect(calls).toBe(1); // stopped after first failure
    });
  });

  describe('dynamic delay', () => {
    it('uses dynamicDelay when provided instead of backoff', async () => {
      const dynamicDelay = vi.fn().mockReturnValue(0);
      const backoffSpy = vi.spyOn(makeDeps().backoff, 'nextDelay');
      let calls = 0;
      const task = () => {
        calls++;
        if (calls < 2) return Promise.reject(Object.assign(new Error('err'), { status: 503 }));
        return Promise.resolve('ok');
      };
      const deps = makeDeps();
      vi.spyOn(deps.backoff, 'nextDelay');
      const executor = new RetryExecutor(deps, makeConfig({ dynamicDelay }));
      await executor.run(task);
      expect(dynamicDelay).toHaveBeenCalledOnce();
      expect(backoffSpy).not.toHaveBeenCalled();
    });
  });

  describe('error normalization', () => {
    it('reads status from a NestJS-style getStatus() method', async () => {
      const err = { message: 'unavailable', getStatus: () => 503 };
      const executor = new RetryExecutor(makeDeps(), makeConfig({ maxAttempts: 1 }));
      const result = await executor.run(() => Promise.reject(err));
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe('http');
        expect(result.error.status).toBe(503);
      }
    });

    it('classifies a native fetch() failure via error.cause.code', async () => {
      // fetch() wraps the real network error in TypeError('fetch failed', { cause }).
      const err = Object.assign(new TypeError('fetch failed'), {
        cause: Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' }),
      });
      const executor = new RetryExecutor(makeDeps(), makeConfig({ maxAttempts: 1 }));
      const result = await executor.run(() => Promise.reject(err));
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.type).toBe('network');
    });

    it('classifies axios-style ERR_NETWORK (no response) as a network error', async () => {
      const err = Object.assign(new Error('Network Error'), { isAxiosError: true, code: 'ERR_NETWORK' });
      const executor = new RetryExecutor(makeDeps(), makeConfig({ maxAttempts: 1 }));
      const result = await executor.run(() => Promise.reject(err));
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.type).toBe('network');
    });
  });

  describe('circuit breaker classification', () => {
    it('does NOT notify the circuit breaker of a permanent (business) failure', async () => {
      const circuitBreaker = {
        canAttempt: vi.fn().mockReturnValue(true),
        onSuccess: vi.fn(),
        onError: vi.fn(),
        getState: vi.fn().mockReturnValue('closed'),
      };
      const err = Object.assign(new Error('not found'), { status: 404 });
      const executor = new RetryExecutor(makeDeps({ circuitBreaker }), makeConfig({ maxAttempts: 1 }));
      await executor.run(() => Promise.reject(err));
      expect(circuitBreaker.onError).not.toHaveBeenCalled();
    });

    it('notifies the circuit breaker of a transient (infra) failure', async () => {
      const circuitBreaker = {
        canAttempt: vi.fn().mockReturnValue(true),
        onSuccess: vi.fn(),
        onError: vi.fn(),
        getState: vi.fn().mockReturnValue('closed'),
      };
      const err = Object.assign(new Error('down'), { status: 503 });
      const executor = new RetryExecutor(makeDeps({ circuitBreaker }), makeConfig({ maxAttempts: 1 }));
      await executor.run(() => Promise.reject(err));
      expect(circuitBreaker.onError).toHaveBeenCalledOnce();
    });

    it('reports the duration of the successful attempt, not the cumulative retry time', async () => {
      let reported = -1;
      const circuitBreaker = {
        canAttempt: () => true,
        onSuccess: (ms: number) => { reported = ms; },
        onError: () => {},
        getState: () => 'closed',
      };
      let calls = 0;
      const deps = makeDeps({
        circuitBreaker,
        backoff: new FixedBackoff({ baseDelay: 100 }),
      });
      const task = () => {
        calls++;
        if (calls < 2) return Promise.reject(Object.assign(new Error('err'), { status: 503 }));
        return Promise.resolve('ok');
      };
      const executor = new RetryExecutor(deps, makeConfig({ maxAttempts: 2 }));
      await executor.run(task);
      // The backoff delay (100ms) must not leak into the reported duration
      // of the (near-instant) successful attempt.
      expect(reported).toBeLessThan(50);
    });
  });

  describe('idempotency', () => {
    it('round-trips a task that resolves undefined', async () => {
      const store = new Map<string, string>();
      const idempotency = {
        getResult: async (key: string) => store.get(key) ?? null,
        storeResult: async (key: string, value: string) => { store.set(key, value); },
      };
      let calls = 0;
      const task = () => { calls++; return Promise.resolve(undefined); };
      const executor = new RetryExecutor(
        makeDeps({ idempotency: idempotency as ExecutorDependencies['idempotency'] }),
        makeConfig({ idempotency: { key: 'k1' } }),
      );
      const r1 = await executor.run(task);
      const r2 = await executor.run(task);
      expect(r1.ok).toBe(true);
      expect(r2.ok).toBe(true);
      if (r1.ok) expect(r1.value).toBeUndefined();
      if (r2.ok) expect(r2.value).toBeUndefined();
      expect(calls).toBe(1); // second call served from cache
    });
  });

  describe('AbortSignal', () => {
    it('passes a live AbortSignal to the task', async () => {
      let receivedSignal: AbortSignal | undefined;
      const executor = new RetryExecutor(makeDeps(), makeConfig({ maxAttempts: 1 }));
      await executor.run((signal) => {
        receivedSignal = signal;
        return Promise.resolve('ok');
      });
      expect(receivedSignal).toBeInstanceOf(AbortSignal);
      expect(receivedSignal?.aborted).toBe(false);
    });

    it('aborts the signal when attemptTimeoutMs elapses, and a cooperative task stops early', async () => {
      const deps = makeDeps({ timeoutManager: new TimeoutManager({ globalTimeoutMs: 0, attemptTimeoutMs: 30 }) });
      const executor = new RetryExecutor(deps, makeConfig({ maxAttempts: 1 }));
      let aborted = false;
      const start = Date.now();
      const result = await executor.run((signal) => new Promise((resolve, reject) => {
        const t = setTimeout(() => resolve('too-late'), 300);
        signal.addEventListener('abort', () => { aborted = true; clearTimeout(t); reject(signal.reason as Error); });
      }));
      expect(aborted).toBe(true);
      expect(Date.now() - start).toBeLessThan(200);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.type).toBe('timeout');
    });
  });
});
