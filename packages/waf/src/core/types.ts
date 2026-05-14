export type ThreatCategory =
  | 'sqli'
  | 'xss'
  | 'path-traversal'
  | 'cmd-injection'
  | 'nosql-injection'
  | 'ssrf';

export type ThreatSeverity = 'critical' | 'high' | 'medium' | 'low';

/** block: reject with 403 | log: allow but log the threat | monitor: allow and emit metrics only */
export type WafMode = 'block' | 'log' | 'monitor';

export type ScanTarget = 'query' | 'body' | 'params' | 'headers' | 'cookies';

export interface WafRule {
  id:          string;
  category:    ThreatCategory;
  severity:    ThreatSeverity;
  description: string;
  /** Must use only the `i` flag — never `g` or `gi`. Reusing a regex with the global flag
   *  across requests causes the `lastIndex` state to leak, producing alternating false negatives. */
  pattern:     RegExp;
  enabled:     boolean;
}

export interface WafThreat {
  ruleId:    string;
  category:  ThreatCategory;
  severity:  ThreatSeverity;
  location:  ScanTarget;
  field:     string;
  /** Truncated to 120 chars to keep logs safe and bounded. */
  value:     string;
}

export interface WafScanResult {
  clean:   boolean;
  threats: WafThreat[];
}

export interface WafScannerOptions {
  /** Which categories to disable. All enabled by default except ssrf. */
  rules?: Partial<Record<ThreatCategory, boolean>>;
  /** Custom rules merged on top of built-in ones. */
  customRules?: WafRule[];
  /** Max recursion depth for nested objects. Default: 10 */
  maxDepth?: number;
  /** Strings longer than this are truncated before pattern testing. Default: 8000 */
  maxStringLength?: number;
}
