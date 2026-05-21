// ---------------------------------------------------------------------------
// @backendkit-labs/saga -- src/integration/bulkhead-adapter.ts
//
// Adapter for @backendkit-labs/bulkhead.
// Limits concurrent step executions across a saga or globally.
//
// Optional peer dependency.
// ---------------------------------------------------------------------------

export interface BulkheadConfig {
  maxConcurrent: number;
  maxQueue: number;
}

export interface BulkheadMetrics {
  activeCount: number;
  queueLength: number;
  maxConcurrent: number;
  maxQueue: number;
}

/**
 * SagaBulkhead limits concurrent executions for steps marked as parallel
 * or for sagas with global concurrency limits.
 *
 * Usage:
 *   const bh = new SagaBulkhead({ maxConcurrent: 5, maxQueue: 10 });
 *   const result = await bh.execute(() => stepRunner.execute(step, ctx));
 */
export class SagaBulkhead {
  private active = 0;
  private readonly queue: Array<{
    resolve: (value: unknown) => void;
    reject: (reason: unknown) => void;
    fn: () => Promise<unknown>;
  }> = [];

  constructor(private readonly config: BulkheadConfig) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.active < this.config.maxConcurrent) {
      return this.run(fn);
    }

    if (this.queue.length >= this.config.maxQueue) {
      throw new Error('Bulkhead queue full');
    }

    return new Promise<T>((resolve, reject) => {
      this.queue.push({
        resolve: resolve as (value: unknown) => void,
        reject,
        fn: fn as () => Promise<unknown>,
      });
    });
  }

  getMetrics(): BulkheadMetrics {
    return {
      activeCount: this.active,
      queueLength: this.queue.length,
      maxConcurrent: this.config.maxConcurrent,
      maxQueue: this.config.maxQueue,
    };
  }

  private async run<T>(fn: () => Promise<T>): Promise<T> {
    this.active++;
    try {
      const result = await fn();
      return result;
    } finally {
      this.active--;
      this.processQueue();
    }
  }

  private processQueue(): void {
    if (this.queue.length === 0 || this.active >= this.config.maxConcurrent) {
      return;
    }

    const next = this.queue.shift();
    if (next !== undefined) {
      this.run(next.fn).then(next.resolve, next.reject);
    }
  }
}
