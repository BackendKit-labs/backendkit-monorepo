// ---------------------------------------------------------------------------
// @backendkit-labs/saga — src/parallel/parallel-executor.ts
//
// ParallelExecutor: runs multiple steps concurrently with wait-all semantics.
//   - All steps execute in parallel via Promise.allSettled
//   - BUSINESS_ERROR: completed steps are preserved, error propagated
//   - INFRASTRUCTURE_ERROR: same semantics, caller decides retry
// ---------------------------------------------------------------------------

import { ok, fail, isOk } from '@backendkit-labs/result';
import type { StepDefinition, StepContext } from '../types/step.types';
import type { SagaResult, StepError } from '../types/error.types';
import type { StepResult } from '../core/step-runner';
import { StepRunner } from '../core/step-runner';

export class ParallelExecutor {
  async execute(
    steps: StepDefinition[],
    ctx: StepContext,
  ): Promise<SagaResult<StepResult[]>> {
    if (steps.length === 0) {
      return ok([]);
    }

    const runner = new StepRunner();
    const promises = steps.map((step) => runner.execute(step, ctx));

    const settled = await Promise.allSettled(promises);
    const results: StepResult[] = [];
    const errors: Array<{ step: string; error: StepError }> = [];

    for (let i = 0; i < settled.length; i++) {
      const result = settled[i];

      if (result.status === 'fulfilled') {
        const sagaResult = result.value;

        if (isOk(sagaResult)) {
          results.push(sagaResult.value);
        } else {
          const stepError = sagaResult.error as StepError;
          errors.push({ step: steps[i].name, error: stepError });
        }
      } else {
        // Promise rejection (should not happen since StepRunner catches)
        const cause = result.reason instanceof Error ? result.reason : new Error(String(result.reason));
        const stepError: StepError = {
          type: 'INFRASTRUCTURE_ERROR',
          step: steps[i].name,
          cause,
          code: 'PARALLEL_EXECUTION_FAILED',
        };
        errors.push({ step: steps[i].name, error: stepError });
      }
    }

    if (errors.length > 0) {
      // Return the first error — caller can inspect errors for retry decisions
      const firstError = errors[0].error;
      return fail(firstError);
    }

    return ok(results);
  }
}
