// ---------------------------------------------------------------------------
// @backendkit-labs/saga — src/types/step.types.ts
//
// Step definitions: context objects, handler signatures, step definition,
// step group for parallel execution.
// ---------------------------------------------------------------------------

import type { SagaId } from './saga.types';
import type { SagaError, SagaResult } from './error.types';

// ---- StepContext ----

export interface StepContext {
  sagaId: SagaId;
  correlationId: string;
  stepName: string;
  attempt: number;            // current retry attempt (1 = first)
  idempotencyKey: string;     // stable key: "<sagaId>:<stepName>:<attempt>" — use for dedup at external APIs
  input: unknown;             // input payload passed to saga.start()
  previousOutput: unknown;    // output from previous sequential step
  metadata: Record<string, unknown>;
}

// ---- CompensationContext ----

export interface CompensationContext {
  sagaId: SagaId;
  correlationId: string;
  stepName: string;
  originalInput: unknown;     // the input originally passed to the step
  originalOutput: unknown;    // the output of the step being compensated
  failureReason: SagaError;   // the error that triggered compensation
  attempt: number;            // compensation attempt (1 = first)
}

// ---- Handler signatures ----

export type StepHandler = (ctx: StepContext) => Promise<SagaResult<unknown>>;

export type CompensationHandler = (ctx: CompensationContext) => Promise<SagaResult<void>>;

// ---- RetryPolicy ----

export interface RetryPolicy {
  maxAttempts: number;          // default: 3
  initialBackoffMs: number;     // default: 1000
  backoffMultiplier: number;    // default: 2
  maxBackoffMs: number;         // default: 30000
  jitter: boolean;              // default: true
  retryOn: Array<'INFRASTRUCTURE_ERROR' | 'STEP_TIMEOUT'>;
}

// ---- StepDefinition ----

export interface StepDefinition {
  name: string;
  execute: StepHandler;
  compensate?: CompensationHandler;
  timeoutMs?: number;
  retry?: RetryPolicy;
  requiresManualApproval?: string;  // approval group name
}

// ---- StepGroup (parallel steps) ----

export interface StepGroup {
  type: 'parallel';
  steps: StepDefinition[];
  maxConcurrency?: number;  // bulkhead limit for this group
}
