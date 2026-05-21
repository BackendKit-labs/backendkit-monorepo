export interface IRateLimiterAlgorithm<TState = unknown> {
  readonly name: string;

  initialState(config: Record<string, unknown>, now?: number): TState;

  consume(
    state: TState,
    weight: number,
    now: number,
  ): ConsumeResult<TState>;

  getLimit(config: Record<string, unknown>): number;
}

export interface ConsumeResult<TState> {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  state: TState;
}
