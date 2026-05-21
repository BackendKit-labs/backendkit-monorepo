// ---------------------------------------------------------------------------
// @backendkit-labs/saga — src/approval/approval-step.ts
//
// ApprovalStep: helper to create StepHandlers that require human approval.
// The step handler:
//   1. Creates an approval request via ApprovalStore
//   2. Publishes MANUAL_APPROVAL_REQUIRED event
//   3. Returns output with approvalId (step stays PAUSED externally)
// ---------------------------------------------------------------------------

import { ok, isFail } from '@backendkit-labs/result';
import type { StepHandler, StepContext } from '../types/step.types';
import type { SagaResult } from '../types/error.types';
import type { ApprovalStore, ApprovalRequest } from '../types/approval.types';
import type { SagaEventBus } from '../types/events.types';
import { generateEventId } from '../utils/id-generator';
import { currentTimestamp } from '../utils/time';

export class ApprovalStep {
  static createHandler(
    approvalStore: ApprovalStore,
    group: string,
    eventBus: SagaEventBus,
  ): StepHandler {
    return async (ctx: StepContext) => {
      const request: ApprovalRequest = {
        id: generateEventId(),
        stepName: ctx.stepName,
        sagaId: ctx.sagaId,
        group,
        status: 'PENDING',
        context: {
          input: ctx.input,
          metadata: ctx.metadata,
        },
        createdAt: currentTimestamp(),
      };

      const saveResult = approvalStore.requestApproval(request);
      if (isFail(saveResult)) {
        return saveResult as unknown as SagaResult<unknown>;
      }

      await eventBus.publish({
        id: request.id,
        sagaId: ctx.sagaId,
        eventType: 'MANUAL_APPROVAL_REQUIRED',
        stepName: ctx.stepName,
        payload: { approvalId: request.id, group },
        timestamp: currentTimestamp(),
      });

      return ok({ approvalId: request.id });
    };
  }
}
