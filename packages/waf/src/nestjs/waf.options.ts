import type { Request } from 'express';
import type { ScanTarget, ThreatCategory, WafMode, WafRule, WafThreat } from '../core/types.js';

export const WAF_OPTIONS = Symbol('WAF_OPTIONS');

export interface WafModuleOptions {
  /**
   * - `block`   — reject the request with 403 (default)
   * - `log`     — allow but log threats to `onThreat`
   * - `monitor` — allow and call `onThreat`, no log output
   */
  mode?: WafMode;

  /** Enable or disable individual threat categories. All enabled by default except `ssrf`. */
  rules?: Partial<Record<ThreatCategory, boolean>>;

  /** Custom rules merged on top of built-in ones. */
  customRules?: WafRule[];

  /** Request segments to scan. Default: ['query', 'body', 'params'] */
  scanTargets?: ScanTarget[];

  /** Paths that bypass WAF scanning entirely (e.g. /health, /metrics). */
  excludePaths?: string[];

  /** Max depth for nested object scanning. Default: 10 */
  maxDepth?: number;

  /** Strings longer than this are truncated before pattern testing. Default: 8000 */
  maxStringLength?: number;

  /** Called for every detected threat, regardless of mode. Use for logging or alerting. */
  onThreat?: (threats: WafThreat[], req: Request) => void;
}
