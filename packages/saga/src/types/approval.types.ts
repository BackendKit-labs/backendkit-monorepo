// ---------------------------------------------------------------------------
// @backendkit-labs/saga — src/types/approval.types.ts
//
// Human approval types: ApprovalStore interface, ApprovalStatus enum,
// ApprovalRequest interface.
// ---------------------------------------------------------------------------

import type { SagaId } from './saga.types';
import type { SagaResult } from './error.types';

// ---- ApprovalStatus ----

export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'DENIED';

// ---- ApprovalRequest ----

export interface ApprovalRequest {
  id: string;                    // unique approval request id
  stepName: string;
  sagaId: SagaId;
  group: string;                 // approval group (e.g. 'manager-group')
  status: ApprovalStatus;
  context: Record<string, unknown>;
  reason?: string;
  createdAt: number;             // timestamp ms
  resolvedAt?: number;           // timestamp ms
}

// ---- ApprovalStore ----

export interface ApprovalStore {
  requestApproval(request: ApprovalRequest): SagaResult<void>;
  approve(approvalId: string, approvedBy: string, reason?: string): SagaResult<void>;
  deny(approvalId: string, approvedBy: string, reason?: string): SagaResult<void>;
  getStatus(approvalId: string): SagaResult<ApprovalStatus>;
  listPending(): SagaResult<ApprovalRequest[]>;
}
