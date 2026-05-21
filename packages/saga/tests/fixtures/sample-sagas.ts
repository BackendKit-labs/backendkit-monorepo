// ---------------------------------------------------------------------------
// @backendkit-labs/saga -- tests/fixtures/sample-sagas.ts
//
// Pre-built saga builders for integration and E2E tests.
// All return SagaBuilder instances (ready for engine.define()).
// ---------------------------------------------------------------------------

import { ok, fail } from '@backendkit-labs/result';
import type { SagaResult, StepError, SagaError } from '../../src/types/error.types';
import type { StepContext, CompensationContext, StepHandler, CompensationHandler, RetryPolicy } from '../../src/types/step.types';
import type { SagaContext } from '../../src/core/saga-builder';
import { SagaBuilder } from '../../src/core/saga-builder';
import { businessError } from '../../src/integration/result-adapter';

// =====================================================================
// Factory helpers
// =====================================================================

/**
 * Creates a step handler that always succeeds with the given output.
 */
export function okStep(output: unknown = { ok: true }): StepHandler {
  return async (_ctx: StepContext) => ok(output) as SagaResult<unknown>;
}

/**
 * Creates a step handler that always fails with the given error.
 */
export function failStep(error: SagaError = businessError('step', new Error('fail'), 'ERR')): StepHandler {
  return async (_ctx: StepContext) => fail(error) as SagaResult<unknown>;
}

// =====================================================================
// Saga builders (return SagaBuilder for engine.define())
// =====================================================================

/**
 * Single step, happy path.
 */
export function createSimpleSaga(): SagaBuilder {
  return SagaBuilder.define('simple-saga')
    .step({ name: 'step-ok', execute: okStep({ done: true }) });
}

/**
 * 3 sequential steps, all ok.
 */
export function createMultiStepSaga(): SagaBuilder {
  return SagaBuilder.define('multi-step-saga')
    .step({ name: 'step-ok-1', execute: okStep({ step: 1 }) })
    .step({ name: 'step-ok-2', execute: okStep({ step: 2 }) })
    .step({ name: 'step-ok-3', execute: okStep({ step: 3 }) });
}

/**
 * 3 steps with a compensate handler on each one.
 */
export function createCompensatableSaga(): SagaBuilder {
  const compensateHandler: CompensationHandler = async (_ctx: CompensationContext) => ok(undefined);

  return SagaBuilder.define('compensatable-saga')
    .step({ name: 'step-1', execute: okStep({ step: 1 }), compensate: compensateHandler })
    .step({ name: 'step-2', execute: okStep({ step: 2 }), compensate: compensateHandler })
    .step({ name: 'step-3', execute: okStep({ step: 3 }), compensate: compensateHandler });
}

/**
 * 3 steps: step-ok-1 succeeds, step-fail fails with BUSINESS_ERROR,
 * triggering compensation for step-ok-1.
 */
export function createFailingSaga(): SagaBuilder {
  const compensateHandler: CompensationHandler = async (_ctx: CompensationContext) => ok(undefined);

  const failError: StepError = {
    type: 'BUSINESS_ERROR',
    step: 'step-fail',
    cause: new Error('Business failure'),
    code: 'BIZ_ERR',
  };

  return SagaBuilder.define('failing-saga')
    .step({ name: 'step-ok-1', execute: okStep({ step: 1 }), compensate: compensateHandler })
    .step({ name: 'step-fail', execute: async (_ctx: StepContext) => fail(failError) as SagaResult<unknown> })
    .step({ name: 'step-ok-3', execute: okStep({ step: 3 }) });
}

/**
 * Step-1 succeeds, step-fail fails, and the compensation for step-1 also fails,
 * leading to PARTIALLY_COMPENSATED.
 */
export function createCompensationFailureSaga(): SagaBuilder {
  const failError: StepError = {
    type: 'BUSINESS_ERROR',
    step: 'step-fail',
    cause: new Error('Business failure'),
    code: 'BIZ_ERR',
  };

  return SagaBuilder.define('compensation-failure-saga')
    .step({
      name: 'step-1',
      execute: okStep({ step: 1 }),
      compensate: async (_ctx: CompensationContext) =>
        fail({ category: 'COMPENSATION_ERROR', step: 'step-1', cause: new Error('Compensation failed') }) as SagaResult<void>,
    })
    .step({ name: 'step-fail', execute: async (_ctx: StepContext) => fail(failError) as SagaResult<unknown> });
}

