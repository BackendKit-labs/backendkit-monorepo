export type EndpointPattern = {
  method: string;
  path: string;
  statusCode: number;
  durationMs: number;
  timestamp: Date;
  correlationId?: string;
  metadata?: Record<string, unknown>;
};

export type AggregatePattern = {
  method: string;
  path: string;
  windowStart: Date;
  windowEnd: Date;
  count: number;
  avgDurationMs: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  errorCount: number;
  errorRate: number;
};

export type AnomalySeverity = 'low' | 'medium' | 'high' | 'critical';

export type AnomalyReport = {
  id: string;
  endpoint: string;
  method: string;
  severity: AnomalySeverity;
  metric: 'latency' | 'error_rate' | 'frequency' | 'unknown_endpoint';
  expectedValue: number;
  actualValue: number;
  deviation: number;
  detectedAt: Date;
};

export type TunableConfig = {
  circuitBreaker: {
    failureThreshold: number;
    openTimeoutMs: number;
  };
  bulkhead: {
    maxConcurrentCalls: number;
  };
  httpClient: {
    timeoutMs: number;
    maxRetries: number;
  };
};

export type LearningCycleEvent = {
  cycleId: string;
  timestamp: Date;
  patternsProcessed: number;
  anomaliesFound: number;
  configChanges: Partial<TunableConfig>;
  durationMs: number;
};
