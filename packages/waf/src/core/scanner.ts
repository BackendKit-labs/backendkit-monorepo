import { BUILT_IN_RULES } from './rules.js';
import type { ScanTarget, WafRule, WafScanResult, WafScannerOptions, WafThreat } from './types.js';

interface FieldValue {
  field: string;
  value: string;
}

export class WafScanner {
  private readonly activeRules: WafRule[];
  private readonly maxDepth: number;
  private readonly maxStringLength: number;

  constructor(options: WafScannerOptions = {}) {
    const overrides = options.rules ?? {};

    const builtIn = BUILT_IN_RULES.filter(r => {
      // Explicit option overrides the rule's own `enabled` flag
      if (r.category in overrides) return overrides[r.category];
      return r.enabled;
    });

    this.activeRules    = [...builtIn, ...(options.customRules ?? [])];
    this.maxDepth       = options.maxDepth       ?? 10;
    this.maxStringLength = options.maxStringLength ?? 8_000;
  }

  /**
   * Scans a request segment (query, body, params, …) for threats.
   * Recursively extracts every string value — including object keys, which matters
   * for NoSQL injection where the attack lives in the key name (e.g. `{ "$ne": null }`).
   */
  scan(data: unknown, location: ScanTarget): WafScanResult {
    const fields  = this.extractStrings(data, '', 0);
    const threats: WafThreat[] = [];

    for (const { field, value } of fields) {
      const input = value.length > this.maxStringLength
        ? value.slice(0, this.maxStringLength)
        : value;

      for (const rule of this.activeRules) {
        if (rule.pattern.test(input)) {
          threats.push({
            ruleId:   rule.id,
            category: rule.category,
            severity: rule.severity,
            location,
            field,
            value: input.slice(0, 120),
          });
        }
      }
    }

    return { clean: threats.length === 0, threats };
  }

  private extractStrings(data: unknown, path: string, depth: number): FieldValue[] {
    if (depth > this.maxDepth)                          return [];
    if (data === null || data === undefined)            return [];
    if (typeof data === 'string')                       return [{ field: path || '(root)', value: data }];
    if (typeof data === 'number' || typeof data === 'boolean') return [];

    if (Array.isArray(data)) {
      return data.flatMap((item, i) =>
        this.extractStrings(item, `${path}[${i}]`, depth + 1),
      );
    }

    if (typeof data === 'object') {
      const results: FieldValue[] = [];
      for (const [key, val] of Object.entries(data as Record<string, unknown>)) {
        const childPath = path ? `${path}.${key}` : key;
        // Scan the key itself — catches NoSQL operators like `$ne`, `$where`
        results.push({ field: `${childPath}[key]`, value: key });
        results.push(...this.extractStrings(val, childPath, depth + 1));
      }
      return results;
    }

    return [];
  }
}
