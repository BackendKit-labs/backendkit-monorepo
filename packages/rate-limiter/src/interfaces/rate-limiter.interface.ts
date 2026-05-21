import { Result } from '@backendkit-labs/result';
import { RateLimitResult } from './result.interface';
import { RateLimitError } from '../errors/rate-limit-error';

export interface IRateLimiter {
  consume(key: string, weight?: number): Promise<Result<RateLimitResult, RateLimitError>>;
  check(key: string): Promise<RateLimitResult>;
  reset(key: string): Promise<void>;
  resetAll(): Promise<void>;
}
