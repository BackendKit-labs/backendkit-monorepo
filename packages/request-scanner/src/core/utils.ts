import type { WafThreat } from './types.js';

const SEVERITY_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

/** Returns the highest-severity threat without mutating the input array. */
export function pickWorst(threats: WafThreat[]): WafThreat {
  return threats.slice().sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])[0];
}
