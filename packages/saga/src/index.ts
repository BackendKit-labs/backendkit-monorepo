// ---------------------------------------------------------------------------
// @backendkit-labs/saga -- src/index.ts
//
// Public API barrel: re-exports all types, classes and utilities.
// ---------------------------------------------------------------------------

// ===== Types =====
export type { SagaId, SagaState, SagaFilter, SagaOutput, StepState } from './types/saga.types';
export { SagaStatus, StepStatus } from './types/saga.types';
export type { StepError, SagaEngineError, SagaError, SagaResult } from './types/error.types';
export type { StepContext, CompensationContext, StepHandler, CompensationHandler, StepDefinition, StepGroup } from './types/step.types';
export type { SagaEventType, SagaEvent, EventHandler, SagaEventBus as SagaEventBusInterface } from './types/events.types';
export type { LockProvider } from './types/lock.types';
export type { OutboxAdapter } from './types/outbox.types';
export type { ApprovalStore, ApprovalStatus, ApprovalRequest } from './types/approval.types';

// ===== State Machine =====
export { SagaStateMachine } from './state-machine/saga-state-machine';
export { isTerminalStepStatus, isFailureStepStatus } from './state-machine/step-status';

// ===== Retry =====
export type { RetryPolicy } from './retry/retry-policy';
export { DEFAULT_RETRY_POLICY } from './retry/retry-policy';
export { calculateBackoffMs } from './retry/backoff-calculator';

// ===== Persistence =====
export type { SagaStore } from './persistence/saga-store.interface';
export { InMemoryStore } from './persistence/in-memory-store';
export { SqlAdapter } from './persistence/sql-adapter';
export type { SqlClient, SqlDialect, SqlAdapterOptions } from './persistence/sql-adapter';
export { RedisAdapter } from './persistence/redis-store';
export type { RedisClient, RedisAdapterOptions } from './persistence/redis-store';

// ===== Events =====
export { SagaEventBusImpl } from './events/saga-event-bus';

// ===== Lock =====
export { InMemoryLock } from './lock/in-memory-lock';
export { RedisLockAdapter } from './lock/redis-lock';
export type { RedisLockClient } from './lock/redis-lock';

// ===== Core =====
export { SagaBuilder } from './core/saga-builder';
export type { SagaDefinition, SagaContext } from './core/saga-builder';
export { StepRunner } from './core/step-runner';
export { CompensationRunner } from './core/compensation-runner';
export { SagaInstance } from './core/saga-instance';
export { SagaEngine } from './core/saga-engine';
export type { StepResult } from './core/step-runner';

// ===== Parallel =====
export { ParallelExecutor } from './parallel/parallel-executor';

// ===== Approval =====
export { ApprovalStep } from './approval/approval-step';

// ===== Recovery =====
export { RecoveryEngine } from './recovery/recovery-engine';
export { SagaScanner } from './recovery/saga-scanner';

// ===== Utils =====
export { generateSagaId, generateCorrelationId, generateEventId } from './utils/id-generator';
export { currentTimestamp, createTimer } from './utils/time';

// ===== Integration Adapters =====
export {
  SagaCircuitBreaker,
  SagaBulkhead,
  SagaObservability,
  ConsoleSagaLogger,
  NoopSagaMetrics,
  SagaHttpClient,
  SagaPipeline,
  loggingMiddleware,
  timeoutMiddleware,
  retryMiddleware,
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
} from './integration';
export type {
  CircuitBreakerConfig,
  CircuitBreakerState,
  BulkheadConfig,
  BulkheadMetrics,
  SagaLogger,
  SagaMetrics,
  SagaLogEntry,
  LogLevel,
  HttpClientConfig,
  HttpRequestConfig,
  HttpResponse,
  StepMiddleware,
} from './integration';

// ===== NestJS Integration (optional) =====
export {
  SagaModule,
  SagaOrchestrator,
  Saga,
  Step,
  Compensate,
  StepContextDecorator,
  SagaEventHandler,
  SagaCorrelationIdInterceptor,
  CORRELATION_ID_HEADER,
  getSagaConfig,
  getStepMetadata,
  getCompensateMetadata,
  getStepContextParamIndex,
  getEventHandlerMetadata,
} from './nestjs';
export type {
  SagaModuleOptions,
  SagaStoreSet,
  SagaConfig,
  StepConfig,
  ReflectStepMetadata,
  ReflectCompensateMetadata,
  ReflectEventHandlerMetadata,
} from './nestjs';
