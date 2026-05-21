import { IRateLimiterAlgorithm, ConsumeResult } from '../interfaces/algorithm.interface';
import { validatePositiveInt } from '../utils';

export interface FixedWindowState {
  count: number;
  windowStart: number;
  windowMs: number;
  maxRequests: number;
}

export class FixedWindowAlgorithm implements IRateLimiterAlgorithm<FixedWindowState> {
  readonly name = 'fixed-window';

  initialState(config: Record<string, unknown>, _now?: number): FixedWindowState {
    return {
      count: 0,
      windowStart: 0,
      windowMs: validatePositiveInt(config.windowMs, 'windowMs'),
      maxRequests: validatePositiveInt(config.maxRequests, 'maxRequests', true),
    };
  }

  consume(state: FixedWindowState, weight: number, now: number): ConsumeResult<FixedWindowState> {
    const windowStart = this.getWindowStart(now, state.windowMs);

    if (windowStart !== state.windowStart) {
      const newState: FixedWindowState = {
        ...state,
        count: weight,
        windowStart,
      };

      return {
        allowed: weight <= state.maxRequests,
        remaining: Math.max(0, state.maxRequests - weight),
        resetAt: windowStart + state.windowMs,
        state: newState,
      };
    }

    const newCount = state.count + weight;
    const allowed = newCount <= state.maxRequests;

    return {
      allowed,
      remaining: Math.max(0, state.maxRequests - newCount),
      resetAt: windowStart + state.windowMs,
      state: {
        ...state,
        count: newCount,
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
