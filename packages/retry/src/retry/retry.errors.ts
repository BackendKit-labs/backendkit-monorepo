export class RetryExhaustedError extends Error {
  constructor(
    message: string,
    public readonly attempts: number,
    public readonly totalElapsedMs: number,
  ) {
    super(message);
    this.name = 'RetryExhaustedError';
  }
}

export class BudgetExhaustedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BudgetExhaustedError';
  }
}
