export interface BulkheadConfig {
  /** Max number of concurrent executions */
  maxConcurrentCalls: number;
  /** Max queue size for waiting tasks */
  maxQueueSize: number;
  /** Max time a task can wait in queue (ms) */
  queueTimeoutMs: number;
  /** Reject immediately when queue is full; if false, retries with backoff */
  rejectWhenFull: boolean;
  /** Identifier used in metrics and error messages */
  name: string;
}

export interface BulkheadMetrics {
  name: string;
  activeCalls: number;
  queuedCalls: number;
  maxConcurrentCalls: number;
  maxQueueSize: number;
  totalCalls: number;
  successfulCalls: number;
  failedCalls: number;
  rejectedCalls: number;
  timedOutCalls: number;
  averageDurationMs: number;
}

export class BulkheadRejectedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BulkheadRejectedError';
  }
}

export class BulkheadTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BulkheadTimeoutError';
  }
}

export class Bulkhead {
  private activeCalls = 0;
  private nextId = 0;
  private queue: Array<{
    id: number;
    task: () => Promise<unknown>;
    resolve: (value: unknown) => void;
    reject: (reason: unknown) => void;
    queuedAt: number;
  }> = [];

  private totalCalls = 0;
  private successfulCalls = 0;
  private failedCalls = 0;
  private rejectedCalls = 0;
  private timedOutCalls = 0;
  private totalDurationMs = 0;

  constructor(private config: BulkheadConfig) {}

  updateConfig(partial: Partial<Omit<BulkheadConfig, 'name'>>): void {
    this.config = { ...this.config, ...partial };
  }

  async execute<T>(task: () => Promise<T>): Promise<T> {
    const startTime = Date.now();
    this.totalCalls++;

    if (this.activeCalls < this.config.maxConcurrentCalls) {
      return this.runTask(task, startTime);
    }

    if (this.queue.length >= this.config.maxQueueSize) {
      if (this.config.rejectWhenFull) {
        this.rejectedCalls++;
        throw new BulkheadRejectedError(
          `Bulkhead '${this.config.name}' is full. ` +
            `Active: ${this.activeCalls}, Queue: ${this.queue.length}, Max: ${this.config.maxConcurrentCalls}`,
        );
      }
      return this.waitAndRetry(task, startTime);
    }

    const entryId = this.nextId++;
    return new Promise<T>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        const index = this.queue.findIndex(item => item.id === entryId);
        if (index !== -1) this.queue.splice(index, 1);
        this.timedOutCalls++;
        reject(
          new BulkheadTimeoutError(
            `Bulkhead '${this.config.name}' timeout after ${this.config.queueTimeoutMs}ms`,
          ),
        );
      }, this.config.queueTimeoutMs);

      this.queue.push({
        id: entryId,
        task: task as () => Promise<unknown>,
        resolve: value => {
          clearTimeout(timeoutId);
          resolve(value as T);
        },
        reject: reason => {
          clearTimeout(timeoutId);
          reject(reason);
        },
        queuedAt: startTime,
      });

      this.processQueue();
    });
  }

  private async runTask<T>(task: () => Promise<T>, startTime: number): Promise<T> {
    this.activeCalls++;
    try {
      const result = await task();
      this.successfulCalls++;
      this.totalDurationMs += Date.now() - startTime;
      return result;
    } catch (error) {
      this.failedCalls++;
      throw error;
    } finally {
      this.activeCalls--;
      this.processQueue();
    }
  }

  private async waitAndRetry<T>(task: () => Promise<T>, startTime: number): Promise<T> {
    const maxRetries = 3;
    const baseDelay = 100;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      if (this.activeCalls < this.config.maxConcurrentCalls) {
        return this.runTask(task, startTime);
      }
      await new Promise(resolve => setTimeout(resolve, baseDelay * Math.pow(2, attempt - 1)));
    }

    this.rejectedCalls++;
    throw new BulkheadRejectedError(
      `Bulkhead '${this.config.name}' rejected after ${maxRetries} retries`,
    );
  }

  private processQueue(): void {
    while (this.activeCalls < this.config.maxConcurrentCalls && this.queue.length > 0) {
      const next = this.queue.shift();
      if (!next) break;

      const waitTime = Date.now() - next.queuedAt;
      if (waitTime > this.config.queueTimeoutMs) {
        next.reject(new BulkheadTimeoutError(`Task timed out after ${waitTime}ms in queue`));
        this.timedOutCalls++;
        continue;
      }

      this.activeCalls++;
      next
        .task()
        .then(result => {
          this.successfulCalls++;
          next.resolve(result);
        })
        .catch(error => {
          this.failedCalls++;
          next.reject(error);
        })
        .finally(() => {
          this.activeCalls--;
          this.processQueue();
        });
    }
  }

  getMetrics(): BulkheadMetrics {
    return {
      name: this.config.name,
      activeCalls: this.activeCalls,
      queuedCalls: this.queue.length,
      maxConcurrentCalls: this.config.maxConcurrentCalls,
      maxQueueSize: this.config.maxQueueSize,
      totalCalls: this.totalCalls,
      successfulCalls: this.successfulCalls,
      failedCalls: this.failedCalls,
      rejectedCalls: this.rejectedCalls,
      timedOutCalls: this.timedOutCalls,
      averageDurationMs:
        this.successfulCalls > 0 ? Math.round(this.totalDurationMs / this.successfulCalls) : 0,
    };
  }

  canAccept(): boolean {
    return (
      this.activeCalls < this.config.maxConcurrentCalls ||
      this.queue.length < this.config.maxQueueSize
    );
  }

  resetMetrics(): void {
    this.totalCalls = 0;
    this.successfulCalls = 0;
    this.failedCalls = 0;
    this.rejectedCalls = 0;
    this.timedOutCalls = 0;
    this.totalDurationMs = 0;
  }
}
