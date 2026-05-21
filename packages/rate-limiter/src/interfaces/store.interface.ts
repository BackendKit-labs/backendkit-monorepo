export interface IRateLimiterStore<TState = unknown> {
  get(key: string): Promise<TState | null>;
  set(key: string, state: TState, ttlMs?: number): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
}
