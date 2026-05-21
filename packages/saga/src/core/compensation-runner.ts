// ---------------------------------------------------------------------------
// @backendkit-labs/saga — src/core/compensation-runner.ts
//
// CompensationRunner: runs compensation handlers in REVERSE step order.
// Continues on individual compensation failures and reports partial status.
// ---------------------------------------------------------------------------

import { ok, fail, isFail } from '@backendkit-labs/result';
import type { StepDefinition, CompensationContext } from '../types/step.types';
import type { SagaState } from '../types/saga.types';
import { StepStatus } from '../types/saga.types';
import type { SagaResult, SagaEngineError } from '../types/error.types';

export class CompensationRunner {
  async run(steps: StepDefinition[], state: SagaState): Promise<SagaResult<void>> {
    const executedSteps = state.steps.filter(
      (s) => s.status === StepStatus.SUCCEEDED && s.name !== undefined,
    );

    // Reverse order: last executed step compensates first
    const reverseSteps = [...executedSteps].reverse();
    let hasFailure = false;

    for (const stepState of reverseSteps) {
      const definition = steps.find((s) => s.name === stepState.name);

      if (definition === undefined || definition.compensate === undefined) {
        // No compensation handler defined — skip
        continue;
      }

      const context: CompensationContext = {
        sagaId: state.id,
        correlationId: state.correlationId,
        stepName: stepState.name,
        originalInput: stepState.input,
        originalOutput: stepState.output,
        failureReason: stepState.error ?? {
          category: 'SAGA_INTERNAL',
          cause: new Error('Unknown compensation trigger'),
        },
        attempt: 1,
      };

      try {
        const result = await definition.compensate(context);

        if (isFail(result)) {
          hasFailure = true;
        }
      } catch {
        hasFailure = true;
      }
    }

    if (hasFailure) {
      return fail({
        category: 'COMPENSATION_ERROR',
        step: 'multiple',
        cause: new Error('One or more compensations failed'),
      } satisfies SagaEngineError);
    }

    return ok(undefined);
  }
}
