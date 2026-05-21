import { IRateLimiterAlgorithm, ConsumeResult } from '../interfaces/algorithm.interface';
import { validatePositiveInt } from '../utils';

export interface SlidingWindowCounterState {
  currentWindowStart: number;
  currentCount: number;
  previousWindowStart: number;
  previousCount: number;
  windowMs: number;
  maxRequests: number;
}

export class SlidingWindowCounterAlgorithm implements IRateLimiterAlgorithm<SlidingWindowCounterState> {
  readonly name = 'sliding-window-counter';

  initialState(config: Record<string, unknown>, now?: number): SlidingWindowCounterState {
    const timestamp = now ?? Date.now();
    const windowMs = validatePositiveInt(config.windowMs, 'windowMs');
    const currentWindowStart = this.getWindowStart(timestamp, windowMs);

    return {
      currentWindowStart,
      currentCount: 0,
      previousWindowStart: currentWindowStart - windowMs,
      previousCount: 0,
      windowMs,
      maxRequests: validatePositiveInt(config.maxRequests, 'maxRequests', true),
    };
  }

  consume(state: SlidingWindowCounterState, weight: number, now: number): ConsumeResult<SlidingWindowCounterState> {
    const currentWindowStart = this.getWindowStart(now, state.windowMs);
    let { currentCount, previousCount, previousWindowStart } = state;

    // If we moved to a new window, shift windows
    if (currentWindowStart > state.currentWindowStart) {
      previousWindowStart = state.currentWindowStart;
      previousCount = state.currentCount;
      currentCount = 0;
    }

    // Calculate estimated count using the sliding window approximation
    const windowProgress = (now - currentWindowStart) / state.windowMs;
    const estimatedCount = currentCount + (previousCount * (1 - windowProgress));

    if (estimatedCount + weight > state.maxRequests) {
      // Rate limited - calculate resetAt based on the oldest contributing request
      let resetAt: number;
      if (currentCount > 0) {
        // Current window has requests, reset at end of current window
        resetAt = currentWindowStart + state.windowMs;
      } else {
        // Only previous window contributes, reset proportionally
        const timeFraction = 1 - ((state.maxRequests - weight) / (previousCount || 1));
        resetAt = currentWindowStart + timeFraction * state.windowMs;
      }

      return {
        allowed: false,
        remaining: 0,
        resetAt,
        state: {
          ...state,
          currentWindowStart,
          currentCount,
          previousWindowStart,
          previousCount,
        },
      };
    }

    // Allowed
    currentCount += weight;

    return {
      allowed: true,
      remaining: Math.max(0, Math.floor(state.maxRequests - (currentCount + previousCount * (1 - windowProgress)))),
      resetAt: currentWindowStart + state.windowMs,
      state: {
        ...state,
        currentWindowStart,
        currentCount,
        previousWindowStart,
        previousCount,
      },
    };
  }

  getLimit(config: Record<string, unknown>): number {
    return config.maxRequests as number;
  }

  private getWindowStart(now: number, windowMs: number): number {
    return Math.floor(now / windowMs) * windowMs;
  }
}
