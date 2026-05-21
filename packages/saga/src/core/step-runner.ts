// ---------------------------------------------------------------------------
// @backendkit-labs/saga — src/core/step-runner.ts
//
// StepRunner: executes a single step with timeout support.
// Timeouts use createTimer (no global timer leak).
// BUSINESS errors are returned as-is (no retry).
// INFRASTRUCTURE errors and timeouts are returned for caller to retry.
// ---------------------------------------------------------------------------

import { ok, fail } from '@backendkit-labs/result';
import type { StepDefinition, StepContext } from '../types/step.types';
import type { SagaResult, StepError } from '../types/error.types';
import { createTimer } from '../utils/time';

export interface StepResult {
  stepName: string;
  output: unknown;
  durationMs: number;
}

export class StepRunner {
  async execute(step: StepDefinition, ctx: StepContext): Promise<SagaResult<StepResult>> {
    const startTime = Date.now();

    const executePromise = (async (): Promise<SagaResult<StepResult>> => {
      try {
        const output = await step.execute(ctx);

        const durationMs = Date.now() - startTime;
        return ok({ stepName: step.name, output, durationMs });
      } catch (caught) {
        const error = caught instanceof Error ? caught : new Error(String(caught));
        const stepError: StepError = {
          type: 'INFRASTRUCTURE_ERROR',
          step: step.name,
          cause: error,
          code: 'STEP_EXECUTION_FAILED',
        };

        return fail(stepError);
      }
    })();

    // Apply timeout if configured
    if (step.timeoutMs !== undefined && step.timeoutMs > 0) {
      const timer = createTimer(step.timeoutMs);

      // Suppress unhandled rejection from timer promise after cancel
      timer.promise.catch(() => {});

      const result = await Promise.race([
        executePromise,
        timer.promise.then(
          () => {
            // Timer resolved (should not happen with current timer impl)
            const timeoutError: StepError = {
              type: 'STEP_TIMEOUT',
              step: step.name,
              timeoutMs: step.timeoutMs!,
            };
            return fail(timeoutError);
          },
          () => {
            // Timer rejected (timeout or cancel)
            const timeoutError: StepError = {
              type: 'STEP_TIMEOUT',
              step: step.name,
              timeoutMs: step.timeoutMs!,
            };
            return fail(timeoutError);
          },
        ),
      ]);

      timer.cancel();
      return result;
    }

    return executePromise;
  }
}
