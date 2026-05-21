// ---------------------------------------------------------------------------
// @backendkit-labs/saga -- src/integration/index.ts
//
// Integration adapters barrel.
// ---------------------------------------------------------------------------

export { SagaCircuitBreaker } from './circuit-breaker-adapter';
export type { CircuitBreakerConfig, CircuitBreakerState } from './circuit-breaker-adapter';

export { SagaBulkhead } from './bulkhead-adapter';
export type { BulkheadConfig, BulkheadMetrics } from './bulkhead-adapter';

export { SagaObservability, ConsoleSagaLogger, NoopSagaMetrics } from './observability-adapter';
export type { SagaLogger, SagaMetrics, SagaLogEntry, LogLevel } from './observability-adapter';

export { SagaHttpClient } from './http-client-adapter';
export type { HttpClientConfig, HttpRequestConfig, HttpResponse } from './http-client-adapter';

export {
  businessError,
  infrastructureError,
  stepTimeout,
  compensationError,
  retryExhausted,
  persistenceError,
  lockAcquisitionFailed,
  sagaNotFoundError,
  invalidTransition,
  sagaInternal,
  isBusinessError,
  isInfrastructureError,
  isStepTimeout,
  isCompensationError,
  isRetryExhausted,
  isPersistenceError,
  isLockError,
  isTransientError,
  chainSteps,
  mapResult,
  tapResult,
  recoverResult,
} from './result-adapter';

export { SagaPipeline, loggingMiddleware, timeoutMiddleware, retryMiddleware } from './pipeline-adapter';
export type { StepMiddleware } from './pipeline-adapter';
