export class StoreError extends Error {
  readonly kind = 'store-error' as const;

  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'StoreError';
  }

  /**
   * Returns a sanitized version safe for external exposure.
   * The original cause is available via the `cause` property for logging.
   */
  toJSON(): { name: string; message: string; kind: string } {
    return {
      name: this.name,
      message: this.message,
      kind: this.kind,
    };
  }
}

export class AlgorithmError extends Error {
  readonly kind = 'algorithm-error' as const;

  constructor(message: string) {
    super(message);
    this.name = 'AlgorithmError';
  }
}

export class ConfigError extends Error {
  readonly kind = 'config-error' as const;

  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

export type RateLimitError = StoreError | AlgorithmError | ConfigError;
