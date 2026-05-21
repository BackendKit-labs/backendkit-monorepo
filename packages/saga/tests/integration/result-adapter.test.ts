// ---------------------------------------------------------------------------
// @backendkit-labs/saga -- tests/integration/result-adapter.test.ts
//
// Integration tests for result-adapter.ts constructors, classifiers and
// combinators.
// ---------------------------------------------------------------------------

import { ok, fail, isOk, isFail } from '@backendkit-labs/result';
import {
  businessError,
  infrastructureError,
  stepTimeout,
  compensationError,
  retryExhausted,
  persistenceError,
  lockAcquisitionFailed,
  sagaNotFoundError,
  invalidTransition,
  sagaInternal,
  isBusinessError,
  isInfrastructureError,
  isStepTimeout,
  isCompensationError,
  isRetryExhausted,
  isPersistenceError,
  isLockError,
  isTransientError,
  chainSteps,
  mapResult,
  tapResult,
  recoverResult,
} from '../../src/integration/result-adapter';
import type { SagaError } from '../../src/types/error.types';
import type { SagaId } from '../../src/types/saga.types';

// =====================================================================
// Constructor tests
// =====================================================================

describe('result-adapter: constructors', () => {
  describe('businessError', () => {
    it('should create a StepError with type BUSINESS_ERROR', () => {
      const err = businessError('order-step', new Error('Invalid order'), 'INVALID_ORDER');

      expect(err.type).toBe('BUSINESS_ERROR');
      expect(err.step).toBe('order-step');
      if (err.type === 'BUSINESS_ERROR') {
        expect(err.cause.message).toBe('Invalid order');
        expect(err.code).toBe('INVALID_ORDER');
      }
    });
  });

  describe('infrastructureError', () => {
    it('should create a StepError with type INFRASTRUCTURE_ERROR', () => {
      const err = infrastructureError('db-query', new Error('Connection refused'), 'DB_ERR');

      expect(err.type).toBe('INFRASTRUCTURE_ERROR');
      expect(err.step).toBe('db-query');
      if (err.type === 'INFRASTRUCTURE_ERROR') {
        expect(err.cause.message).toBe('Connection refused');
        expect(err.code).toBe('DB_ERR');
      }
    });
  });

  describe('stepTimeout', () => {
    it('should create a StepError with type STEP_TIMEOUT', () => {
      const err = stepTimeout('slow-step', 5000);

      expect(err.type).toBe('STEP_TIMEOUT');
      expect(err.step).toBe('slow-step');
      if (err.type === 'STEP_TIMEOUT') {
        expect(err.timeoutMs).toBe(5000);
      }
    });
  });

  describe('compensationError', () => {
    it('should create a SagaEngineError with category COMPENSATION_ERROR', () => {
      const err = compensationError('step-1', new Error('rollback failed'));

      expect(err.category).toBe('COMPENSATION_ERROR');
      if (err.category === 'COMPENSATION_ERROR') {
        expect(err.step).toBe('step-1');
        expect(err.cause.message).toBe('rollback failed');
      }
    });
  });

  describe('retryExhausted', () => {
    it('should create a SagaEngineError with category RETRY_EXHAUSTED', () => {
      const err = retryExhausted('step-1', 5);

      expect(err.category).toBe('RETRY_EXHAUSTED');
      if (err.category === 'RETRY_EXHAUSTED') {
        expect(err.step).toBe('step-1');
        expect(err.attempts).toBe(5);
      }
    });
  });

  describe('persistenceError', () => {
    it('should create a SagaEngineError with category PERSISTENCE_ERROR', () => {
      const err = persistenceError(new Error('DB is down'));

      expect(err.category).toBe('PERSISTENCE_ERROR');
      if (err.category === 'PERSISTENCE_ERROR') {
        expect(err.cause.message).toBe('DB is down');
      }
    });
  });

  describe('lockAcquisitionFailed', () => {
    it('should create a SagaEngineError with category LOCK_ACQUISITION_FAILED', () => {
      const err = lockAcquisitionFailed('saga:lock:42');

      expect(err.category).toBe('LOCK_ACQUISITION_FAILED');
      if (err.category === 'LOCK_ACQUISITION_FAILED') {
        expect(err.lockKey).toBe('saga:lock:42');
      }
    });
  });

  describe('sagaNotFoundError', () => {
    it('should create a SagaEngineError with category SAGA_NOT_FOUND', () => {
      const sagaId = 'saga-missing' as SagaId;
      const err = sagaNotFoundError(sagaId);

      expect(err.category).toBe('SAGA_NOT_FOUND');
      if (err.category === 'SAGA_NOT_FOUND') {
        expect(err.sagaId).toBe(sagaId);
      }
    });
  });

  describe('invalidTransition', () => {
    it('should create a SagaEngineError with category INVALID_TRANSITION', () => {
      const err = invalidTransition('COMPLETED', 'RUNNING');

      expect(err.category as string).toBe('INVALID_TRANSITION');
    });
  });

  describe('sagaInternal', () => {
    it('should create a SagaEngineError with category SAGA_INTERNAL', () => {
      const err = sagaInternal(new Error('Unexpected null reference'));

      expect(err.category).toBe('SAGA_INTERNAL');
      if (err.category === 'SAGA_INTERNAL') {
        expect(err.cause.message).toBe('Unexpected null reference');
      }
    });
  });
});

