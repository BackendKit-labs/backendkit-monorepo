// ---------------------------------------------------------------------------
// @backendkit-labs/saga — src/recovery/saga-scanner.ts
//
// SagaScanner: periodically runs the RecoveryEngine to recover crashed sagas.
// Uses setInterval with proper cleanup via stop().
// ---------------------------------------------------------------------------

import { RecoveryEngine } from './recovery-engine';

export class SagaScanner {
  private timerId: ReturnType<typeof setInterval> | undefined;
  private readonly recoveryEngine: RecoveryEngine;

  constructor(
    store: import('../persistence/saga-store.interface').SagaStore,
    engine: import('../core/saga-engine').SagaEngine,
    private readonly intervalMs: number,
  ) {
    this.recoveryEngine = new RecoveryEngine(store, engine);
  }

  start(): void {
    if (this.timerId !== undefined) {
      return; // Already running
    }

    this.timerId = setInterval(() => {
      this.recoveryEngine.recoverCrashedSagas().catch((error: unknown) => {
        console.error('[SagaScanner] Recovery scan failed:', error);
      });
    }, this.intervalMs);
  }

  stop(): void {
    if (this.timerId !== undefined) {
      clearInterval(this.timerId);
      this.timerId = undefined;
    }
  }
}
