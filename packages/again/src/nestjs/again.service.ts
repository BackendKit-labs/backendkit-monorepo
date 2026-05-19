import { Injectable } from '@nestjs/common';
import type { Result } from '@backendkit-labs/result';
import type { AgainConfig, AgainError } from '../again/types.js';
import { AgainEngine } from '../again/again.engine.js';

@Injectable()
export class AgainService {
  constructor(private engine: AgainEngine) {}

  async execute<T>(
    task: () => Promise<T>,
    options?: Partial<AgainConfig>,
  ): Promise<Result<T, AgainError>> {
    return this.engine.execute(task, options);
  }

  getEngine(): AgainEngine {
    return this.engine;
  }
}
