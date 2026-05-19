export class AgainExhaustedError extends Error {
  constructor(
    message: string,
    public readonly attempts: number,
    public readonly totalElapsedMs: number,
  ) {
    super(message);
    this.name = 'AgainExhaustedError';
  }
}

export class BudgetExhaustedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BudgetExhaustedError';
  }
}
