export interface RateLimitResult {
  key: string;
  allowed: boolean;
  remaining: number;
  resetAt: number;
  totalLimit: number;
}
