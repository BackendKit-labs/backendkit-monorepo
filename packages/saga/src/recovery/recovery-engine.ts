// ---------------------------------------------------------------------------
// @backendkit-labs/saga — src/recovery/recovery-engine.ts
//
// RecoveryEngine: scans for crashed sagas (RUNNING/STEP_EXECUTING/COMPENSATING
// with expired lock), re-acquires the lock, and resumes execution.
// ---------------------------------------------------------------------------

import { ok, isFail, isOk } from '@backendkit-labs/result';
import type { SagaResult } from '../types/error.types';
import type { SagaState, SagaFilter } from '../types/saga.types';
import { SagaStatus } from '../types/saga.types';
import type { SagaStore } from '../persistence/saga-store.interface';
import type { SagaEngine } from '../core/saga-engine';
import { currentTimestamp } from '../utils/time';

const CRASHED_STATUSES: SagaStatus[] = [
  SagaStatus.RUNNING,
  SagaStatus.STEP_EXECUTING,
  SagaStatus.COMPENSATING,
];

// Sagas waiting for an external signal that has a deadline
const WAITING_STATUS = SagaStatus.WAITING_FOR_EVENT;

export class RecoveryEngine {
  constructor(
    private readonly store: SagaStore,
    private readonly engine: SagaEngine,
  ) {}

  async recoverCrashedSagas(): Promise<SagaResult<number>> {
    let recoveredCount = 0;

    for (const status of CRASHED_STATUSES) {
      const filter: SagaFilter = { status };
      const listResult = await this.store.list(filter);

      if (isFail(listResult)) {
        return listResult as unknown as SagaResult<number>;
      }

      const sagas = listResult.value;
      const now = currentTimestamp();

      for (const saga of sagas) {
        // Only recover sagas with expired locks
        if (saga.lockExpiresAt !== undefined && saga.lockExpiresAt > now) {
          continue;
        }

        const recoveryResult = await this.recoverSaga(saga);
        if (isOk(recoveryResult)) {
          recoveredCount++;
        }
      }
    }

    return ok(recoveredCount);
  }

  async recoverTimedOutWaits(): Promise<SagaResult<number>> {
    const listResult = await this.store.list({ status: WAITING_STATUS });
    if (isFail(listResult)) {
      return listResult as unknown as SagaResult<number>;
    }

    const now = currentTimestamp();
    let expiredCount = 0;

    for (const saga of listResult.value) {
      // Only expire sagas that have a deadline and it has passed
      if (saga.waitExpiresAt === undefined || saga.waitExpiresAt > now) {
        continue;
      }

      const result = await this.engine.expireWait(saga.id);
      if (isOk(result)) {
        expiredCount++;
      }
    }

    return ok(expiredCount);
  }

  private async recoverSaga(saga: SagaState): Promise<SagaResult<void>> {
    const resumeResult = await this.engine.resume(saga.id);

    if (isFail(resumeResult)) {
      // Definition not loaded in this process — skip silently (rolling deploy, etc.)
      if ('category' in resumeResult.error && resumeResult.error.category === 'DEFINITION_NOT_REGISTERED') {
        return ok(undefined);
      }
      return resumeResult as unknown as SagaResult<void>;
    }

    return ok(undefined);
  }
}