// =====================================================================
// Wrapping tests
// =====================================================================

describe('result-adapter: wrapping with ok/fail', () => {
  it('should wrap a value with ok() and extract via isOk', () => {
    const result = ok(42);
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value).toBe(42);
    }
  });

  it('should wrap an error with fail() and extract via isFail', () => {
    const err = businessError('test', new Error('nope'), 'ERR');
    const result = fail(err);
    expect(isFail(result)).toBe(true);
    if (isFail(result)) {
      expect(result.error.type).toBe('BUSINESS_ERROR');
    }
  });
});

// =====================================================================
// Classifiers tests
// =====================================================================

describe('result-adapter: classifiers', () => {
  it('should classify BUSINESS_ERROR correctly', () => {
    const err: SagaError = businessError('s', new Error('e'), 'C');
    expect(isBusinessError(err)).toBe(true);
    expect(isInfrastructureError(err)).toBe(false);
    expect(isStepTimeout(err)).toBe(false);
  });

  it('should classify INFRASTRUCTURE_ERROR correctly', () => {
    const err: SagaError = infrastructureError('s', new Error('e'), 'C');
    expect(isInfrastructureError(err)).toBe(true);
    expect(isBusinessError(err)).toBe(false);
    expect(isTransientError(err)).toBe(true);
  });

  it('should classify STEP_TIMEOUT correctly', () => {
    const err: SagaError = stepTimeout('s', 5000);
    expect(isStepTimeout(err)).toBe(true);
    expect(isBusinessError(err)).toBe(false);
    expect(isTransientError(err)).toBe(true);
  });

  it('should classify COMPENSATION_ERROR correctly', () => {
    const err: SagaError = compensationError('s', new Error('e'));
    expect(isCompensationError(err)).toBe(true);
  });

  it('should classify RETRY_EXHAUSTED correctly', () => {
    const err: SagaError = retryExhausted('s', 3);
    expect(isRetryExhausted(err)).toBe(true);
  });

  it('should classify PERSISTENCE_ERROR correctly', () => {
    const err: SagaError = persistenceError(new Error('e'));
    expect(isPersistenceError(err)).toBe(true);
    expect(isLockError(err)).toBe(false);
    expect(isTransientError(err)).toBe(true);
  });

  it('should classify LOCK_ACQUISITION_FAILED correctly', () => {
    const err: SagaError = lockAcquisitionFailed('key');
    expect(isLockError(err)).toBe(true);
    expect(isPersistenceError(err)).toBe(false);
    expect(isTransientError(err)).toBe(true);
  });

  it('should return false for unknown error type', () => {
    const err = { category: 'UNKNOWN' } as unknown as SagaError;
    expect(isBusinessError(err)).toBe(false);
    expect(isInfrastructureError(err)).toBe(false);
    expect(isStepTimeout(err)).toBe(false);
    expect(isCompensationError(err)).toBe(false);
    expect(isRetryExhausted(err)).toBe(false);
    expect(isPersistenceError(err)).toBe(false);
    expect(isLockError(err)).toBe(false);
    expect(isTransientError(err)).toBe(false);
  });
});

