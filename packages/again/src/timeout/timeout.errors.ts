export class AttemptTimeoutError extends Error {
  constructor(public readonly timeoutMs: number) {
    super(`Attempt timed out after ${timeoutMs}ms`);
    this.name = 'AttemptTimeoutError';
  }
}

export class GlobalTimeoutError extends Error {
  constructor(
    public readonly timeoutMs: number,
    public readonly elapsedMs: number,
  ) {
    super(`Global timeout of ${timeoutMs}ms exceeded (elapsed: ${elapsedMs}ms)`);
    this.name = 'GlobalTimeoutError';
  }
}
