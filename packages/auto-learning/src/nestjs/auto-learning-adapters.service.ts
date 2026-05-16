import { Injectable, OnModuleInit, OnApplicationBootstrap, OnModuleDestroy, Inject } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import type { CircuitBreakerRegistry } from '@backendkit-labs/circuit-breaker';
import type { BulkheadRegistry } from '@backendkit-labs/bulkhead';
import { AutoLearningCore } from '../core/auto-learning-core.js';
import { TunableConfig } from '../core/types.js';
import { AUTO_LEARNING_INSTANCE, AUTO_LEARNING_OPTIONS } from './auto-learning.constants.js';
import type { AutoLearningModuleOptions } from './auto-learning.module.js';

@Injectable()
export class AutoLearningAdaptersService
  implements OnModuleInit, OnApplicationBootstrap, OnModuleDestroy
{
  private cbRegistry: CircuitBreakerRegistry | null = null;
  private bhRegistry: BulkheadRegistry | null = null;
  private unsubConfigChange: (() => void) | null = null;

  constructor(
    @Inject(AUTO_LEARNING_INSTANCE) private readonly core: AutoLearningCore,
    @Inject(AUTO_LEARNING_OPTIONS) private readonly options: AutoLearningModuleOptions,
    private readonly moduleRef: ModuleRef,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.resolveRegistries();

    if (this.cbRegistry || this.bhRegistry) {
      this.unsubConfigChange = this.core.onConfigChange((config) => this.applyConfig(config));
    }
  }

  onApplicationBootstrap(): void {
    if (this.options.autoStart !== false) {
      this.core.startFeedbackLoop(this.options.intervalMs);
    }
  }

  onModuleDestroy(): void {
    if (this.core.isFeedbackLoopRunning()) {
      this.core.stopFeedbackLoop();
    }
    this.unsubConfigChange?.();
  }

  private async resolveRegistries(): Promise<void> {
    if (this.options.adapters?.circuitBreaker) {
      try {
        const mod = await import('@backendkit-labs/circuit-breaker');
        this.cbRegistry = this.moduleRef.get(mod.CircuitBreakerRegistry, { strict: false });
        this.core.observability.info('CircuitBreakerRegistry adapter connected');
      } catch {
        this.core.observability.warn(
          'adapters.circuitBreaker=true but CircuitBreakerModule is not imported — adapter skipped',
        );
      }
    }

    if (this.options.adapters?.bulkhead) {
      try {
        const mod = await import('@backendkit-labs/bulkhead');
        this.bhRegistry = this.moduleRef.get(mod.BulkheadRegistry, { strict: false });
        this.core.observability.info('BulkheadRegistry adapter connected');
      } catch {
        this.core.observability.warn(
          'adapters.bulkhead=true but BulkheadModule is not imported — adapter skipped',
        );
      }
    }
  }

  private applyConfig(config: TunableConfig): void {
    if (this.cbRegistry) {
      const allMetrics = this.cbRegistry.getAllMetrics();
      for (const name of Object.keys(allMetrics)) {
        const cb = this.cbRegistry.getOrCreate({ name });
        cb.updateConfig({
          failureThreshold: config.circuitBreaker.failureThreshold,
          openTimeoutMs: config.circuitBreaker.openTimeoutMs,
        });
      }
      this.core.observability.debug('Circuit breaker config updated', {
        ...config.circuitBreaker,
        affected: Object.keys(allMetrics).length,
      });
    }

    if (this.bhRegistry) {
      const allMetrics = this.bhRegistry.getAllMetrics();
      for (const name of Object.keys(allMetrics)) {
        const bh = this.bhRegistry.getOrCreate({ name });
        bh.updateConfig({ maxConcurrentCalls: config.bulkhead.maxConcurrentCalls });
      }
      this.core.observability.debug('Bulkhead config updated', {
        ...config.bulkhead,
        affected: Object.keys(allMetrics).length,
      });
    }
  }
}
