// ---------------------------------------------------------------------------
// @backendkit-labs/saga -- src/integration/observability-adapter.ts
//
// Adapter for @backendkit-labs/observability.
// Provides structured logging, correlation ID propagation and metrics
// for saga executions. Designed to integrate with NestJS Logger and
// OpenTelemetry-compatible exporters.
//
// Optional peer dependency.
// ---------------------------------------------------------------------------

import type { SagaState, SagaId } from '../types/saga.types';
import type { SagaEvent } from '../types/events.types';
import { SagaStatus } from '../types/saga.types';

// ---- Log levels ----

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

// ---- Log entry ----

export interface SagaLogEntry {
  timestamp: number;
  level: LogLevel;
  message: string;
  sagaId?: SagaId;
  correlationId?: string;
  stepName?: string;
  status?: SagaStatus;
  attempt?: number;
  durationMs?: number;
  [key: string]: unknown;
}

// ---- Logger interface ----

export interface SagaLogger {
  log(entry: SagaLogEntry): void;
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

// ---- Metrics collector ----

export interface SagaMetrics {
  recordStepDuration(stepName: string, durationMs: number, status: string): void;
  recordSagaDuration(sagaType: string, durationMs: number, status: SagaStatus): void;
  incrementActiveSagas(delta: number): void;
  incrementStepCounter(stepName: string, status: string): void;
  incrementCompensationCounter(stepName: string, status: string): void;
}

// ---- Default console logger (for dev / non-NestJS usage) ----

export class ConsoleSagaLogger implements SagaLogger {
  log(entry: SagaLogEntry): void {
    const prefix = `[saga:${entry.sagaId ?? '-'}]`;
    const message = entry.stepName !== undefined
      ? `${prefix} [${entry.stepName}] ${entry.message}`
      : `${prefix} ${entry.message}`;

    switch (entry.level) {
      case 'debug':
        console.debug(message, entry);
        break;
      case 'info':
        console.info(message, entry);
        break;
      case 'warn':
        console.warn(message, entry);
        break;
      case 'error':
        console.error(message, entry);
        break;
    }
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    this.log({ timestamp: Date.now(), level: 'debug', message, ...meta });
  }

  info(message: string, meta?: Record<string, unknown>): void {
    this.log({ timestamp: Date.now(), level: 'info', message, ...meta });
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    this.log({ timestamp: Date.now(), level: 'warn', message, ...meta });
  }

  error(message: string, meta?: Record<string, unknown>): void {
    this.log({ timestamp: Date.now(), level: 'error', message, ...meta });
  }
}

// ---- No-op metrics collector ----

export class NoopSagaMetrics implements SagaMetrics {
  recordStepDuration(_stepName: string, _durationMs: number, _status: string): void {}
  recordSagaDuration(_sagaType: string, _durationMs: number, _status: SagaStatus): void {}
  incrementActiveSagas(_delta: number): void {}
  incrementStepCounter(_stepName: string, _status: string): void {}
  incrementCompensationCounter(_stepName: string, _status: string): void {}
}

// ---- Observability adapter (facade) ----

export class SagaObservability {
  constructor(
    public readonly logger: SagaLogger = new ConsoleSagaLogger(),
    public readonly metrics: SagaMetrics = new NoopSagaMetrics(),
  ) {}

  onStepStart(state: SagaState, stepName: string): void {
    this.logger.info('Step started', {
      level: 'info',
      sagaId: state.id,
      correlationId: state.correlationId,
      stepName,
      status: SagaStatus.STEP_EXECUTING,
      attempt: state.steps.find((s) => s.name === stepName)?.attempt ?? 1,
    });
  }

  onStepEnd(state: SagaState, stepName: string, durationMs: number, status: string): void {
    this.logger.info('Step completed', {
      level: 'info',
      sagaId: state.id,
      correlationId: state.correlationId,
      stepName,
      status,
      durationMs,
    });
    this.metrics.recordStepDuration(stepName, durationMs, status);
    this.metrics.incrementStepCounter(stepName, status);
  }

  onSagaEnd(state: SagaState, durationMs: number): void {
    this.logger.info('Saga completed', {
      level: 'info',
      sagaId: state.id,
      correlationId: state.correlationId,
      status: state.status,
      durationMs,
    });
    this.metrics.recordSagaDuration(state.sagaType, durationMs, state.status);
    this.metrics.incrementActiveSagas(-1);
  }

  onSagaEvent(event: SagaEvent): void {
    this.logger.debug('Saga event', {
      level: 'debug',
      sagaId: event.sagaId,
      eventType: event.eventType,
      stepName: event.stepName,
    });
  }

  onError(sagaId: SagaId, correlationId: string, message: string, error: unknown): void {
    this.logger.error(message, {
      level: 'error',
      sagaId,
      correlationId,
      cause: error instanceof Error ? { message: error.message, stack: error.stack } : error,
    });
  }
}
