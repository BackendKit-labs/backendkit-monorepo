import { SetMetadata } from '@nestjs/common';
import { AlgorithmType } from '../interfaces/config.interface';
import { ExecutionContext } from '@nestjs/common';

export const RATE_LIMIT_KEY = 'backendkit:rate-limiter';

export interface RateLimitOptions {
  // Algorithm selection
  algorithm?: AlgorithmType;

  // Token Bucket config
  tokensPerSecond?: number;
  bucketSize?: number;
  initialTokens?: number;

  // Window-based config
  windowMs?: number;
  maxRequests?: number;

  // General
  keyPrefix?: string;
  keyGenerator?: (context: ExecutionContext) => string;
  errorMessage?: string;
}

export const RateLimit = (options: RateLimitOptions): MethodDecorator & ClassDecorator => {
  return SetMetadata(RATE_LIMIT_KEY, options);
};
