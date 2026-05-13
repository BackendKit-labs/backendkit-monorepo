import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  CircuitBreaker,
  CircuitBreakerState,
  CircuitBreakerOpenError,
} from '../../src/circuit-breaker/circuit-breaker.js';
import type { CircuitBreakerConfig } from '../../src/circuit-breaker/circuit-breaker.js';

class BusinessError extends Error {}
class InfraError extends Error {}

const makeConfig = (overrides: Partial<CircuitBreakerConfig> = {}): CircuitBreakerConfig => ({
  name:              'test',
  failureThreshold:  50,
  slowCallThreshold: 100,
  slowCallDurationMs: 500,
  minimumCalls:      3,
  slidingWindowSize: 5,
  halfOpenMaxCalls:  2,
  openTimeoutMs:     200,
  isFailure:         () => true,
  ...overrides,
});

const fail = () => Promise.reject(new InfraError('infra'));
const succeed = () => Promise.resolve('ok');

describe('CircuitBreaker — state machine', () => {
  it('starts CLOSED', () => {
    const cb = new CircuitBreaker(makeConfig());
    expect(cb.getState()).toBe(CircuitBreakerState.CLOSED);
  });

  it('opens after failureThreshold is exceeded', async () => {
    const cb = new CircuitBreaker(makeConfig({ failureThreshold: 50, minimumCalls: 2, slidingWindowSize: 2 }));
    await expect(cb.execute(fail)).rejects.toThrow(InfraError);
    await expect(cb.execute(fail)).rejects.toThrow(InfraError);
    expect(cb.getState()).toBe(CircuitBreakerState.OPEN);
  });

  it('does not open before minimumCalls is reached', async () => {
    const cb = new CircuitBreaker(makeConfig({ failureThreshold: 50, minimumCalls: 5, slidingWindowSize: 5 }));
    await expect(cb.execute(fail)).rejects.toThrow();
    await expect(cb.execute(fail)).rejects.toThrow();
    expect(cb.getState()).toBe(CircuitBreakerState.CLOSED);
  });

  it('throws CircuitBreakerOpenError when OPEN', async () => {
    const cb = new CircuitBreaker(makeConfig({ minimumCalls: 1, slidingWindowSize: 1, failureThreshold: 1 }));
    await expect(cb.execute(fail)).rejects.toThrow(InfraError);
    await expect(cb.execute(succeed)).rejects.toThrow(CircuitBreakerOpenError);
  });

  it('transitions OPEN → HALF_OPEN after openTimeoutMs', async () => {
    const cb = new CircuitBreaker(makeConfig({ minimumCalls: 1, slidingWindowSize: 1, failureThreshold: 1, openTimeoutMs: 50 }));
    await expect(cb.execute(fail)).rejects.toThrow();
    expect(cb.getState()).toBe(CircuitBreakerState.OPEN);
    await new Promise(r => setTimeout(r, 80));
    expect(cb.getState()).toBe(CircuitBreakerState.HALF_OPEN);
  }, 2000);

  it('transitions HALF_OPEN → CLOSED after halfOpenMaxCalls succeed', async () => {
    const cb = new CircuitBreaker(makeConfig({ minimumCalls: 1, slidingWindowSize: 1, failureThreshold: 1, openTimeoutMs: 50, halfOpenMaxCalls: 2 }));
    await expect(cb.execute(fail)).rejects.toThrow();
    await new Promise(r => setTimeout(r, 80));
    await cb.execute(succeed);
    await cb.execute(succeed);
    expect(cb.getState()).toBe(CircuitBreakerState.CLOSED);
  }, 2000);

  it('transitions HALF_OPEN → OPEN on any infrastructure failure', async () => {
    const cb = new CircuitBreaker(makeConfig({ minimumCalls: 1, slidingWindowSize: 1, failureThreshold: 1, openTimeoutMs: 50, halfOpenMaxCalls: 2 }));
    await expect(cb.execute(fail)).rejects.toThrow();
    await new Promise(r => setTimeout(r, 80));
    await expect(cb.execute(fail)).rejects.toThrow(InfraError);
    expect(cb.getState()).toBe(CircuitBreakerState.OPEN);
  }, 2000);
});

describe('CircuitBreaker — business vs infrastructure errors', () => {
  it('business errors do not count toward failure threshold', async () => {
    const cb = new CircuitBreaker(makeConfig({
      minimumCalls: 2,
      slidingWindowSize: 2,
      failureThreshold: 50,
      isFailure: (e) => !(e instanceof BusinessError),
    }));

    await expect(cb.execute(() => Promise.reject(new BusinessError()))).rejects.toThrow(BusinessError);
    await expect(cb.execute(() => Promise.reject(new BusinessError()))).rejects.toThrow(BusinessError);
    expect(cb.getState()).toBe(CircuitBreakerState.CLOSED);
  });

  it('business errors increment successfulCalls in metrics', async () => {
    const cb = new CircuitBreaker(makeConfig({
      isFailure: (e) => !(e instanceof BusinessError),
    }));

    await expect(cb.execute(() => Promise.reject(new BusinessError()))).rejects.toThrow();
    expect(cb.getMetrics().successfulCalls).toBe(1);
    expect(cb.getMetrics().failedCalls).toBe(0);
  });

  it('infrastructure errors open the circuit while business errors are transparent', async () => {
    const cb = new CircuitBreaker(makeConfig({
      minimumCalls: 3,
      slidingWindowSize: 4,
      failureThreshold: 50,
      isFailure: (e) => e instanceof InfraError,
    }));

    // 2 business errors → counted as successes (window: success, success)
    await expect(cb.execute(() => Promise.reject(new BusinessError()))).rejects.toThrow(BusinessError);
    await expect(cb.execute(() => Promise.reject(new BusinessError()))).rejects.toThrow(BusinessError);
    expect(cb.getState()).toBe(CircuitBreakerState.CLOSED);

    // 2 infra errors → (window: success, success, failure, failure) → 50% failure rate → OPEN
    await expect(cb.execute(() => Promise.reject(new InfraError()))).rejects.toThrow(InfraError);
    await expect(cb.execute(() => Promise.reject(new InfraError()))).rejects.toThrow(InfraError);
    expect(cb.getState()).toBe(CircuitBreakerState.OPEN);
  });
});

