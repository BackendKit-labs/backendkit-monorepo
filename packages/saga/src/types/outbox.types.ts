// ---------------------------------------------------------------------------
// @backendkit-labs/saga — src/types/outbox.types.ts
//
// OutboxAdapter interface for reliable event publication.
// ---------------------------------------------------------------------------

import type { SagaEvent } from './events.types';
import type { SagaResult } from './error.types';

// ---- OutboxAdapter ----

export interface OutboxAdapter {
  enqueue(event: SagaEvent): SagaResult<void>;
  publishPending(): SagaResult<number>;  // returns count of published events
  remove(eventId: string): SagaResult<void>;
}
