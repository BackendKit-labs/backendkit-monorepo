// ---------------------------------------------------------------------------
// @backendkit-labs/saga -- tests/integration/circuit-breaker-adapter.test.ts
//
// Integration tests for SagaCircuitBreaker, backed by the real
// @backendkit-labs/circuit-breaker state machine.
// ---------------------------------------------------------------------------

import { ok, fail, isOk, isFail } from '@backendkit-labs/result';
import { SagaCircuitBreaker } from '../../src/integration/circuit-breaker-adapter';
import type { SagaResult, StepError, SagaEngineError } from '../../src/types/error.types';

describe('SagaCircuitBreaker', () => {
  describe('execute() with success', () => {
    it('should return ok when the function succeeds', async () => {
      const cb = new SagaCircuitBreaker();
      const result = await cb.execute(async () => ok({ done: true }) as SagaResult<unknown>);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toEqual({ done: true });
      }
    });

    it('should stay closed after multiple consecutive successes', async () => {
      const cb = new SagaCircuitBreaker({ minimumCalls: 1, slidingWindowSize: 5 });

      for (let i = 0; i < 5; i++) {
        const result = await cb.execute(async () => ok({ i }) as SagaResult<unknown>);
        expect(isOk(result)).toBe(true);
      }

      expect(await cb.getState()).toBe('closed');
      expect((await cb.getMetrics()).failedCalls).toBe(0);
    });
  });

  describe('execute() with INFRASTRUCTURE_ERROR', () => {
    it('should open the circuit once failureThreshold is exceeded', async () => {
      const cb = new SagaCircuitBreaker({ failureThreshold: 50, minimumCalls: 2, slidingWindowSize: 2 });

      const err: StepError = { type: 'INFRASTRUCTURE_ERROR', step: 'test', cause: new Error('timeout'), code: 'T' };

      const r1 = await cb.execute(async () => fail(err) as SagaResult<unknown>);
      const r2 = await cb.execute(async () => fail(err) as SagaResult<unknown>);
      expect(isFail(r1)).toBe(true);
      expect(isFail(r2)).toBe(true);

      expect(await cb.getState()).toBe('open');
      expect((await cb.getMetrics()).failedCalls).toBe(2);
    });

    it('should fail fast with SAGA_INTERNAL when the circuit is open', async () => {
      const cb = new SagaCircuitBreaker({ failureThreshold: 1, minimumCalls: 1, slidingWindowSize: 1 });

      const err: StepError = { type: 'INFRASTRUCTURE_ERROR', step: 'test', cause: new Error('fail'), code: 'F' };

      await cb.execute(async () => fail(err) as SagaResult<unknown>);
      expect(await cb.getState()).toBe('open');

      const r2 = await cb.execute(async () => ok({}) as SagaResult<unknown>);
      expect(isFail(r2)).toBe(true);
      if (isFail(r2)) {
        expect((r2.error as SagaEngineError).category).toBe('SAGA_INTERNAL');
      }
    });

    it('should transition to half-open after openTimeoutMs and allow a probe through', async () => {
      const cb = new SagaCircuitBreaker({
        failureThreshold: 1, minimumCalls: 1, slidingWindowSize: 1, openTimeoutMs: 50,
      });

      const err: StepError = { type: 'INFRASTRUCTURE_ERROR', step: 'test', cause: new Error('fail'), code: 'F' };

      await cb.execute(async () => fail(err) as SagaResult<unknown>);
      expect(await cb.getState()).toBe('open');

      await new Promise((r) => setTimeout(r, 60));

      const r2 = await cb.execute(async () => ok({ recovered: true }) as SagaResult<unknown>);
      expect(isOk(r2)).toBe(true);
      if (isOk(r2)) {
        expect(r2.value).toEqual({ recovered: true });
      }
    }, 2000);
  });

  describe('business vs infrastructure classification', () => {
    it('should NOT count BUSINESS_ERROR against the circuit', async () => {
      const cb = new SagaCircuitBreaker({ failureThreshold: 1, minimumCalls: 1, slidingWindowSize: 1 });

      const err: StepError = { type: 'BUSINESS_ERROR', step: 'test', cause: new Error('invalid'), code: 'B' };

      await cb.execute(async () => fail(err) as SagaResult<unknown>);

      expect(await cb.getState()).toBe('closed');
      expect((await cb.getMetrics()).failedCalls).toBe(0);
    });

    it('should NOT count STEP_TIMEOUT against the circuit', async () => {
      const cb = new SagaCircuitBreaker({ failureThreshold: 1, minimumCalls: 1, slidingWindowSize: 1 });

      const err: StepError = { type: 'STEP_TIMEOUT', step: 'test', timeoutMs: 5000 };

      await cb.execute(async () => fail(err) as SagaResult<unknown>);

      expect(await cb.getState()).toBe('closed');
    });

    it('should open the circuit on PERSISTENCE_ERROR', async () => {
      const cb = new SagaCircuitBreaker({ failureThreshold: 1, minimumCalls: 1, slidingWindowSize: 1 });

      const err: SagaEngineError = { category: 'PERSISTENCE_ERROR', cause: new Error('DB down') };

      await cb.execute(async () => fail(err) as SagaResult<unknown>);

      expect(await cb.getState()).toBe('open');
    });

    it('should open the circuit on LOCK_ACQUISITION_FAILED', async () => {
      const cb = new SagaCircuitBreaker({ failureThreshold: 1, minimumCalls: 1, slidingWindowSize: 1 });

      const err: SagaEngineError = { category: 'LOCK_ACQUISITION_FAILED', lockKey: 'key' };

      await cb.execute(async () => fail(err) as SagaResult<unknown>);

      expect(await cb.getState()).toBe('open');
    });

    it('should NOT count other SagaEngineError categories against the circuit', async () => {
      const cb = new SagaCircuitBreaker({ failureThreshold: 1, minimumCalls: 1, slidingWindowSize: 1 });

      const err: SagaEngineError = { category: 'COMPENSATION_ERROR', step: 'test', cause: new Error('boom') };

      await cb.execute(async () => fail(err) as SagaResult<unknown>);

      expect(await cb.getState()).toBe('closed');
    });
  });

  describe('reset()', () => {
    it('should reset the circuit breaker to closed with cleared counters', async () => {
      const cb = new SagaCircuitBreaker({ failureThreshold: 1, minimumCalls: 1, slidingWindowSize: 1 });

      const err: StepError = { type: 'INFRASTRUCTURE_ERROR', step: 'test', cause: new Error('fail'), code: 'F' };
      await cb.execute(async () => fail(err) as SagaResult<unknown>);
      expect(await cb.getState()).toBe('open');

      await cb.reset();

      expect(await cb.getState()).toBe('closed');
      const metrics = await cb.getMetrics();
      expect(metrics.failedCalls).toBe(0);
      expect(metrics.totalCalls).toBe(0);
    });
  });

  describe('getMetrics()', () => {
    it('should reflect calls made through execute()', async () => {
      const cb = new SagaCircuitBreaker({ minimumCalls: 1, slidingWindowSize: 5 });

      await cb.execute(async () => ok({}) as SagaResult<unknown>);
      const err: StepError = { type: 'BUSINESS_ERROR', step: 'test', cause: new Error('x'), code: 'X' };
      await cb.execute(async () => fail(err) as SagaResult<unknown>);

      const metrics = await cb.getMetrics();
      expect(metrics.totalCalls).toBe(2);
      // BUSINESS_ERROR is transparent to the circuit -- counted as a success.
      expect(metrics.successfulCalls).toBe(2);
      expect(metrics.failedCalls).toBe(0);
    });
  });
});
