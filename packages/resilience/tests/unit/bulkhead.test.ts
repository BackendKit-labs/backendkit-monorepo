import { describe, it, expect, beforeEach } from 'vitest';
import {
  Bulkhead,
  BulkheadRejectedError,
  BulkheadTimeoutError,
} from '../../src/bulkhead/bulkhead.js';
import type { BulkheadConfig } from '../../src/bulkhead/bulkhead.js';

const makeConfig = (overrides: Partial<BulkheadConfig> = {}): BulkheadConfig => ({
  name: 'test',
  maxConcurrentCalls: 2,
  maxQueueSize: 2,
  queueTimeoutMs: 1000,
  rejectWhenFull: true,
  ...overrides,
});

describe('Bulkhead', () => {
  let bh: Bulkhead;

  beforeEach(() => {
    bh = new Bulkhead(makeConfig());
  });

  it('executes a task and returns its value', async () => {
    const result = await bh.execute(async () => 42);
    expect(result).toBe(42);
  });

  it('propagates task errors and counts them as failed', async () => {
    await expect(
      bh.execute(async () => {
        throw new Error('task error');
      }),
    ).rejects.toThrow('task error');

    expect(bh.getMetrics().failedCalls).toBe(1);
  });

  it('runs tasks concurrently up to maxConcurrentCalls', async () => {
    bh = new Bulkhead(makeConfig({ maxConcurrentCalls: 2 }));
    let concurrent = 0;
    let maxSeen = 0;

    const task = async () => {
      concurrent++;
      maxSeen = Math.max(maxSeen, concurrent);
      await new Promise(r => setTimeout(r, 20));
      concurrent--;
    };

    await Promise.all([bh.execute(task), bh.execute(task)]);
    expect(maxSeen).toBe(2);
  });

  it('queues tasks when at max concurrency and processes them in order', async () => {
    bh = new Bulkhead(makeConfig({ maxConcurrentCalls: 1, maxQueueSize: 2 }));
    const order: number[] = [];

    const task = (n: number) => async () => {
      await new Promise(r => setTimeout(r, 20));
      order.push(n);
    };

    await Promise.all([bh.execute(task(1)), bh.execute(task(2))]);
    expect(order).toEqual([1, 2]);
  });

  it('throws BulkheadRejectedError when queue is full and rejectWhenFull=true', async () => {
    bh = new Bulkhead(makeConfig({ maxConcurrentCalls: 1, maxQueueSize: 1 }));
    const slow = () => new Promise<void>(r => setTimeout(r, 200));

    bh.execute(slow);
    bh.execute(slow);

    await expect(bh.execute(async () => {})).rejects.toThrow(BulkheadRejectedError);
  });

  it('throws BulkheadTimeoutError when task waits too long in queue', async () => {
    bh = new Bulkhead(makeConfig({ maxConcurrentCalls: 1, maxQueueSize: 1, queueTimeoutMs: 50 }));
    const slow = () => new Promise<void>(r => setTimeout(r, 300));

    bh.execute(slow);

    await expect(bh.execute(async () => {})).rejects.toThrow(BulkheadTimeoutError);
  }, 2000);

  it('tracks totalCalls, successfulCalls, failedCalls in metrics', async () => {
    await bh.execute(async () => 'ok');
    await expect(bh.execute(async () => { throw new Error(); })).rejects.toThrow();

    const m = bh.getMetrics();
    expect(m.totalCalls).toBe(2);
    expect(m.successfulCalls).toBe(1);
    expect(m.failedCalls).toBe(1);
    expect(m.rejectedCalls).toBe(0);
  });

  it('tracks rejectedCalls when queue is full', async () => {
    bh = new Bulkhead(makeConfig({ maxConcurrentCalls: 1, maxQueueSize: 0 }));
    const slow = () => new Promise<void>(r => setTimeout(r, 100));

    bh.execute(slow);
    await expect(bh.execute(async () => {})).rejects.toThrow(BulkheadRejectedError);

    expect(bh.getMetrics().rejectedCalls).toBe(1);
  });

  it('resetMetrics clears all counters', async () => {
    await bh.execute(async () => 'ok');
    bh.resetMetrics();

    const m = bh.getMetrics();
    expect(m.totalCalls).toBe(0);
    expect(m.successfulCalls).toBe(0);
    expect(m.averageDurationMs).toBe(0);
  });

  it('canAccept returns true when below capacity', () => {
    expect(bh.canAccept()).toBe(true);
  });

  it('returns correct name and limits in metrics', () => {
    const m = bh.getMetrics();
    expect(m.name).toBe('test');
    expect(m.maxConcurrentCalls).toBe(2);
    expect(m.maxQueueSize).toBe(2);
  });
});
