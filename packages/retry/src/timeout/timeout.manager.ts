import type { TimeoutConfig } from '../retry/types.js';
import { AttemptTimeoutError, GlobalTimeoutError } from './timeout.errors.js';

/** Shared signal for the no-timeouts-configured fast path -- never aborts. */
const NEVER_ABORTS: AbortSignal = new AbortController().signal;

/** `AbortSignal.reason` is typed `any` -- narrow it to a real Error to throw. */
function abortReason(signal: AbortSignal): Error {
  const reason: unknown = signal.reason;
  return reason instanceof Error ? reason : new Error(String(reason));
}

export class TimeoutManager {
  private startTime: number;
  private readonly globalController: AbortController | undefined;
  private readonly globalTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(private config: TimeoutConfig) {
    this.startTime = Date.now();

    if (this.config.globalTimeoutMs && this.config.globalTimeoutMs > 0) {
      this.globalController = new AbortController();
      this.globalTimer = setTimeout(() => {
        this.globalController!.abort(
          new GlobalTimeoutError(this.config.globalTimeoutMs!, this.config.globalTimeoutMs!),
        );
      }, this.config.globalTimeoutMs);
      this.globalTimer.unref?.();
    }
  }

  /**
   * Execute a task with a per-attempt timeout, passing it an `AbortSignal`
   * that fires when the attempt (or the overall global timeout) expires.
   *
   * A task that doesn't check the signal (e.g. doesn't pass it to `fetch`)
   * keeps running in the background after we give up waiting on it -- we
   * can only abandon the wait, not force JS execution to stop.
   */
  async executeWithAttemptTimeout<T>(task: (signal: AbortSignal) => Promise<T>): Promise<T> {
    if (this.globalController?.signal.aborted) {
      throw abortReason(this.globalController.signal);
    }

    // Fast path: no timeout configured at all -- skip the AbortController/Promise
    // wrapper machinery entirely.
    if (!this.globalController && (!this.config.attemptTimeoutMs || this.config.attemptTimeoutMs <= 0)) {
      return task(NEVER_ABORTS);
    }

    const attemptController = new AbortController();
    const forwardGlobalAbort = (): void => {
      attemptController.abort(this.globalController!.signal.reason);
    };
    this.globalController?.signal.addEventListener('abort', forwardGlobalAbort, { once: true });

    const attemptTimeoutMs = this.config.attemptTimeoutMs;
    const timer = attemptTimeoutMs && attemptTimeoutMs > 0
      ? setTimeout(() => attemptController.abort(new AttemptTimeoutError(attemptTimeoutMs)), attemptTimeoutMs)
      : undefined;
    timer?.unref?.();

    try {
      return await new Promise<T>((resolve, reject) => {
        attemptController.signal.addEventListener(
          'abort',
          () => reject(abortReason(attemptController.signal)),
          { once: true },
        );
        task(attemptController.signal).then(resolve, reject);
      });
    } finally {
      if (timer) clearTimeout(timer);
      this.globalController?.signal.removeEventListener('abort', forwardGlobalAbort);
    }
  }

  /**
   * Check if the global timeout has already fired. Called at the start of
   * each attempt loop iteration -- the AbortSignal handles cutting off an
   * attempt that's already in flight when the deadline hits.
   */
  checkGlobalTimeout(): void {
    if (this.globalController?.signal.aborted) {
      throw abortReason(this.globalController.signal);
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

  /** Release the global timeout timer. Call once the retry loop is done. */
  dispose(): void {
    if (this.globalTimer) clearTimeout(this.globalTimer);
  }
}
