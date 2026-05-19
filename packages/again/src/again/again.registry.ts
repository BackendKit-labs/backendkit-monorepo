import type { AgainEngineConfig, AgainMetricsSnapshot } from './types.js';
import { AgainEngine } from './again.engine.js';

export class AgainRegistry {
  private readonly engines = new Map<string, AgainEngine>();

  getOrCreate(name: string, config?: Partial<AgainEngineConfig>): AgainEngine {
    if (!this.engines.has(name)) {
      this.engines.set(
        name,
        new AgainEngine({
          name,
          ...config,
          defaultConfig: { ...config?.defaultConfig },
          integrations: config?.integrations,
        }),
      );
    }
    return this.engines.get(name)!;
  }

  get(name: string): AgainEngine | undefined {
    return this.engines.get(name);
  }

  reset(name: string): void {
    this.engines.delete(name);
  }

  resetAll(): void {
    this.engines.clear();
  }

  getAllMetrics(): Record<string, AgainMetricsSnapshot> {
    const metrics: Record<string, AgainMetricsSnapshot> = {};
    for (const [name, engine] of this.engines) {
      metrics[name] = engine.getMetrics();
    }
    return metrics;
  }
}
