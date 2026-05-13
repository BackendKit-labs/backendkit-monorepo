export enum CircuitBreakerState {
  CLOSED    = 'closed',
  OPEN      = 'open',
  HALF_OPEN = 'half_open',
}

export interface CircuitBreakerConfig {
  name: string;

  /** % of calls in the sliding window that must fail to open the circuit (0–100). Default: 50 */
  failureThreshold: number;

  /** % of calls in the sliding window that are slow to open the circuit (0–100). Default: 100 (disabled) */
  slowCallThreshold: number;

  /** Duration in ms above which a successful call is considered slow. Default: 60000 */
  slowCallDurationMs: number;

  /** Minimum number of calls in the window before thresholds are evaluated. Default: 5 */
  minimumCalls: number;

  /** Size of the count-based sliding window. Default: 10 */
  slidingWindowSize: number;

  /** Number of test calls allowed in HALF_OPEN before deciding to close or reopen. Default: 3 */
  halfOpenMaxCalls: number;

  /** Time in ms to wait in OPEN before transitioning to HALF_OPEN. Default: 60000 */
  openTimeoutMs: number;

  /**
   * Classifies whether a thrown error counts as an infrastructure failure
   * (opens the circuit) or a business error (transparent pass-through).
   *
   * Return `true`  → infrastructure error — counted against the circuit.
   * Return `false` → business error — the circuit treats the call as a success.
   *
   * Default: all errors count as infrastructure failures.
   *
   * @example
   * // Only HTTP 5xx and non-HTTP errors open the circuit
   * isFailure: (err) => !(err instanceof HttpException) || err.getStatus() >= 500
   */
  isFailure: (error: unknown) => boolean;
}

export interface CircuitBreakerMetrics {
  name: string;
  state: CircuitBreakerState;
  failureRate: number;
  slowCallRate: number;
  bufferedCalls: number;
  totalCalls: number;
  successfulCalls: number;
  failedCalls: number;
  slowCalls: number;
  notPermittedCalls: number;
}

export class CircuitBreakerOpenError extends Error {
  constructor(name: string) {
    super(`Circuit breaker '${name}' is OPEN — calls not permitted`);
    this.name = 'CircuitBreakerOpenError';
  }
}

type CallOutcome = 'success' | 'failure' | 'slow';

export const DEFAULT_CIRCUIT_BREAKER_CONFIG: Omit<CircuitBreakerConfig, 'name'> = {
  failureThreshold:  50,
  slowCallThreshold: 100,
  slowCallDurationMs: 60_000,
  minimumCalls:      5,
  slidingWindowSize: 10,
  halfOpenMaxCalls:  3,
  openTimeoutMs:     60_000,
  isFailure: () => true,
};

export class CircuitBreaker {
  private state: CircuitBreakerState = CircuitBreakerState.CLOSED;
  private window: CallOutcome[] = [];
  private openedAt: number | null = null;
  private halfOpenCalls = 0;
  private halfOpenSuccesses = 0;

  private totalCalls = 0;
  private successfulCalls = 0;
  private failedCalls = 0;
  private slowCalls = 0;
  private notPermittedCalls = 0;

  constructor(private readonly config: CircuitBreakerConfig) {}

  async execute<T>(task: () => Promise<T>): Promise<T> {
    this.syncState();

    if (!this.canAttempt()) {
      this.notPermittedCalls++;
      throw new CircuitBreakerOpenError(this.config.name);
    }

    if (this.state === CircuitBreakerState.HALF_OPEN) {
      this.halfOpenCalls++;
    }

    this.totalCalls++;
    const startTime = Date.now();

    try {
      const result = await task();
      this.onSuccess(Date.now() - startTime);
      return result;
    } catch (error: unknown) {
      this.onError(error);
      throw error;
    }
  }