/**
 * Sequential before, parallel(p1,p2,p3), then after.
 */
export function createParallelSaga(): SagaBuilder {
  return SagaBuilder.define('parallel-saga')
    .step({ name: 'before', execute: okStep({ phase: 'before' }) })
    .parallel(
      { name: 'p1', execute: okStep({ id: 'p1' }) },
      { name: 'p2', execute: okStep({ id: 'p2' }) },
      { name: 'p3', execute: okStep({ id: 'p3' }) },
    )
    .step({ name: 'after', execute: okStep({ phase: 'after' }) });
}

/**
 * Step with timeoutMs:50 that takes 200ms, triggering a timeout.
 */
export function createTimeoutSaga(): SagaBuilder {
  return SagaBuilder.define('timeout-saga')
    .step({
      name: 'slow-step',
      timeoutMs: 50,
      execute: async (_ctx: StepContext) => {
        await new Promise((resolve) => setTimeout(resolve, 200));
        return ok({ done: true }) as SagaResult<unknown>;
      },
    });
}

/**
 * Step with a retry policy configured.
 */
export function createRetrySaga(): SagaBuilder {
  const retryPolicy: RetryPolicy = {
    maxAttempts: 3,
    initialBackoffMs: 10,
    backoffMultiplier: 1,
    maxBackoffMs: 100,
    jitter: false,
    retryOn: ['INFRASTRUCTURE_ERROR', 'STEP_TIMEOUT'],
  };

  return SagaBuilder.define('retry-saga')
    .step({
      name: 'retry-step',
      retry: retryPolicy,
      execute: okStep({ retried: true }),
    });
}

/**
 * Step with requiresManualApproval metadata.
 */
export function createApprovalSaga(): SagaBuilder {
  return SagaBuilder.define('approval-saga')
    .step({ name: 'before', execute: okStep({ phase: 'before' }) })
    .step({
      name: 'approval-step',
      requiresManualApproval: 'manager-group',
      execute: okStep({ approved: true }),
    })
    .step({ name: 'after', execute: okStep({ phase: 'after' }) });
}

/**
 * Saga with onComplete and onFail lifecycle hooks.
 */
export function createLifecycleSaga(): SagaBuilder {
  return SagaBuilder.define('lifecycle-saga')
    .step({ name: 'step-1', execute: okStep({ step: 1 }) })
    .onComplete(async (_ctx: SagaContext) => { /* noop */ })
    .onFail(async (_ctx: SagaContext) => { /* noop */ });
}

/**
 * Saga with zero steps.
 */
export function createEmptySaga(): SagaBuilder {
  return SagaBuilder.define('empty-saga');
}

/**
 * Step that fails with INFRASTRUCTURE_ERROR the first 2 times,
 * then succeeds on the 3rd attempt.
 */
export function createInfraErrorSaga(): SagaBuilder {
  let attemptCounter = 0;

  return SagaBuilder.define('infra-error-saga')
    .step({
      name: 'unstable-step',
      execute: async (_ctx: StepContext) => {
        attemptCounter++;
        if (attemptCounter < 3) {
          return fail({
            type: 'INFRASTRUCTURE_ERROR',
            step: 'unstable-step',
            cause: new Error('Attempt ' + attemptCounter + ' failed'),
            code: 'NETWORK_ERR',
          } satisfies StepError) as SagaResult<unknown>;
        }
        return ok({ success: true, attempts: attemptCounter }) as SagaResult<unknown>;
      },
    });
}

// =====================================================================
// Index map — returns builder factory
// =====================================================================

export const SAMPLE_SAGAS: Record<string, () => SagaBuilder> = {
  'simple': createSimpleSaga,
  'multi-step': createMultiStepSaga,
  'compensatable': createCompensatableSaga,
  'failing': createFailingSaga,
  'compensation-failure': createCompensationFailureSaga,
  'parallel': createParallelSaga,
  'timeout': createTimeoutSaga,
  'retry': createRetrySaga,
  'approval': createApprovalSaga,
  'lifecycle': createLifecycleSaga,
  'empty': createEmptySaga,
  'infra-error': createInfraErrorSaga,
};
