import { Logger } from '@nestjs/common';

/**
 * Minimal circuit breaker for HTTP transports.
 * CLOSED → (failureThreshold consecutive failures) → OPEN → (resetMs) → CLOSED
 *
 * Intentionally simple: no half-open probing, no external dependencies.
 * For full circuit breaker semantics use @backendkit-labs/circuit-breaker.
 */
export class TransportCircuitBreaker {
  private failures   = 0;
  private openUntil  = 0;

  constructor(
    private readonly failureThreshold = 5,
    private readonly resetMs          = 30_000,
    private readonly logger:   Logger,
    private readonly name:     string,
  ) {}

  get isOpen(): boolean {
    if (this.failures < this.failureThreshold) return false;
    if (Date.now() >= this.openUntil) {
      this.failures = 0;
      this.logger.log(`[${this.name}] circuit breaker CLOSED — recovered`);
      return false;
    }
    return true;
  }

  recordSuccess(): void {
    this.failures = 0;
  }

  recordFailure(): void {
    this.failures++;
    if (this.failures === this.failureThreshold) {
      this.openUntil = Date.now() + this.resetMs;
      this.logger.warn(
        `[${this.name}] circuit breaker OPEN — pausing sends for ${this.resetMs / 1_000}s`,
      );
    }
  }
}