// =====================================================================
// Combinator tests
// =====================================================================

describe('result-adapter: combinators', () => {
  describe('chainSteps', () => {
    it('should chain two successful steps', async () => {
      const result = await chainSteps(
        async () => ok(10),
        async (input: number) => ok(input * 2),
      );

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toBe(20);
      }
    });

    it('should propagate failure from first step', async () => {
      const err = businessError('step1', new Error('fail'), 'ERR');
      const result = await chainSteps(
        async () => fail(err),
        async (_input: number) => ok(999),
      );

      expect(isFail(result)).toBe(true);
      if (isFail(result)) {
        expect(isBusinessError(result.error)).toBe(true);
      }
    });

    it('should propagate failure from second step', async () => {
      const err = businessError('step2', new Error('fail2'), 'ERR');
      const result = await chainSteps(
        async () => ok(10),
        async (_input: number) => fail(err),
      );

      expect(isFail(result)).toBe(true);
      if (isFail(result)) {
        expect(isBusinessError(result.error)).toBe(true);
      }
    });
  });

  describe('mapResult', () => {
    it('should transform a successful result', () => {
      const result = ok({ name: 'Alice', age: 30 });
      const transformed = mapResult(result, (v) => v.name);

      expect(isOk(transformed)).toBe(true);
      if (isOk(transformed)) {
        expect(transformed.value).toBe('Alice');
      }
    });

    it('should propagate a failed result unchanged', () => {
      const err = businessError('s', new Error('nope'), 'ERR');
      const result = fail(err);
      const transformed = mapResult(result, (v: unknown) => v);

      expect(isFail(transformed)).toBe(true);
      if (isFail(transformed)) {
        expect(transformed.error).toBe(err);
      }
    });
  });

  describe('tapResult', () => {
    it('should call side effect on success', () => {
      const sideEffect = vi.fn();
      const result = ok({ done: true });
      const tapped = tapResult(result, sideEffect);

      expect(sideEffect).toHaveBeenCalledWith({ done: true });
      expect(tapped).toBe(result);
    });

    it('should not call side effect on failure', () => {
      const sideEffect = vi.fn();
      const err = businessError('s', new Error('nope'), 'ERR');
      const result = fail(err);
      const tapped = tapResult(result, sideEffect);

      expect(sideEffect).not.toHaveBeenCalled();
      expect(tapped).toBe(result);
    });
  });

  describe('recoverResult', () => {
    it('should return value on success', async () => {
      const result = ok(42);
      const recovered = await recoverResult(result, async () => 0);

      expect(recovered).toBe(42);
    });

    it('should call fallback on failure', async () => {
      const err = businessError('s', new Error('nope'), 'ERR');
      const result = fail<number, SagaError>(err);
      const recovered = await recoverResult(result, async () => -1);

      expect(recovered).toBe(-1);
    });

    it('should support sync fallback', async () => {
      const err = businessError('s', new Error('nope'), 'ERR');
      const result = fail<number, SagaError>(err);
      const recovered = await recoverResult(result, () => 0);

      expect(recovered).toBe(0);
    });

    it('should pass the error to the fallback function', async () => {
      const err = businessError('s', new Error('nope'), 'ERR');
      const result = fail<number, SagaError>(err);
      const fallback = vi.fn(() => -1);
      await recoverResult(result, fallback);

      expect(fallback).toHaveBeenCalledWith(err);
    });
  });
});
