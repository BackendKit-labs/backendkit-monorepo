import { Bulkhead, BulkheadConfig, BulkheadMetrics } from './bulkhead.js';

export interface BulkheadOptions extends Partial<BulkheadConfig> {
  name: string;
}

const DEFAULT_CONFIG: Omit<BulkheadConfig, 'name'> = {
  maxConcurrentCalls: 10,
  maxQueueSize: 100,
  queueTimeoutMs: 30000,
  rejectWhenFull: true,
};

export class BulkheadRegistry {
  private readonly bulkheads = new Map<string, Bulkhead>();

  getOrCreate(options: BulkheadOptions): Bulkhead {
    if (!this.bulkheads.has(options.name)) {
      const config: BulkheadConfig = { ...DEFAULT_CONFIG, ...options, name: options.name };
      this.bulkheads.set(options.name, new Bulkhead(config));
    }
    return this.bulkheads.get(options.name)!;
  }

  /** Per-client isolation — 5 concurrent, 20 queued */
  getForClient(clientId: string, endpoint?: string): Bulkhead {
    const name = endpoint ? `client:${clientId}:${endpoint}` : `client:${clientId}`;
    return this.getOrCreate({ name, maxConcurrentCalls: 5, maxQueueSize: 20 });
  }

  /** Service-level limiting — 20 concurrent, 200 queued */
  getForService(serviceName: string): Bulkhead {
    return this.getOrCreate({
      name: `service:${serviceName}`,
      maxConcurrentCalls: 20,
      maxQueueSize: 200,
    });
  }

  /** Database connection limiting — 15 concurrent, 150 queued */
  getForDatabase(schema: string): Bulkhead {
    return this.getOrCreate({
      name: `database:${schema}`,
      maxConcurrentCalls: 15,
      maxQueueSize: 150,
    });
  }

  /** External HTTP calls — 8 concurrent, 50 queued, 10s timeout */
  getForHttpExternal(serviceName: string): Bulkhead {
    return this.getOrCreate({
      name: `http:${serviceName}`,
      maxConcurrentCalls: 8,
      maxQueueSize: 50,
      queueTimeoutMs: 10000,
    });
  }

  getAllMetrics(): Record<string, BulkheadMetrics> {
    const metrics: Record<string, BulkheadMetrics> = {};
    for (const [name, bulkhead] of this.bulkheads) {
      metrics[name] = bulkhead.getMetrics();
    }
    return metrics;
  }

  /** Returns bulkheads at or above 80% active capacity */
  getOverloadedBulkheads(): BulkheadMetrics[] {
    const overloaded: BulkheadMetrics[] = [];
    for (const bulkhead of this.bulkheads.values()) {
      const m = bulkhead.getMetrics();
      if (m.activeCalls >= m.maxConcurrentCalls * 0.8) {
        overloaded.push(m);
      }
    }
    return overloaded;
  }

  resetAllMetrics(): void {
    for (const bulkhead of this.bulkheads.values()) {
      bulkhead.resetMetrics();
    }
  }
}