describe('CircuitBreaker — slow calls', () => {
  it('slow calls count toward slowCallRate', async () => {
    const cb = new CircuitBreaker(makeConfig({
      slowCallDurationMs: 30,
      slowCallThreshold: 50,
      minimumCalls: 2,
      slidingWindowSize: 2,
    }));

    await cb.execute(() => new Promise(r => setTimeout(r, 50)));
    await cb.execute(() => new Promise(r => setTimeout(r, 50)));
    expect(cb.getState()).toBe(CircuitBreakerState.OPEN);
  }, 3000);
});

describe('CircuitBreaker — metrics', () => {
  it('tracks all counters correctly', async () => {
    const cb = new CircuitBreaker(makeConfig());
    await cb.execute(succeed);
    await expect(cb.execute(fail)).rejects.toThrow();

    const m = cb.getMetrics();
    expect(m.totalCalls).toBe(2);
    expect(m.successfulCalls).toBe(1);
    expect(m.failedCalls).toBe(1);
  });

  it('tracks notPermittedCalls when OPEN', async () => {
    const cb = new CircuitBreaker(makeConfig({ minimumCalls: 1, slidingWindowSize: 1, failureThreshold: 1 }));
    await expect(cb.execute(fail)).rejects.toThrow();
    await expect(cb.execute(succeed)).rejects.toThrow(CircuitBreakerOpenError);
    expect(cb.getMetrics().notPermittedCalls).toBe(1);
  });

  it('reset clears all counters and state', async () => {
    const cb = new CircuitBreaker(makeConfig({ minimumCalls: 1, slidingWindowSize: 1, failureThreshold: 1 }));
    await expect(cb.execute(fail)).rejects.toThrow();
    cb.reset();
    expect(cb.getState()).toBe(CircuitBreakerState.CLOSED);
    expect(cb.getMetrics().totalCalls).toBe(0);
  });
});

describe('CircuitBreaker — fallback', () => {
  it('calls fallback with CircuitBreakerOpenError when circuit is OPEN', async () => {
    const cb = new CircuitBreaker(makeConfig({ minimumCalls: 1, slidingWindowSize: 1, failureThreshold: 1 }));
    await expect(cb.execute(fail)).rejects.toThrow(InfraError);

    const result = await cb.execute(succeed, (err) => {
      expect(err).toBeInstanceOf(CircuitBreakerOpenError);
      return 'fallback-value';
    });
    expect(result).toBe('fallback-value');
  });

  it('calls fallback with the original error on infrastructure failure', async () => {
    const cb = new CircuitBreaker(makeConfig());
    const result = await cb.execute(fail, (err) => {
      expect(err).toBeInstanceOf(InfraError);
      return 'fallback-infra';
    });
    expect(result).toBe('fallback-infra');
  });

  it('does NOT call fallback for business errors — always rethrows', async () => {
    const cb = new CircuitBreaker(makeConfig({
      isFailure: (e) => !(e instanceof BusinessError),
    }));

    const fallbackSpy = vi.fn().mockReturnValue('should-not-be-called');
    await expect(
      cb.execute(() => Promise.reject(new BusinessError()), fallbackSpy),
    ).rejects.toThrow(BusinessError);
    expect(fallbackSpy).not.toHaveBeenCalled();
  });

  it('fallback can return a Promise', async () => {
    const cb = new CircuitBreaker(makeConfig({ minimumCalls: 1, slidingWindowSize: 1, failureThreshold: 1 }));
    await expect(cb.execute(fail)).rejects.toThrow();

    const result = await cb.execute(succeed, () => Promise.resolve('async-fallback'));
    expect(result).toBe('async-fallback');
  });
});

describe('CircuitBreaker — canAttempt', () => {
  it('returns true when CLOSED', () => {
    expect(new CircuitBreaker(makeConfig()).canAttempt()).toBe(true);
  });

  it('returns false when OPEN', async () => {
    const cb = new CircuitBreaker(makeConfig({ minimumCalls: 1, slidingWindowSize: 1, failureThreshold: 1 }));
    await expect(cb.execute(fail)).rejects.toThrow();
    expect(cb.canAttempt()).toBe(false);
  });

  it('mocks Date to test OPEN → HALF_OPEN without waiting', () => {
    vi.useFakeTimers();
    const cb = new CircuitBreaker(makeConfig({ openTimeoutMs: 1000 }));
    cb['state'] = CircuitBreakerState.OPEN;
    cb['openedAt'] = Date.now() - 1001;
    expect(cb.canAttempt()).toBe(true);
    expect(cb.getState()).toBe(CircuitBreakerState.HALF_OPEN);
    vi.useRealTimers();
  });
});
