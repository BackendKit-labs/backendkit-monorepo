import { LoggerService } from '@nestjs/common';
import { ObservabilityAdapter } from '../core/observability/observability-adapter.js';

export class BackendKitObservabilityAdapter implements ObservabilityAdapter {
  private readonly prefix = 'auto_learning';

  constructor(
    private readonly logger: LoggerService,
    private readonly metrics?: {
      increment?: (name: string, value?: number, tags?: Record<string, string>) => void;
      gauge?: (name: string, value: number, tags?: Record<string, string>) => void;
      histogram?: (name: string, value: number, tags?: Record<string, string>) => void;
    },
  ) {}

  info(msg: string, meta?: Record<string, unknown>): void {
    this.logger.log?.(`[AutoLearn] ${msg}`, meta);
  }

  warn(msg: string, meta?: Record<string, unknown>): void {
    this.logger.warn?.(`[AutoLearn] ${msg}`, meta);
  }

  error(msg: string, meta?: Record<string, unknown>): void {
    this.logger.error?.(`[AutoLearn] ${msg}`, meta);
  }

  debug(msg: string, meta?: Record<string, unknown>): void {
    this.logger.debug?.(`[AutoLearn] ${msg}`, meta);
  }

  incrementMetric(name: string, value = 1, tags?: Record<string, string>): void {
    this.metrics?.increment?.(`${this.prefix}.${name}`, value, tags);
  }

  gaugeMetric(name: string, value: number, tags?: Record<string, string>): void {
    this.metrics?.gauge?.(`${this.prefix}.${name}`, value, tags);
  }

  histogramMetric(name: string, value: number, tags?: Record<string, string>): void {
    this.metrics?.histogram?.(`${this.prefix}.${name}`, value, tags);
  }
}
