import { Injectable } from '@nestjs/common';
import type { Result } from '@backendkit-labs/result';
import type { RetryConfig, RetryError } from '../retry/types.js';
import { RetryEngine } from '../retry/retry.engine.js';

@Injectable()
export class RetryService {
  constructor(private engine: RetryEngine) {}

  async execute<T>(
    task: () => Promise<T>,
    options?: Partial<RetryConfig>,
  ): Promise<Result<T, RetryError>> {
    return this.engine.execute(task, options);
  }

  getEngine(): RetryEngine {
    return this.engine;
  }
}
