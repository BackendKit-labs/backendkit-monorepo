import { IRateLimiterAlgorithm, ConsumeResult } from '../interfaces/algorithm.interface';
import { validatePositiveInt } from '../utils';

export interface SlidingWindowLogState {
  timestamps: number[];
  windowMs: number;
  maxRequests: number;
}

export class SlidingWindowLogAlgorithm implements IRateLimiterAlgorithm<SlidingWindowLogState> {
  readonly name = 'sliding-window-log';

  initialState(config: Record<string, unknown>, _now?: number): SlidingWindowLogState {
    return {
      timestamps: [],
      windowMs: validatePositiveInt(config.windowMs, 'windowMs'),
      maxRequests: validatePositiveInt(config.maxRequests, 'maxRequests', true),
    };
  }

  consume(state: SlidingWindowLogState, weight: number, now: number): ConsumeResult<SlidingWindowLogState> {
    const windowStart = now - state.windowMs;

    // Remove expired timestamps
    const validTimestamps = state.timestamps.filter((ts) => ts > windowStart);

    // If we have room, add the request
    if (validTimestamps.length + weight <= state.maxRequests) {
      const newTimestamps = [...validTimestamps];
      for (let i = 0; i < weight; i++) {
        newTimestamps.push(now);
      }

      return {
        allowed: true,
        remaining: state.maxRequests - newTimestamps.length,
        resetAt: newTimestamps.length > 0 ? newTimestamps[0] + state.windowMs : now + state.windowMs,
        state: {
          ...state,
          timestamps: newTimestamps,
        },
      };
    }

    // Rate limited
    // The condition validTimestamps.length >= state.maxRequests - weight + 1
    // is ALWAYS true in the denied path (see proof below), so the branch is
    // always reachable with an existing timestamp for resetAt calculation.
    // Proof: Denied => validTimestamps.length + weight > maxRequests
    //        => validTimestamps.length > maxRequests - weight
    //        => validTimestamps.length >= maxRequests - weight + 1 (integers)
    const oldestTimestampIndex = validTimestamps.length - (state.maxRequests - weight + 1);
    const oldestAllowedTimestamp = validTimestamps[oldestTimestampIndex];

    return {
      allowed: false,
      remaining: 0,
      resetAt: oldestAllowedTimestamp + state.windowMs,
      state: {
        ...state,
        timestamps: validTimestamps,
      },
    };
  }

  getLimit(config: Record<string, unknown>): number {
    return config.maxRequests as number;
  }
}
