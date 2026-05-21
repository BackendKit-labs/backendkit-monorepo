/**
 * Calculate how many tokens/requests to decay based on elapsed time.
 * Used by sliding window counter for weighted decay approximations.
 */
export function calculateDecay(previous: number, elapsed: number, windowMs: number): number {
  if (elapsed >= windowMs) return 0;
  const weight = 1 - elapsed / windowMs;
  return previous * weight;
}

/**
 * Determine remaining capacity based on current usage and limit.
 */
export function calculateRemaining(current: number, previous: number, elapsed: number, windowMs: number, limit: number): number {
  const weightedPrevious = calculateDecay(previous, elapsed, windowMs);
  const estimated = current + weightedPrevious;
  return Math.max(0, Math.floor(limit - estimated));
}
