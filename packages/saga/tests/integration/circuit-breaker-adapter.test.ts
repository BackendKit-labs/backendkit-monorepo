// ---------------------------------------------------------------------------
// @backendkit-labs/saga -- tests/integration/circuit-breaker-adapter.test.ts
//
// Integration tests for SagaCircuitBreaker.
// ---------------------------------------------------------------------------

import { ok, fail, isOk, isFail } from '@backendkit-labs/result';
import { SagaCircuitBreaker } from '../../src/integration/circuit-breaker-adapter';
import type { SagaResult, StepError, SagaEngineError } from '../../src/types/error.types';

describe('SagaCircuitBreaker', () => {
  const config = { failureThreshold: 2, successThreshold: 2, timeoutMs: 100 };

  describe('execute() with success', () => {
    it('should return ok when the function succeeds', async () => {
      const cb = new SagaCircuitBreaker(config);
      const result = await cb.execute(async () => ok({ done: true }) as SagaResult<unknown>);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toEqual({ done: true });
      }
    });

    it('should return ok after multiple consecutive successes', async () => {
      const cb = new SagaCircuitBreaker(config);

      for (let i = 0; i < 5; i++) {
        const result = await cb.execute(async () => ok({ i }) as SagaResult<unknown>);
        expect(isOk(result)).toBe(true);
      }

      // State should show success count incrementing
      const state = cb.getState();
      expect(state.opened).toBe(false);
      expect(state.failureCount).toBe(0);
    });
  });

  describe('execute() with INFRASTRUCTURE_ERROR', () => {
    it('should open the circuit after failureThreshold errors', async () => {
      const cb = new SagaCircuitBreaker({ failureThreshold: 2, successThreshold: 1, timeoutMs: 5000 });

      const err: StepError = { type: 'INFRASTRUCTURE_ERROR', step: 'test', cause: new Error('timeout'), code: 'T' };

      // First two calls: failures
      const r1 = await cb.execute(async () => fail(err) as SagaResult<unknown>);
      const r2 = await cb.execute(async () => fail(err) as SagaResult<unknown>);
      expect(isFail(r1)).toBe(true);
      expect(isFail(r2)).toBe(true);

      // Circuit should be open
      const stateAfter = cb.getState();
      expect(stateAfter.opened).toBe(true);
      expect(stateAfter.failureCount).toBe(2);
    });

    it('should fail fast with SAGA_INTERNAL when circuit is open', async () => {
      const cb = new SagaCircuitBreaker({ failureThreshold: 1, successThreshold: 1, timeoutMs: 5000 });

      const err: StepError = { type: 'INFRASTRUCTURE_ERROR', step: 'test', cause: new Error('fail'), code: 'F' };

      // Trip the circuit
      await cb.execute(async () => fail(err) as SagaResult<unknown>);

      // Circuit is open, should fail fast
      const r2 = await cb.execute(async () => ok({}) as SagaResult<unknown>);
      expect(isFail(r2)).toBe(true);
      if (isFail(r2)) {
        expect((r2.error as SagaEngineError).category).toBe('SAGA_INTERNAL');
      }
    });

    it('should transition to half-open after timeoutMs', async () => {
      const cb = new SagaCircuitBreaker({ failureThreshold: 1, successThreshold: 1, timeoutMs: 50 });

      const err: StepError = { type: 'INFRASTRUCTURE_ERROR', step: 'test', cause: new Error('fail'), code: 'F' };

      // Trip the circuit
      await cb.execute(async () => fail(err) as SagaResult<unknown>);
      expect(cb.getState().opened).toBe(true);

      // Wait for timeout
      await new Promise((r) => setTimeout(r, 60));

      // Should allow request (half-open)
      const r2 = await cb.execute(async () => ok({ recovered: true }) as SagaResult<unknown>);
      expect(isOk(r2)).toBe(true);
      if (isOk(r2)) {
        expect(r2.value).toEqual({ recovered: true });
      }
    });
  });

  describe('BUSINESS_ERROR', () => {
    it('should NOT open the circuit on BUSINESS_ERROR', async () => {
      const cb = new SagaCircuitBreaker({ failureThreshold: 1, successThreshold: 1, timeoutMs: 5000 });

      const err: StepError = { type: 'BUSINESS_ERROR', step: 'test', cause: new Error('invalid'), code: 'B' };

      await cb.execute(async () => fail(err) as SagaResult<unknown>);

      // Circuit should NOT be open (BUSINESS_ERROR is not retryable)
      const state = cb.getState();
      expect(state.opened).toBe(false);
      expect(state.failureCount).toBe(0);
    });
  });

  describe('PERSISTENCE_ERROR', () => {
    it('should open the circuit on PERSISTENCE_ERROR', async () => {
      const cb = new SagaCircuitBreaker({ failureThreshold: 1, successThreshold: 1, timeoutMs: 5000 });

      const err: SagaEngineError = { category: 'PERSISTENCE_ERROR', cause: new Error('DB down') };

      await cb.execute(async () => fail(err) as SagaResult<unknown>);

      const state = cb.getState();
      expect(state.opened).toBe(true);
    });
  });

  describe('LOCK_ACQUISITION_FAILED', () => {
    it('should open the circuit on LOCK_ACQUISITION_FAILED', async () => {
      const cb = new SagaCircuitBreaker({ failureThreshold: 1, successThreshold: 1, timeoutMs: 5000 });

      const err: SagaEngineError = { category: 'LOCK_ACQUISITION_FAILED', lockKey: 'key' };

      await cb.execute(async () => fail(err) as SagaResult<unknown>);

      const state = cb.getState();
      expect(state.opened).toBe(true);
    });
  });

  describe('reset()', () => {
    it('should reset the circuit breaker state', async () => {
      const cb = new SagaCircuitBreaker({ failureThreshold: 1, successThreshold: 1, timeoutMs: 5000 });

      const err: StepError = { type: 'INFRASTRUCTURE_ERROR', step: 'test', cause: new Error('fail'), code: 'F' };
      await cb.execute(async () => fail(err) as SagaResult<unknown>);

      expect(cb.getState().opened).toBe(true);

      cb.reset();

      const state = cb.getState();
      expect(state.opened).toBe(false);
      expect(state.failureCount).toBe(0);
      expect(state.successCount).toBe(0);
    });
  });

  describe('getState()', () => {
    it('should return a copy of the current state', () => {
      const cb = new SagaCircuitBreaker(config);
      const state = cb.getState();

      expect(state).toEqual({
        opened: false,
        failureCount: 0,
        successCount: 0,
        lastFailureAt: undefined,
      });

      // Mutating the returned state should not affect internal state
      state.opened = true;
      expect(cb.getState().opened).toBe(false);
    });
  });
});
