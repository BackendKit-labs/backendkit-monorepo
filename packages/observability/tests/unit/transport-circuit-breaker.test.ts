import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Logger }                                from '@nestjs/common';
import { TransportCircuitBreaker }               from '../../src/internal/transport-circuit-breaker.js';

function makeLogger(): Logger {
  return { log: vi.fn(), warn: vi.fn(), error: vi.fn() } as unknown as Logger;
}

describe('TransportCircuitBreaker', () => {
  let logger: Logger;
  let cb: TransportCircuitBreaker;

  beforeEach(() => {
    logger = makeLogger();
    cb = new TransportCircuitBreaker(3, 30_000, logger, 'test');
  });

  it('starts CLOSED', () => {
    expect(cb.isOpen).toBe(false);
  });

  it('stays CLOSED below the failure threshold', () => {
    cb.recordFailure();
    cb.recordFailure();
    expect(cb.isOpen).toBe(false);
  });

  it('opens after reaching the failure threshold', () => {
    cb.recordFailure();
    cb.recordFailure();
    cb.recordFailure();
    expect(cb.isOpen).toBe(true);
  });

  it('resets failure count on success', () => {
    cb.recordFailure();
    cb.recordFailure();
    cb.recordSuccess();
    expect(cb.isOpen).toBe(false);
    cb.recordFailure(); // back to 1
    expect(cb.isOpen).toBe(false);
  });

  it('closes automatically after resetMs elapses', () => {
    vi.useFakeTimers();
    const cb2 = new TransportCircuitBreaker(1, 1_000, logger, 'timer-test');
    cb2.recordFailure();
    expect(cb2.isOpen).toBe(true);
    vi.advanceTimersByTime(1_001);
    expect(cb2.isOpen).toBe(false);
    vi.useRealTimers();
  });

  it('logs a warning when the breaker opens', () => {
    cb.recordFailure();
    cb.recordFailure();
    cb.recordFailure();
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('OPEN'));
  });

  it('logs when the breaker recovers', () => {
    vi.useFakeTimers();
    const cb3 = new TransportCircuitBreaker(1, 500, logger, 'recover-test');
    cb3.recordFailure();
    vi.advanceTimersByTime(501);
    cb3.isOpen; // trigger recovery check
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('CLOSED'));
    vi.useRealTimers();
  });
});
