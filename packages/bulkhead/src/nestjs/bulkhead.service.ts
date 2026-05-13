import { Injectable, Inject, Logger, OnModuleDestroy } from '@nestjs/common';
import { BulkheadRegistry } from '../bulkhead/bulkhead.registry.js';
import type { BulkheadMetrics } from '../bulkhead/bulkhead.js';

@Injectable()
export class BulkheadService implements OnModuleDestroy {
  private readonly logger = new Logger(BulkheadService.name);
  private monitorInterval: ReturnType<typeof setInterval> | null = null;

  constructor(@Inject(BulkheadRegistry) private readonly registry: BulkheadRegistry) {
    this.startMonitoring();
  }

  onModuleDestroy(): void {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
    }
  }

  getAllMetrics(): Record<string, BulkheadMetrics> {
    return this.registry.getAllMetrics();
  }

  getCriticalBulkheads(): BulkheadMetrics[] {
    return Object.values(this.registry.getAllMetrics()).filter(
      m => m.activeCalls / m.maxConcurrentCalls > 0.9,
    );
  }

  resetMetrics(name?: string): void {
    if (name) {
      this.registry.getOrCreate({ name }).resetMetrics();
    } else {
      this.registry.resetAllMetrics();
    }
  }

  private startMonitoring(): void {
    this.monitorInterval = setInterval(() => {
      const critical = this.getCriticalBulkheads();
      if (critical.length > 0) {
        this.logger.warn(
          `Critical bulkheads detected: ${critical.length}`,
          critical.map(c => ({
            name: c.name,
            utilization: `${Math.round((c.activeCalls / c.maxConcurrentCalls) * 100)}%`,
            queued: c.queuedCalls,
          })),
        );
      }
    }, 60_000);
  }
}
