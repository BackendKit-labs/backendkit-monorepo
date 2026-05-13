import { describe, it, expect, beforeEach } from 'vitest';
import { CircuitBreakerRegistry, isHttpServerError } from '../../src/circuit-breaker/circuit-breaker.registry.js';
import { CircuitBreakerState } from '../../src/circuit-breaker/circuit-breaker.js';

describe('CircuitBreakerRegistry', () => {
  let registry: CircuitBreakerRegistry;

  beforeEach(() => {
    registry = new CircuitBreakerRegistry();
  });

  it('creates a new circuit breaker with getOrCreate', () => {
    const cb = registry.getOrCreate({ name: 'test' });
    expect(cb.getMetrics().name).toBe('test');
  });

  it('returns the same instance for the same name', () => {
    const cb1 = registry.getOrCreate({ name: 'same' });
    const cb2 = registry.getOrCreate({ name: 'same' });
    expect(cb1).toBe(cb2);
  });

  it('getForHttpExternal sets correct name', () => {
    const cb = registry.getForHttpExternal('payment-api');
    expect(cb.getMetrics().name).toBe('http:payment-api');
  });

  it('getForService sets correct name', () => {
    const cb = registry.getForService('auth');
    expect(cb.getMetrics().name).toBe('service:auth');
  });

  it('getForDatabase sets correct name and lower threshold', () => {
    const cb = registry.getForDatabase('orders');
    expect(cb.getMetrics().name).toBe('database:orders');
  });

  it('getAllMetrics returns all registered breakers', () => {
    registry.getForHttpExternal('svc-a');
    registry.getForService('svc-b');
    const all = registry.getAllMetrics();
    expect(Object.keys(all)).toHaveLength(2);
  });

  it('getOpenBreakers returns none when all closed', () => {
    registry.getForService('svc');
    expect(registry.getOpenBreakers()).toHaveLength(0);
  });

  it('getOpenBreakers returns open breakers', async () => {
    const cb = registry.getOrCreate({ name: 'fragile', minimumCalls: 1, slidingWindowSize: 1, failureThreshold: 1 });
    await expect(cb.execute(() => Promise.reject(new Error()))).rejects.toThrow();
    expect(registry.getOpenBreakers()).toHaveLength(1);
    expect(registry.getOpenBreakers()[0].state).toBe(CircuitBreakerState.OPEN);
  });

  it('reset closes a specific circuit breaker', async () => {
    const cb = registry.getOrCreate({ name: 'fragile', minimumCalls: 1, slidingWindowSize: 1, failureThreshold: 1 });
    await expect(cb.execute(() => Promise.reject(new Error()))).rejects.toThrow();
    registry.reset('fragile');
    expect(cb.getState()).toBe(CircuitBreakerState.CLOSED);
  });

  it('resetAll closes all circuit breakers', async () => {
    const cb = registry.getOrCreate({ name: 'fragile', minimumCalls: 1, slidingWindowSize: 1, failureThreshold: 1 });
    await expect(cb.execute(() => Promise.reject(new Error()))).rejects.toThrow();
    registry.resetAll();
    expect(cb.getState()).toBe(CircuitBreakerState.CLOSED);
  });
});

describe('isHttpServerError', () => {
  it('returns true for non-HTTP errors', () => {
    expect(isHttpServerError(new Error('network timeout'))).toBe(true);
  });

  it('returns true for HTTP 500', () => {
    expect(isHttpServerError({ getStatus: () => 500 })).toBe(true);
  });

  it('returns true for HTTP 503', () => {
    expect(isHttpServerError({ getStatus: () => 503 })).toBe(true);
  });

  it('returns false for HTTP 404 (business error)', () => {
    expect(isHttpServerError({ getStatus: () => 404 })).toBe(false);
  });

  it('returns false for HTTP 401 (business error)', () => {
    expect(isHttpServerError({ getStatus: () => 401 })).toBe(false);
  });

  it('returns false for HTTP 422 (business error)', () => {
    expect(isHttpServerError({ getStatus: () => 422 })).toBe(false);
  });
});
