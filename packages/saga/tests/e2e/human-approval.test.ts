// ---------------------------------------------------------------------------
// @backendkit-labs/saga -- tests/e2e/human-approval.test.ts
//
// E2E: saga with approval step completes successfully.
// The step output from ApprovalStep is { approvalId: string } wrapped in ok().
// ---------------------------------------------------------------------------

import { ok, isOk } from '@backendkit-labs/result';
import { SagaEngine } from '../../src/core/saga-engine';
import { SagaBuilder } from '../../src/core/saga-builder';
import { ApprovalStep } from '../../src/approval/approval-step';
import { createRealStore, createRealLockProvider, createRealEventBus } from '../fixtures/mock-adapters';
import { okStep } from '../fixtures/sample-sagas';
import { SagaStatus } from '../../src/types/saga.types';
import type { SagaResult } from '../../src/types/error.types';
import type { ApprovalStore, ApprovalRequest, ApprovalStatus } from '../../src/types/approval.types';

class TestApprovalStore implements ApprovalStore {
  private requests = new Map<string, ApprovalRequest>();

  requestApproval(request: ApprovalRequest): SagaResult<void> {
    this.requests.set(request.id, { ...request });
    return ok(undefined);
  }

  approve(approvalId: string, _approvedBy: string): SagaResult<void> {
    const req = this.requests.get(approvalId);
    if (req) {
      req.status = 'APPROVED';
      req.resolvedAt = Date.now();
    }
    return ok(undefined);
  }

  deny(approvalId: string, _approvedBy: string, reason?: string): SagaResult<void> {
    const req = this.requests.get(approvalId);
    if (req) {
      req.status = 'DENIED';
      req.reason = reason;
      req.resolvedAt = Date.now();
    }
    return ok(undefined);
  }

  getStatus(approvalId: string): SagaResult<ApprovalStatus> {
    const req = this.requests.get(approvalId);
    if (!req) return ok('PENDING' as ApprovalStatus);
    return ok(req.status);
  }

  listPending(): SagaResult<ApprovalRequest[]> {
    return ok(Array.from(this.requests.values()).filter(r => r.status === 'PENDING'));
  }
}

describe('Human Approval E2E', () => {
  it('should execute saga with approval step to COMPLETED', async () => {
    const store = createRealStore();
    const lockProvider = createRealLockProvider();
    const eventBus = createRealEventBus();
    const approvalStore = new TestApprovalStore();

    const engine = new SagaEngine(store, lockProvider, eventBus);
    engine.define(
      SagaBuilder.define('e2e-approval')
        .step({ name: 'before', execute: okStep({ phase: 'before' }) })
        .step({
          name: 'approval-step',
          requiresManualApproval: 'manager-group',
          execute: ApprovalStep.createHandler(approvalStore, 'manager-group', eventBus),
        })
        .step({ name: 'after', execute: okStep({ phase: 'after' }) }),
    );

    const result = await engine.run('e2e-approval', { userId: 1 });

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.status).toBe(SagaStatus.COMPLETED);
    }
  });

  it('should publish MANUAL_APPROVAL_REQUIRED event', async () => {
    const store = createRealStore();
    const lockProvider = createRealLockProvider();
    const eventBus = createRealEventBus();
    const approvalStore = new TestApprovalStore();

    const events: string[] = [];
    eventBus.subscribeAll((event) => {
      events.push(event.eventType);
    });

    const engine = new SagaEngine(store, lockProvider, eventBus);
    engine.define(
      SagaBuilder.define('e2e-approval-events')
        .step({ name: 'step-1', execute: okStep({ ok: true }) })
        .step({
          name: 'approval-step',
          requiresManualApproval: 'admin',
          execute: ApprovalStep.createHandler(approvalStore, 'admin', eventBus),
        }),
    );

    const result = await engine.run('e2e-approval-events');

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.status).toBe(SagaStatus.COMPLETED);
    }

    expect(events).toContain('MANUAL_APPROVAL_REQUIRED');
    expect(events).toContain('SAGA_COMPLETED');
  });

  it('should complete approval saga successfully', async () => {
    const store = createRealStore();
    const lockProvider = createRealLockProvider();
    const eventBus = createRealEventBus();
    const approvalStore = new TestApprovalStore();

    const engine = new SagaEngine(store, lockProvider, eventBus);
    engine.define(
      SagaBuilder.define('e2e-approval-output')
        .step({
          name: 'approval-step',
          requiresManualApproval: 'group-a',
          execute: ApprovalStep.createHandler(approvalStore, 'group-a', eventBus),
        }),
    );

    const result = await engine.run('e2e-approval-output');

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.status).toBe(SagaStatus.COMPLETED);
    }
  });
});
