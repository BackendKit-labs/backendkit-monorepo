import type {
  RetryHooks,
  BeforeRetryContext,
  AfterRetryContext,
  RetrySuccessContext,
  ExhaustedContext,
} from './types.js';

export class HookRunner {
  constructor(
    private hooks: RetryHooks,
    private correlationId?: string,
  ) {}

  async beforeRetry(ctx: BeforeRetryContext): Promise<void> {
    if (!this.hooks.beforeRetry) return;
    try {
      await this.hooks.beforeRetry({ ...ctx, correlationId: this.correlationId });
    } catch {
      // Errors in hooks are logged but never propagated.
      // This prevents a broken hook from corrupting the retry state.
    }
  }

  async afterRetry(ctx: AfterRetryContext): Promise<void> {
    if (!this.hooks.afterRetry) return;
    try {
      await this.hooks.afterRetry({ ...ctx, correlationId: this.correlationId });
    } catch {
      // Silent: hook errors must not corrupt retry state
    }
  }

  async onRetrySuccess(ctx: RetrySuccessContext): Promise<void> {
    if (!this.hooks.onRetrySuccess) return;
    try {
      await this.hooks.onRetrySuccess({ ...ctx, correlationId: this.correlationId });
    } catch {
      // Silent
    }
  }

  async onExhausted(ctx: ExhaustedContext): Promise<void> {
    if (!this.hooks.onExhausted) return;
    try {
      await this.hooks.onExhausted({ ...ctx, correlationId: this.correlationId });
    } catch {
      // Silent
    }
  }

  async onBudgetExhausted(): Promise<void> {
    if (!this.hooks.onBudgetExhausted) return;
    try {
      await this.hooks.onBudgetExhausted({ correlationId: this.correlationId });
    } catch {
      // Silent
    }
  }
}
