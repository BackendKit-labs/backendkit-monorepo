import { IRateLimiterAlgorithm, ConsumeResult } from '../interfaces/algorithm.interface';
import { validatePositiveInt, validatePositiveNumber } from '../utils';

export interface TokenBucketState {
  tokens: number;
  lastRefillTime: number;
  bucketSize: number;
  tokensPerSecond: number;
}

export class TokenBucketAlgorithm implements IRateLimiterAlgorithm<TokenBucketState> {
  readonly name = 'token-bucket';

  initialState(config: Record<string, unknown>, now?: number): TokenBucketState {
    const bucketSize = validatePositiveInt(config.bucketSize, 'bucketSize');
    const tokensPerSecond = validatePositiveNumber(config.tokensPerSecond, 'tokensPerSecond');
    const initialTokens = config.initialTokens !== undefined
      ? validatePositiveInt(config.initialTokens, 'initialTokens', true)
      : bucketSize;

    return {
      tokens: Math.min(initialTokens, bucketSize),
      lastRefillTime: now ?? Date.now(),
      bucketSize,
      tokensPerSecond,
    };
  }

  consume(state: TokenBucketState, weight: number, now: number): ConsumeResult<TokenBucketState> {
    const elapsed = now - state.lastRefillTime;
    const tokensToAdd = (elapsed / 1000) * state.tokensPerSecond;
    const tokens = Math.min(state.tokens + tokensToAdd, state.bucketSize);

    if (tokens < weight) {
      const timeToNextToken = ((weight - tokens) / state.tokensPerSecond) * 1000;
      const resetAt = now + timeToNextToken;

      return {
        allowed: false,
        remaining: 0,
        resetAt,
        state: {
          ...state,
          tokens,
          lastRefillTime: now,
        },
      };
    }

    const newTokens = tokens - weight;

    return {
      allowed: true,
      remaining: Math.floor(newTokens),
      resetAt: now + ((state.bucketSize - newTokens) / state.tokensPerSecond) * 1000,
      state: {
        ...state,
        tokens: newTokens,
        lastRefillTime: now,
      },
    };
  }

  getLimit(config: Record<string, unknown>): number {
    return config.bucketSize as number;
  }
}
