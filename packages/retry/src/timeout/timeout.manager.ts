import type { TimeoutConfig } from '../retry/types.js';
import { AttemptTimeoutError, GlobalTimeoutError } from './timeout.errors.js';

export class TimeoutManager {
  private startTime: number;

  constructor(private config: TimeoutConfig) {
    this.startTime = Date.now();
  }

  /**
   * Execute a task with per-attempt timeout.
   * Throws AttemptTimeoutError if the task exceeds attemptTimeoutMs.
   */
  async executeWithAttemptTimeout<T>(task: () => Promise<T>): Promise<T> {
    if (!this.config.attemptTimeoutMs || this.config.attemptTimeoutMs <= 0) {
      return task();
    }

    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new AttemptTimeoutError(this.config.attemptTimeoutMs!));
      }, this.config.attemptTimeoutMs);

      task()
        .then((val) => {
          clearTimeout(timer);
          resolve(val);
        })
        .catch((err) => {
          clearTimeout(timer);
          reject(err);
        });
    });
  }

  /**
   * Check if the global timeout has been exceeded.
   * Throws GlobalTimeoutError if exceeded.
   */
  checkGlobalTimeout(): void {
    if (!this.config.globalTimeoutMs || this.config.globalTimeoutMs <= 0) return;

    const elapsed = Date.now() - this.startTime;
    if (elapsed >= this.config.globalTimeoutMs) {
      throw new GlobalTimeoutError(this.config.globalTimeoutMs, elapsed);
    }
  }

  /**
   * Get the remaining time before global timeout (ms).
   * Returns Infinity if no global timeout is configured.
   */
  getRemainingTime(): number {
    if (!this.config.globalTimeoutMs || this.config.globalTimeoutMs <= 0) return Infinity;
    const elapsed = Date.now() - this.startTime;
    return Math.max(0, this.config.globalTimeoutMs - elapsed);
  }

  /** Reset the start time (for reuse across retry cycles). */
  reset(): void {
    this.startTime = Date.now();
  }
}
