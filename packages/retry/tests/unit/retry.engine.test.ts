import { describe, it, expect, vi } from 'vitest';
import { RetryEngine } from '../../src/retry/retry.engine.js';

function makeEngine(overrides?: ConstructorParameters<typeof RetryEngine>[0]): RetryEngine {
  return new RetryEngine({ name: 'test', ...overrides });
}

describe('RetryEngine', () => {
  it('execute() returns ok on successful task', async () => {
    const engine = makeEngine();
    const result = await engine.execute(() => Promise.resolve(99), { maxAttempts: 1, backoff: { type: 'fixed', baseDelay: 0 } });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe(99);
  });

  it('retries on transient HTTP errors using maxAttempts', async () => {
    let calls = 0;
    const engine = makeEngine();
    const result = await engine.execute(
      () => {
        calls++;
        if (calls < 3) return Promise.reject(Object.assign(new Error('down'), { status: 503 }));
        return Promise.resolve('up');
      },
      { maxAttempts: 3, backoff: { type: 'fixed', baseDelay: 0 } },
    );
    expect(result.ok).toBe(true);
    expect(calls).toBe(3);
  });

  it('returns fail after all attempts exhausted', async () => {
    const engine = makeEngine();
    const result = await engine.execute(
      () => Promise.reject(Object.assign(new Error('down'), { status: 503 })),
      { maxAttempts: 2, backoff: { type: 'fixed', baseDelay: 0 } },
    );
    expect(result.ok).toBe(false);
  });

  it('increments metrics on success', async () => {
    const engine = makeEngine();
    await engine.execute(() => Promise.resolve('x'), { maxAttempts: 1, backoff: { type: 'fixed', baseDelay: 0 } });
    const m = engine.getMetrics();
    expect(m.totalAttempts).toBe(1);
    expect(m.totalSuccesses).toBe(1);
    expect(m.totalFailures).toBe(0);
  });

  it('increments metrics on failure', async () => {
    const engine = makeEngine();
    await engine.execute(
      () => Promise.reject(Object.assign(new Error('err'), { status: 503 })),
      { maxAttempts: 2, backoff: { type: 'fixed', baseDelay: 0 } },
    );
    const m = engine.getMetrics();
    expect(m.totalAttempts).toBe(1);
    expect(m.totalFailures).toBe(1);
    expect(m.totalSuccesses).toBe(0);
  });

  it('uses defaultConfig when no per-call options provided', async () => {
    const engine = makeEngine({
      name: 'configured',
      defaultConfig: { maxAttempts: 1, backoff: { type: 'fixed', baseDelay: 0 } },
    });
    let calls = 0;
    await engine.execute(() => {
      calls++;
      return Promise.reject(Object.assign(new Error('err'), { status: 503 }));
    });
    expect(calls).toBe(1); // maxAttempts: 1 from defaultConfig
  });

  it('resetMetrics clears all counters', async () => {
    const engine = makeEngine();
    await engine.execute(() => Promise.resolve('x'), { maxAttempts: 1, backoff: { type: 'fixed', baseDelay: 0 } });
    engine.resetMetrics();
    const m = engine.getMetrics();
    expect(m.totalAttempts).toBe(0);
    expect(m.totalSuccesses).toBe(0);
  });

  it('executes with context passes correlationId', async () => {
    const hooks = { onRetrySuccess: vi.fn() };
    const engine = makeEngine({ defaultConfig: { hooks, backoff: { type: 'fixed', baseDelay: 0 } } });
    const result = await engine.executeWithContext(
      () => Promise.resolve('ok'),
      { correlationId: 'req-123' },
    );
    expect(result.ok).toBe(true);
  });

  it('uses exponential backoff strategy when configured', async () => {
    const engine = makeEngine();
    let calls = 0;
    const result = await engine.execute(
      () => {
        calls++;
        if (calls < 2) return Promise.reject(Object.assign(new Error('err'), { status: 503 }));
        return Promise.resolve('ok');
      },
      { maxAttempts: 3, backoff: { type: 'exponential', baseDelay: 0 } },
    );
    expect(result.ok).toBe(true);
    expect(calls).toBe(2);
  });

  describe('classifier-driven retry/abort', () => {
    it('a custom classifier that marks an error transient makes it retry', async () => {
      const engine = makeEngine();
      let calls = 0;
      const result = await engine.execute(
        () => {
          calls++;
          if (calls < 2) return Promise.reject(new Error('weird failure'));
          return Promise.resolve('ok');
        },
        {
          maxAttempts: 3,
          backoff: { type: 'fixed', baseDelay: 0 },
          // Plain errors normally classify as 'unknown' -> permanent -> no retry.
          classifiers: [{ name: 'weird', priority: 1, match: (e) => e.message === 'weird failure', classification: 'transient' }],
        },
      );
      expect(result.ok).toBe(true);
      expect(calls).toBe(2);
    });

    it('a custom classifier that marks an error permanent aborts immediately', async () => {
      const engine = makeEngine();
      let calls = 0;
      const result = await engine.execute(
        () => { calls++; return Promise.reject(Object.assign(new Error('down'), { status: 503 })); },
        {
          maxAttempts: 3,
          backoff: { type: 'fixed', baseDelay: 0 },
          // 503 normally retries -- force it to abort instead.
          classifiers: [{ name: 'force-permanent', priority: 1, match: () => true, classification: 'permanent' }],
        },
      );
      expect(result.ok).toBe(false);
      expect(calls).toBe(1);
    });

    it('explicit retryIf/abortIf still override classifier-driven defaults', async () => {
      const engine = makeEngine();
      let calls = 0;
      // A plain Error classifies as 'unknown' -> permanent -> aborts by default.
      // abortIf is checked before retryIf in the executor, so both must be
      // overridden together to force a retry past the default classification.
      const result = await engine.execute(
        () => { calls++; return Promise.reject(new Error('plain')); },
        { maxAttempts: 2, backoff: { type: 'fixed', baseDelay: 0 }, retryIf: () => true, abortIf: () => false },
      );
      expect(result.ok).toBe(false);
      expect(calls).toBe(2); // retried despite classifying as permanent by default
    });
  });

  describe('budget persistence across calls', () => {
    it('shares one sliding-window budget across execute() calls on the same engine', async () => {
      const engine = makeEngine();
      const opts = {
        maxAttempts: 3,
        backoff: { type: 'fixed' as const, baseDelay: 0 },
        budget: { windowMs: 60_000, maxRetryRatio: 0.1, minRequestCount: 5 },
      };
      const fail = () => Promise.reject(Object.assign(new Error('down'), { status: 503 }));

      let budgetExhaustedCount = 0;
      for (let i = 0; i < 20; i++) {
        const result = await engine.execute(fail, opts);
        if (!result.ok && result.error.metadata.budgetExhausted) budgetExhaustedCount++;
      }
      expect(budgetExhaustedCount).toBeGreaterThan(0);
      expect(engine.getMetrics().totalBudgetExhausted).toBeGreaterThan(0);
    });

    it('does not share a budget between two different engines', async () => {
      const engineA = makeEngine({ name: 'a' });
      const engineB = makeEngine({ name: 'b' });
      const opts = {
        maxAttempts: 1,
        backoff: { type: 'fixed' as const, baseDelay: 0 },
        budget: { windowMs: 60_000, maxRetryRatio: 0.1, minRequestCount: 5 },
      };
      const fail = () => Promise.reject(Object.assign(new Error('down'), { status: 503 }));

      for (let i = 0; i < 10; i++) await engineA.execute(fail, opts);
      const resultB = await engineB.execute(fail, opts);
      expect(resultB.ok).toBe(false);
      if (!resultB.ok) expect(resultB.error.metadata.budgetExhausted).toBeFalsy();
    });
  });

  describe('idempotency persistence across calls', () => {
    it('caches a result across execute() calls with the same idempotency key', async () => {
      const engine = makeEngine();
      let calls = 0;
      const opts = { maxAttempts: 1, backoff: { type: 'fixed' as const, baseDelay: 0 }, idempotency: { enabled: true, key: 'charge-1' } };
      const task = () => { calls++; return Promise.resolve({ chargeId: calls }); };

      const r1 = await engine.execute(task, opts);
      const r2 = await engine.execute(task, opts);
      expect(r1.ok && r2.ok).toBe(true);
      if (r1.ok && r2.ok) expect(r1.value).toEqual(r2.value);
      expect(calls).toBe(1);
    });

    it('does not share the idempotency cache between two different engines', async () => {
      const engineA = makeEngine({ name: 'idem-a' });
      const engineB = makeEngine({ name: 'idem-b' });
      let calls = 0;
      const opts = { maxAttempts: 1, backoff: { type: 'fixed' as const, baseDelay: 0 }, idempotency: { enabled: true, key: 'k' } };
      const task = () => { calls++; return Promise.resolve(calls); };

      await engineA.execute(task, opts);
      await engineB.execute(task, opts);
      expect(calls).toBe(2);
    });
  });
});
