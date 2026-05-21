export interface IMetricsRecorder {
  record(
    name: string,
    value: number,
    options?: { unit?: string; tags?: Record<string, string> },
  ): void;
}
