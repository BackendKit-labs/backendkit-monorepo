export interface ObservabilityAdapter {
  info(msg: string, meta?: Record<string, unknown>): void;
  warn(msg: string, meta?: Record<string, unknown>): void;
  error(msg: string, meta?: Record<string, unknown>): void;
  debug(msg: string, meta?: Record<string, unknown>): void;

  incrementMetric(name: string, value?: number, tags?: Record<string, string>): void;
  gaugeMetric(name: string, value: number, tags?: Record<string, string>): void;
  histogramMetric(name: string, value: number, tags?: Record<string, string>): void;
}
