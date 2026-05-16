import { ObservabilityAdapter } from './observability-adapter.js';

export class NoopObservabilityAdapter implements ObservabilityAdapter {
  info(_msg: string, _meta?: Record<string, unknown>): void {}
  warn(_msg: string, _meta?: Record<string, unknown>): void {}
  error(_msg: string, _meta?: Record<string, unknown>): void {}
  debug(_msg: string, _meta?: Record<string, unknown>): void {}

  incrementMetric(_name: string, _value?: number, _tags?: Record<string, string>): void {}
  gaugeMetric(_name: string, _value: number, _tags?: Record<string, string>): void {}
  histogramMetric(_name: string, _value: number, _tags?: Record<string, string>): void {}
}
