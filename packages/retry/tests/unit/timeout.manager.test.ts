import { describe, it, expect } from 'vitest';
import { TimeoutManager } from '../../src/timeout/timeout.manager.js';
import { AttemptTimeoutError, GlobalTimeoutError } from '../../src/timeout/timeout.errors.js';

describe('TimeoutManager', () => {
  it('runs a task normally when no timeouts are configured', async () => {
    const tm = new TimeoutManager({ globalTimeoutMs: 0, attemptTimeoutMs: 0 });
    await expect(tm.executeWithAttemptTimeout(() => Promise.resolve('ok'))).resolves.toBe('ok');
    tm.dispose();
  });

  it('passes an AbortSignal to the task even without timeouts configured', async () => {
    const tm = new TimeoutManager({ globalTimeoutMs: 0, attemptTimeoutMs: 0 });
    let signal: AbortSignal | undefined;
    await tm.executeWithAttemptTimeout((s) => { signal = s; return Promise.resolve('ok'); });
    expect(signal).toBeInstanceOf(AbortSignal);
    expect(signal?.aborted).toBe(false);
    tm.dispose();
  });

  it('rejects with AttemptTimeoutError and aborts the signal when attemptTimeoutMs elapses', async () => {
    const tm = new TimeoutManager({ globalTimeoutMs: 0, attemptTimeoutMs: 20 });
    let sawAbort = false;
    await expect(
      tm.executeWithAttemptTimeout((signal) => new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => { sawAbort = true; reject(signal.reason as Error); });
      })),
    ).rejects.toBeInstanceOf(AttemptTimeoutError);
    expect(sawAbort).toBe(true);
    tm.dispose();
  });

  it('a task that ignores the signal keeps its own timer running (not force-cancelled)', async () => {
    const tm = new TimeoutManager({ globalTimeoutMs: 0, attemptTimeoutMs: 20 });
    let finished = false;
    const slow = new Promise<void>((resolve) => setTimeout(() => { finished = true; resolve(); }, 60));

    await expect(tm.executeWithAttemptTimeout(() => new Promise((resolve) => setTimeout(() => resolve('late'), 60))))
      .rejects.toBeInstanceOf(AttemptTimeoutError);
    expect(finished).toBe(false); // still running in the background
    await slow;
    expect(finished).toBe(true);
    tm.dispose();
  });

  it('checkGlobalTimeout throws GlobalTimeoutError once the global deadline passes', async () => {
    const tm = new TimeoutManager({ globalTimeoutMs: 20, attemptTimeoutMs: 0 });
    expect(() => tm.checkGlobalTimeout()).not.toThrow();
    await new Promise((r) => setTimeout(r, 40));
    expect(() => tm.checkGlobalTimeout()).toThrow(GlobalTimeoutError);
    tm.dispose();
  });

  it('aborts an in-flight attempt when the global timeout fires mid-attempt', async () => {
    const tm = new TimeoutManager({ globalTimeoutMs: 30, attemptTimeoutMs: 0 });
    let aborted = false;
    await expect(
      tm.executeWithAttemptTimeout((signal) => new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => { aborted = true; reject(signal.reason as Error); });
      })),
    ).rejects.toBeInstanceOf(GlobalTimeoutError);
    expect(aborted).toBe(true);
    tm.dispose();
  });

  it('getRemainingTime returns Infinity when no global timeout is set', () => {
    const tm = new TimeoutManager({ globalTimeoutMs: 0, attemptTimeoutMs: 0 });
    expect(tm.getRemainingTime()).toBe(Infinity);
    tm.dispose();
  });
});
