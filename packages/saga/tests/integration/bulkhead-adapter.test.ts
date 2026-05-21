// ---------------------------------------------------------------------------
// @backendkit-labs/saga -- tests/integration/bulkhead-adapter.test.ts
//
// Integration tests for SagaBulkhead.
// ---------------------------------------------------------------------------

import { SagaBulkhead } from '../../src/integration/bulkhead-adapter';

describe('SagaBulkhead', () => {
  describe('execute() with capacity', () => {
    it('should execute immediately when under maxConcurrent', async () => {
      const bh = new SagaBulkhead({ maxConcurrent: 5, maxQueue: 10 });

      const result = await bh.execute(async () => 'done');

      expect(result).toBe('done');
    });

    it('should run multiple tasks in parallel up to maxConcurrent', async () => {
      const bh = new SagaBulkhead({ maxConcurrent: 3, maxQueue: 10 });
      const results: string[] = [];

      const task = async (id: string) => {
        await new Promise((r) => setTimeout(r, 20));
        results.push(id);
        return id;
      };

      await Promise.all([
        bh.execute(() => task('a')),
        bh.execute(() => task('b')),
        bh.execute(() => task('c')),
      ]);

      expect(results).toHaveLength(3);
      expect(results.sort()).toEqual(['a', 'b', 'c']);
    });
  });

  describe('execute() when saturated', () => {
    it('should queue tasks when maxConcurrent is reached', async () => {
      const bh = new SagaBulkhead({ maxConcurrent: 1, maxQueue: 5 });
      let activeCount = 0;
      let maxObservedActive = 0;

      const task = async (id: string) => {
        activeCount++;
        maxObservedActive = Math.max(maxObservedActive, activeCount);
        await new Promise((r) => setTimeout(r, 20));
        activeCount--;
        return id;
      };

      const results = await Promise.all([
        bh.execute(() => task('a')),
        bh.execute(() => task('b')),
        bh.execute(() => task('c')),
      ]);

      expect(results).toEqual(['a', 'b', 'c']);
      // At most 1 concurrent (maxConcurrent = 1)
      expect(maxObservedActive).toBe(1);
    });
  });

  describe('execute() when queue is full', () => {
    it('should throw when queue exceeds maxQueue', async () => {
      const bh = new SagaBulkhead({ maxConcurrent: 1, maxQueue: 1 });

      // Fill the active slot
      const slowTask = bh.execute(async () => {
        await new Promise((r) => setTimeout(r, 100));
        return 'slow';
      });

      // Fill the queue slot
      const queuedTask = bh.execute(async () => 'queued');

      // This should throw because queue is full
      await expect(bh.execute(async () => 'overflow')).rejects.toThrow('Bulkhead queue full');

      // Wait for everything to settle
      await slowTask;
      await queuedTask;
    });
  });

  describe('getMetrics()', () => {
    it('should return correct metrics when idle', () => {
      const bh = new SagaBulkhead({ maxConcurrent: 5, maxQueue: 10 });

      const metrics = bh.getMetrics();

      expect(metrics).toEqual({
        activeCount: 0,
        queueLength: 0,
        maxConcurrent: 5,
        maxQueue: 10,
      });
    });

    it('should reflect active count during execution', async () => {
      const bh = new SagaBulkhead({ maxConcurrent: 2, maxQueue: 5 });

      const taskThatChecksMetrics = async () => {
        const m = bh.getMetrics();
        expect(m.activeCount).toBeGreaterThan(0);
        await new Promise((r) => setTimeout(r, 10));
        return m;
      };

      const [m1, m2] = await Promise.all([
        bh.execute(taskThatChecksMetrics),
        bh.execute(taskThatChecksMetrics),
      ]);

      expect(m1.activeCount).toBeGreaterThan(0);
      expect(m2.activeCount).toBeGreaterThan(0);
    });

    it('should reflect queue length during congestion', async () => {
      const bh = new SagaBulkhead({ maxConcurrent: 1, maxQueue: 5 });

      // Hold one slot
      const hold = bh.execute(async () => {
        await new Promise((r) => setTimeout(r, 50));
        return 'held';
      });

      // Queue one task
      const queued = bh.execute(async () => 'q1');

      // Small delay to ensure queued task is in queue
      await new Promise((r) => setTimeout(r, 5));

      const metricsBefore = bh.getMetrics();
      expect(metricsBefore.queueLength).toBe(1);
      expect(metricsBefore.activeCount).toBe(1);

      await hold;
      await queued;

      const metricsAfter = bh.getMetrics();
      expect(metricsAfter.activeCount).toBe(0);
      expect(metricsAfter.queueLength).toBe(0);
    });
  });
});