  private onSuccess(durationMs: number): void {
    const isSlow = durationMs >= this.config.slowCallDurationMs;
    this.successfulCalls++;

    if (isSlow) {
      this.slowCalls++;
      this.record('slow');
    } else {
      this.record('success');
    }

    if (this.state === CircuitBreakerState.HALF_OPEN) {
      this.halfOpenSuccesses++;
      if (this.halfOpenSuccesses >= this.config.halfOpenMaxCalls) {
        this.transitionTo(CircuitBreakerState.CLOSED);
      }
    }
  }

  private onError(error: unknown): void {
    const isInfrastructure = this.config.isFailure(error);

    if (isInfrastructure) {
      this.failedCalls++;
      this.record('failure');
      if (this.state === CircuitBreakerState.HALF_OPEN) {
        this.transitionTo(CircuitBreakerState.OPEN);
      }
    } else {
      // Business error — transparent to the circuit breaker
      this.successfulCalls++;
      this.record('success');
    }
  }

  private record(outcome: CallOutcome): void {
    if (this.window.length >= this.config.slidingWindowSize) {
      this.window.shift();
    }
    this.window.push(outcome);

    if (this.state === CircuitBreakerState.CLOSED) {
      this.evaluateThresholds();
    }
  }

  private evaluateThresholds(): void {
    if (this.window.length < this.config.minimumCalls) return;

    const total    = this.window.length;
    const failures = this.window.filter(o => o === 'failure').length;
    const slow     = this.window.filter(o => o === 'slow').length;

    const failureRate  = (failures / total) * 100;
    const slowCallRate = (slow / total) * 100;

    if (
      failureRate  >= this.config.failureThreshold ||
      slowCallRate >= this.config.slowCallThreshold
    ) {
      this.transitionTo(CircuitBreakerState.OPEN);
    }
  }

  private syncState(): void {
    if (
      this.state === CircuitBreakerState.OPEN &&
      this.openedAt !== null &&
      Date.now() - this.openedAt >= this.config.openTimeoutMs
    ) {
      this.transitionTo(CircuitBreakerState.HALF_OPEN);
    }
  }

  private transitionTo(next: CircuitBreakerState): void {
    this.state = next;

    if (next === CircuitBreakerState.OPEN) {
      this.openedAt         = Date.now();
      this.halfOpenCalls    = 0;
      this.halfOpenSuccesses = 0;
    } else if (next === CircuitBreakerState.HALF_OPEN) {
      this.halfOpenCalls    = 0;
      this.halfOpenSuccesses = 0;
      this.window           = [];
    } else {
      this.openedAt         = null;
      this.halfOpenCalls    = 0;
      this.halfOpenSuccesses = 0;
      this.window           = [];
    }
  }

  canAttempt(): boolean {
    this.syncState();
    if (this.state === CircuitBreakerState.CLOSED)   return true;
    if (this.state === CircuitBreakerState.OPEN)      return false;
    return this.halfOpenCalls < this.config.halfOpenMaxCalls;
  }

  getState(): CircuitBreakerState {
    this.syncState();
    return this.state;
  }

  getMetrics(): CircuitBreakerMetrics {
    this.syncState();
    const total    = this.window.length;
    const failures = this.window.filter(o => o === 'failure').length;
    const slow     = this.window.filter(o => o === 'slow').length;

    return {
      name:              this.config.name,
      state:             this.state,
      failureRate:       total > 0 ? Math.round((failures / total) * 100) : 0,
      slowCallRate:      total > 0 ? Math.round((slow / total) * 100) : 0,
      bufferedCalls:     total,
      totalCalls:        this.totalCalls,
      successfulCalls:   this.successfulCalls,
      failedCalls:       this.failedCalls,
      slowCalls:         this.slowCalls,
      notPermittedCalls: this.notPermittedCalls,
    };
  }

  reset(): void {
    this.transitionTo(CircuitBreakerState.CLOSED);
    this.totalCalls       = 0;
    this.successfulCalls  = 0;
    this.failedCalls      = 0;
    this.slowCalls        = 0;
    this.notPermittedCalls = 0;
  }
}
