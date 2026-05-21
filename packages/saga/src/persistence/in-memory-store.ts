// ---------------------------------------------------------------------------
// @backendkit-labs/saga — src/persistence/in-memory-store.ts
//
// In-memory SagaStore implementation: Map<SagaId, SagaState>.
// Supports upsert with optimistic locking (version check), filtering,
// and pagination via limit/offset.
// ---------------------------------------------------------------------------

import { ok, fail } from '@backendkit-labs/result';
import type { SagaState, SagaFilter, SagaId } from '../types/saga.types';
import type { SagaResult } from '../types/error.types';
import type { SagaStore } from './saga-store.interface';

export class InMemoryStore implements SagaStore {
  private readonly store = new Map<string, SagaState>();

  async save(state: SagaState): Promise<SagaResult<void>> {
    const existing = this.store.get(state.id);

    if (existing !== undefined) {
      if (existing.version !== state.version - 1) {
        return fail({
          category: 'PERSISTENCE_ERROR',
          cause: new Error(
            `Version conflict for saga ${state.id}: ` +
            `stored version=${existing.version}, incoming version=${state.version - 1}`,
          ),
        });
      }
    }

    this.store.set(state.id, { ...state });
    return ok(undefined);
  }

  async load(sagaId: SagaId): Promise<SagaResult<SagaState>> {
    const state = this.store.get(sagaId);

    if (state === undefined) {
      return fail({
        category: 'SAGA_NOT_FOUND',
        sagaId,
      });
    }

    return ok({ ...state });
  }

  async list(filter?: SagaFilter): Promise<SagaResult<SagaState[]>> {
    let results = Array.from(this.store.values());

    if (filter !== undefined) {
      if (filter.status !== undefined) {
        results = results.filter((s) => s.status === filter.status);
      }
      if (filter.sagaType !== undefined) {
        results = results.filter((s) => s.sagaType === filter.sagaType);
      }
      if (filter.createdAfter !== undefined) {
        results = results.filter((s) => s.createdAt >= filter.createdAfter!);
      }
      if (filter.createdBefore !== undefined) {
        results = results.filter((s) => s.createdAt <= filter.createdBefore!);
      }

      // Sort by createdAt descending (newest first)
      results.sort((a, b) => b.createdAt - a.createdAt);

      const offset = filter.offset ?? 0;
      const limit = filter.limit ?? results.length;

      results = results.slice(offset, offset + limit);
    }

    return ok(results.map((s) => ({ ...s })));
  }

  async delete(sagaId: SagaId): Promise<SagaResult<void>> {
    if (!this.store.has(sagaId)) {
      return fail({
        category: 'SAGA_NOT_FOUND',
        sagaId,
      });
    }

    this.store.delete(sagaId);
    return ok(undefined);
  }
}
