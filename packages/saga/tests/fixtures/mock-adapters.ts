// ---------------------------------------------------------------------------
// @backendkit-labs/saga -- tests/fixtures/mock-adapters.ts
//
// Mock factories for SagaStore, LockProvider and SagaEventBus.
// All mocks return ok() by default and accept overrides per test.
// ---------------------------------------------------------------------------

import type { Mocked } from 'vitest';
import { ok } from '@backendkit-labs/result';
import type { SagaStore } from '../../src/persistence/saga-store.interface';
import type { SagaState, SagaId } from '../../src/types/saga.types';
import type { LockProvider } from '../../src/types/lock.types';
import type { SagaEventBus } from '../../src/types/events.types';
import type { SagaResult } from '../../src/types/error.types';
import { SagaStatus, StepStatus } from '../../src/types/saga.types';

// =====================================================================
// Default state factory
// =====================================================================

export function defaultSagaState(overrides?: Partial<SagaState>): SagaState {
  return {
    id: 'saga-id-default' as SagaId,
    sagaType: 'test-saga',
    status: SagaStatus.PENDING,
    correlationId: 'corr-default',
    steps: [{ name: 'step-1', status: StepStatus.PENDING, attempt: 0 }],
    currentStepIndex: 0,
    createdAt: 1000,
    updatedAt: 1000,
    metadata: {},
    version: 1,
    ...overrides,
  };
}

// =====================================================================
// SagaStore mock
// =====================================================================

export function createMockStore(): Mocked<SagaStore> {
  const okVoid = ok(undefined) as unknown as SagaResult<void>;
  const okState = ok(defaultSagaState()) as unknown as SagaResult<SagaState>;
  const okArr = ok([]) as unknown as SagaResult<SagaState[]>;

  return {
    save: vi.fn().mockResolvedValue(okVoid),
    load: vi.fn().mockResolvedValue(okState),
    list: vi.fn().mockResolvedValue(okArr),
    delete: vi.fn().mockResolvedValue(okVoid),
  };
}

// =====================================================================
// LockProvider mock
// =====================================================================

export function createMockLockProvider(): Mocked<LockProvider> {
  const okBool = (val: boolean): SagaResult<boolean> => ok(val) as unknown as SagaResult<boolean>;
  const okVoid = ok(undefined) as unknown as SagaResult<void>;

  return {
    acquire: vi.fn().mockResolvedValue(okBool(true)),
    release: vi.fn().mockResolvedValue(okVoid),
    isLocked: vi.fn().mockResolvedValue(okBool(false)),
  };
}

// =====================================================================
// SagaEventBus mock
// =====================================================================

export function createMockEventBus(): Mocked<SagaEventBus> {
  const mockUnsubscribe = vi.fn();
  const mockSubscribeAllUnsubscribe = vi.fn();

  return {
    publish: vi.fn().mockResolvedValue(undefined),
    subscribe: vi.fn().mockReturnValue(mockUnsubscribe),
    unsubscribe: vi.fn().mockImplementation(() => {}),
    subscribeAll: vi.fn().mockReturnValue(mockSubscribeAllUnsubscribe),
  };
}

// =====================================================================
// InMemory implementations for E2E tests (no mocks, real behavior)
// =====================================================================

import { InMemoryStore } from '../../src/persistence/in-memory-store';
import { InMemoryLock } from '../../src/lock/in-memory-lock';
import { SagaEventBusImpl } from '../../src/events/saga-event-bus';

export function createRealStore(): InMemoryStore {
  return new InMemoryStore();
}

export function createRealLockProvider(): InMemoryLock {
  return new InMemoryLock();
}

export function createRealEventBus(): SagaEventBusImpl {
  return new SagaEventBusImpl();
}
