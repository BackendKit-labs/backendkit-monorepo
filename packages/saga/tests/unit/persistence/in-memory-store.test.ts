import { isOk, isFail } from '@backendkit-labs/result';
import { InMemoryStore } from '../../../src/persistence/in-memory-store';
import { SagaStatus } from '../../../src/types/saga.types';
import type { SagaState, SagaFilter } from '../../../src/types/saga.types';

function createState(overrides?: Partial<SagaState>): SagaState {
  return {
    id: 'saga-1' as any,
    sagaType: 'test',
    status: SagaStatus.PENDING,
    correlationId: 'corr-1',
    steps: [],
    currentStepIndex: 0,
    createdAt: 1000,
    updatedAt: 1000,
    metadata: {},
    version: 1,
    ...overrides,
  };
}

describe('InMemoryStore', () => {
  let store: InMemoryStore;

  beforeEach(() => {
    store = new InMemoryStore();
  });

  describe('save', () => {
    it('should save a new saga state', async () => {
      const state = createState({ id: 'saga-new' as any });
      const result = await store.save(state);

      expect(isOk(result)).toBe(true);
    });

    it('should update existing saga when version matches', async () => {
      const state = createState({ id: 'saga-update' as any, version: 1 });
      await store.save(state);

      const updated = { ...state, status: SagaStatus.RUNNING, version: 2 };
      const result = await store.save(updated);

      expect(isOk(result)).toBe(true);
    });

    it('should reject save with version conflict', async () => {
      const state = createState({ id: 'saga-conflict' as any, version: 1 });
      await store.save(state);

      // Try to save with wrong version (should be version 2 but we pass version 3)
      const badUpdate = { ...state, status: SagaStatus.RUNNING, version: 4 };
      const result = await store.save(badUpdate);

      expect(isFail(result)).toBe(true);
      if (isFail(result)) {
        expect((result.error as any).category).toBe('PERSISTENCE_ERROR');
        expect((result.error as any).cause.message).toContain('Version conflict');
      }
    });

    it('should store a deep copy of the state', async () => {
      const state = createState({ id: 'saga-copy' as any });
      await store.save(state);

      // Mutate original
      state.status = SagaStatus.RUNNING;
      state.version += 1;

      // Load should return original values
      const loadResult = await store.load('saga-copy' as any);
      expect(isOk(loadResult)).toBe(true);
      if (isOk(loadResult)) {
        expect(loadResult.value.status).toBe(SagaStatus.PENDING);
        expect(loadResult.value.version).toBe(1);
      }
    });

    it('should allow save with nullish previous when no existing state', async () => {
      const state = createState({ id: 'new-saga' as any, version: 1 });
      const result = await store.save(state);
      expect(isOk(result)).toBe(true);
    });
  });

  describe('load', () => {
    it('should return saga when it exists', async () => {
      const state = createState({ id: 'saga-load' as any });
      await store.save(state);

      const result = await store.load('saga-load' as any);
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.id).toBe('saga-load');
      }
    });

    it('should return SAGA_NOT_FOUND when saga does not exist', async () => {
      const result = await store.load('non-existent' as any);
      expect(isFail(result)).toBe(true);
      if (isFail(result)) {
        expect((result.error as any).category).toBe('SAGA_NOT_FOUND');
      }
    });

    it('should return a deep copy of the state', async () => {
      const state = createState({ id: 'saga-deep-copy' as any });
      await store.save(state);

      const loadResult = await store.load('saga-deep-copy' as any);
      expect(isOk(loadResult)).toBe(true);
      if (isOk(loadResult)) {
        const loaded = loadResult.value;
        loaded.status = SagaStatus.COMPLETED;

        // Reload should still show PENDING
        const reloadResult = await store.load('saga-deep-copy' as any);
        expect(isOk(reloadResult)).toBe(true);
        if (isOk(reloadResult)) {
          expect(reloadResult.value.status).toBe(SagaStatus.PENDING);
        }
      }
    });
  });

  describe('list', () => {
    beforeEach(async () => {
      const saga1 = createState({ id: 'saga-a' as any, sagaType: 'order', status: SagaStatus.RUNNING, createdAt: 100, updatedAt: 100 });
      const saga2 = createState({ id: 'saga-b' as any, sagaType: 'payment', status: SagaStatus.COMPLETED, createdAt: 200, updatedAt: 200 });
      const saga3 = createState({ id: 'saga-c' as any, sagaType: 'order', status: SagaStatus.FAILED, createdAt: 300, updatedAt: 300 });
      const saga4 = createState({ id: 'saga-d' as any, sagaType: 'order', status: SagaStatus.RUNNING, createdAt: 400, updatedAt: 400 });

      await store.save(saga1);
      await store.save(saga2);
      await store.save(saga3);
      await store.save(saga4);
    });

    it('should return all sagas when no filter', async () => {
      const result = await store.list();
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toHaveLength(4);
      }
    });

    it('should filter by status', async () => {
      const filter: SagaFilter = { status: SagaStatus.RUNNING };
      const result = await store.list(filter);
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toHaveLength(2);
        result.value.forEach((s) => expect(s.status).toBe(SagaStatus.RUNNING));
      }
    });

    it('should filter by sagaType', async () => {
      const filter: SagaFilter = { sagaType: 'order' };
      const result = await store.list(filter);
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toHaveLength(3);
        result.value.forEach((s) => expect(s.sagaType).toBe('order'));
      }
    });

    it('should filter by createdAfter', async () => {
      const filter: SagaFilter = { createdAfter: 250 };
      const result = await store.list(filter);
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        // saga-c (300), saga-d (400)
        expect(result.value).toHaveLength(2);
      }
    });

    it('should filter by createdBefore', async () => {
      const filter: SagaFilter = { createdBefore: 250 };
      const result = await store.list(filter);
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        // saga-a (100), saga-b (200)
        expect(result.value).toHaveLength(2);
      }
    });

    it('should combine multiple filters', async () => {
      const filter: SagaFilter = {
        sagaType: 'order',
        status: SagaStatus.RUNNING,
      };
      const result = await store.list(filter);
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toHaveLength(2);
      }
    });

    it('should support pagination with limit', async () => {
      const filter: SagaFilter = { limit: 2 };
      const result = await store.list(filter);
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toHaveLength(2);
      }
    });

    it('should support pagination with offset', async () => {
      const filter: SagaFilter = { offset: 2 };
      const result = await store.list(filter);
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toHaveLength(2);
      }
    });

    it('should support offset + limit', async () => {
      const filter: SagaFilter = { offset: 1, limit: 2 };
      const result = await store.list(filter);
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toHaveLength(2);
      }
    });

    it('should return results sorted by createdAt descending (newest first) with any filter', async () => {
      // Sort only happens when filter is provided (even empty filter triggers sort)
      const filter: SagaFilter = {};
      const result = await store.list(filter);
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value[0].createdAt).toBeGreaterThanOrEqual(result.value[1].createdAt);
        expect(result.value[1].createdAt).toBeGreaterThanOrEqual(result.value[2].createdAt);
        expect(result.value[2].createdAt).toBeGreaterThanOrEqual(result.value[3].createdAt);
      }
    });

    it('should return empty array when no sagas match filter', async () => {
      const filter: SagaFilter = { status: SagaStatus.PENDING };
      const result = await store.list(filter);
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toHaveLength(0);
      }
    });

    it('should return empty array when offset exceeds total', async () => {
      const filter: SagaFilter = { offset: 100 };
      const result = await store.list(filter);
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toHaveLength(0);
      }
    });

    it('should return deep copies', async () => {
      const result = await store.list();
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        const first = result.value[0];
        first.status = SagaStatus.COMPLETED;

        // Re-list should still have original status
        const result2 = await store.list();
        expect(isOk(result2)).toBe(true);
        if (isOk(result2)) {
          const reloaded = result2.value.find((s) => s.id === first.id);
          expect(reloaded).toBeDefined();
          expect(reloaded!.status).not.toBe(SagaStatus.COMPLETED);
        }
      }
    });

    it('should handle empty store gracefully', async () => {
      const emptyStore = new InMemoryStore();
      const result = await emptyStore.list();
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toEqual([]);
      }
    });
  });

  describe('delete', () => {
    it('should delete an existing saga', async () => {
      const state = createState({ id: 'saga-del' as any });
      await store.save(state);

      const result = await store.delete('saga-del' as any);
      expect(isOk(result)).toBe(true);

      // Verify it's gone
      const loadResult = await store.load('saga-del' as any);
      expect(isFail(loadResult)).toBe(true);
    });

    it('should return SAGA_NOT_FOUND when deleting non-existent saga', async () => {
      const result = await store.delete('non-existent' as any);
      expect(isFail(result)).toBe(true);
      if (isFail(result)) {
        expect((result.error as any).category).toBe('SAGA_NOT_FOUND');
      }
    });
  });
});
