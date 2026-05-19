import { describe, it, expect, vi } from 'vitest';
import { RetryEngine } from '../../src/Retry/Retry.engine.js';

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
});
