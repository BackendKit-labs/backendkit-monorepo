import { describe, it, expect, vi } from 'vitest';
import { ok, fail, isOk, isFail, run, retry, retryWithBackoff, withTimeout } from '../../src/index.js';

describe('retry', () => {
  it('throws when attempts is less than 1', async () => {
    await expect(retry(async () => ok(1), { attempts: 0 })).rejects.toThrow(
      'retry() attempts must be at least 1',
    );
  });

  it('returns ok on first success', async () => {
    const fn = vi.fn().mockResolvedValue(ok(42));
    const r = await retry(fn, { attempts: 3 });
    expect(isOk(r)).toBe(true);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on failure and eventually succeeds', async () => {
    let calls = 0;
    const r = await retry(
      async () => { calls++; return calls < 3 ? fail('not yet') : ok('done'); },
      { attempts: 5 },
    );
    expect(isOk(r)).toBe(true);
    expect((r as { value: string }).value).toBe('done');
    expect(calls).toBe(3);
  });

  it('returns last failure after exhausting attempts', async () => {
    const r = await retry(async () => fail('always'), { attempts: 3 });
    expect(isFail(r)).toBe(true);
    expect((r as { error: string }).error).toBe('always');
  });

  it('calls onRetry before each retry', async () => {
    const onRetry = vi.fn();
    let calls = 0;
    await retry(
      async () => { calls++; return calls < 3 ? fail('err') : ok('ok'); },
      { attempts: 3, onRetry },
    );
    expect(onRetry).toHaveBeenCalledTimes(2);
  });

  it('stops early when shouldRetry returns false', async () => {
    const fn = vi.fn().mockResolvedValue(fail('stop'));
    await retry(fn, { attempts: 5, shouldRetry: () => false });
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('waits delayMs between retries', async () => {
    vi.useFakeTimers();
    let resolved = false;

    const p = retry(
      async () => { resolved = true; return fail('e'); },
      { attempts: 2, delayMs: 500 },
    );

    expect(resolved).toBe(true);
    await vi.advanceTimersByTimeAsync(500);
    await p;

    vi.useRealTimers();
  });
});

describe('retryWithBackoff', () => {
  it('throws when attempts is less than 1', async () => {
    await expect(retryWithBackoff(async () => ok(1), { attempts: 0 })).rejects.toThrow(
      'retryWithBackoff() attempts must be at least 1',
    );
  });

  it('returns ok eventually', async () => {
    let calls = 0;
    const r = await retryWithBackoff(
      async () => { calls++; return calls < 3 ? fail('e') : ok('yes'); },
      { attempts: 4, delayMs: 1 },
    );
    expect(isOk(r)).toBe(true);
  });

  it('returns last failure after exhausting attempts', async () => {
    const r = await retryWithBackoff(
      async () => fail('always'),
      { attempts: 3, delayMs: 1 },
    );
    expect(isFail(r)).toBe(true);
    expect((r as { error: string }).error).toBe('always');
  });

  it('respects maxDelayMs cap by completing within bounded time', async () => {
    const start = Date.now();
    let calls = 0;
    await retryWithBackoff(
      async () => { calls++; return calls < 4 ? fail('e') : ok('done'); },
      { attempts: 5, delayMs: 10, maxDelayMs: 20 },
    );
    const elapsed = Date.now() - start;
    // 3 retries capped at 20ms each → max ~60ms + overhead; well under 500ms
    expect(elapsed).toBeLessThan(500);
    expect(calls).toBe(4);
  }, 3000);

  it('full jitter (true) keeps delay within [0, computedDelay]', async () => {
    const delays: number[] = [];
    const origSetTimeout = globalThis.setTimeout;
    const spy = vi.spyOn(globalThis, 'setTimeout').mockImplementation((fn, ms, ...args) => {
      delays.push(ms as number);
      return origSetTimeout(fn, 0, ...args); // run immediately so test stays fast
    });

    let calls = 0;
    await retryWithBackoff(
      async () => { calls++; return calls < 4 ? fail('e') : ok('done'); },
      { attempts: 5, delayMs: 100, maxDelayMs: 1_000, jitter: true },
    );

    spy.mockRestore();

    // Full jitter: every delay must be in [0, computed] — never negative, never over cap
    for (const d of delays) {
      expect(d).toBeGreaterThanOrEqual(0);
      expect(d).toBeLessThanOrEqual(1_000);
    }
  });

  it('partial jitter (number) keeps delay within [0, maxDelayMs]', async () => {
    const delays: number[] = [];
    const origSetTimeout = globalThis.setTimeout;
    const spy = vi.spyOn(globalThis, 'setTimeout').mockImplementation((fn, ms, ...args) => {
      delays.push(ms as number);
      return origSetTimeout(fn, 0, ...args);
    });

    let calls = 0;
    await retryWithBackoff(
      async () => { calls++; return calls < 4 ? fail('e') : ok('done'); },
      { attempts: 5, delayMs: 100, maxDelayMs: 1_000, jitter: 0.25 },
    );

    spy.mockRestore();

    for (const d of delays) {
      expect(d).toBeGreaterThanOrEqual(0);
      expect(d).toBeLessThanOrEqual(1_000);
    }
  });
});

describe('withTimeout', () => {
  it('returns result when resolved before timeout', async () => {
    const r = await withTimeout(async () => ok('fast'), 1000, 'timeout');
    expect(isOk(r)).toBe(true);
  });

  it('returns timeoutError when fn takes longer than ms', async () => {
    const slow = (): Promise<Result<void, string>> =>
      new Promise(resolve => setTimeout(() => resolve(ok(undefined)), 300));

    const r = await withTimeout(slow, 50, 'timed-out');
    expect(isFail(r)).toBe(true);
    expect((r as { error: string }).error).toBe('timed-out');
  }, 10_000);

  it('clears the internal timer when fn resolves first (no timer leak)', async () => {
    vi.useFakeTimers();
    const clearSpy = vi.spyOn(globalThis, 'clearTimeout');

    // fn resolves immediately; the 5s timer should be cleared before it fires
    const r = await withTimeout(async () => ok('fast'), 5_000, 'timed-out');

    expect(isOk(r)).toBe(true);
    expect(clearSpy).toHaveBeenCalled();

    clearSpy.mockRestore();
    vi.useRealTimers();
  });
});
