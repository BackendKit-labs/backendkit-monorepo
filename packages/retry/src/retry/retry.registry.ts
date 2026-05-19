import type { RetryEngineConfig, RetryMetricsSnapshot } from './types.js';
import { RetryEngine } from './retry.engine.js';

export class RetryRegistry {
  private readonly engines = new Map<string, RetryEngine>();

  getOrCreate(name: string, config?: Partial<RetryEngineConfig>): RetryEngine {
    if (!this.engines.has(name)) {
      this.engines.set(
        name,
        new RetryEngine({
          name,
          ...config,
          defaultConfig: { ...config?.defaultConfig },
          integrations: config?.integrations,
        }),
      );
    }
    return this.engines.get(name)!;
  }

  get(name: string): RetryEngine | undefined {
    return this.engines.get(name);
  }

  reset(name: string): void {
    this.engines.delete(name);
  }

  resetAll(): void {
    this.engines.clear();
  }

  getAllMetrics(): Record<string, RetryMetricsSnapshot> {
    const metrics: Record<string, RetryMetricsSnapshot> = {};
    for (const [name, engine] of this.engines) {
      metrics[name] = engine.getMetrics();
    }
    return metrics;
  }
}
