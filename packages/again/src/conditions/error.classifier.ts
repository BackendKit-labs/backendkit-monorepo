import type { AgainErrorPayload, ClassifierRule, ErrorClassification } from '../again/types.js';

/**
 * Default error classifier with built-in rules and custom rule injection.
 *
 * Built-in rules (highest priority first):
 *   401, 403, 404, 422, 400, 413 -> permanent
 *   429, 5xx, network, timeout -> transient
 *   circuit-open, bulkhead-rejected -> transient
 *   fallback -> permanent
 *
 * Custom rules are evaluated before the fallback, after built-in defaults.
 */
export class DefaultErrorClassifier {
  private rules: ClassifierRule[];

  constructor(customRules?: ClassifierRule[]) {
    this.rules = [
      // Built-in rules (priority 0-99)
      { name: 'http-401', priority: 10, match: (e) => e.type === 'http' && e.status === 401, classification: 'permanent' },
      { name: 'http-403', priority: 10, match: (e) => e.type === 'http' && e.status === 403, classification: 'permanent' },
      { name: 'http-404', priority: 10, match: (e) => e.type === 'http' && e.status === 404, classification: 'permanent' },
      { name: 'http-400', priority: 10, match: (e) => e.type === 'http' && e.status === 400, classification: 'permanent' },
      { name: 'http-413', priority: 10, match: (e) => e.type === 'http' && e.status === 413, classification: 'permanent' },
      { name: 'http-422', priority: 10, match: (e) => e.type === 'http' && e.status === 422, classification: 'permanent' },
      { name: 'http-429', priority: 20, match: (e) => e.type === 'http' && e.status === 429, classification: 'transient' },
      { name: 'http-5xx', priority: 20, match: (e) => e.type === 'http' && e.status != null && e.status >= 500, classification: 'transient' },
      { name: 'network', priority: 20, match: (e) => e.type === 'network', classification: 'transient' },
      { name: 'timeout', priority: 20, match: (e) => e.type === 'timeout', classification: 'transient' },
      { name: 'circuit-open', priority: 20, match: (e) => e.type === 'circuit-open', classification: 'transient' },
      { name: 'bulkhead-rejected', priority: 20, match: (e) => e.type === 'bulkhead-rejected', classification: 'transient' },
      // Fallback: business and unknown are permanent
      { name: 'business', priority: 100, match: (e) => e.type === 'business', classification: 'permanent' },
      { name: 'unknown', priority: 100, match: () => true, classification: 'permanent' },
    ];

    if (customRules) {
      this.rules.push(...customRules);
    }

    // Sort by priority ascending
    this.rules.sort((a, b) => (a.priority ?? 100) - (b.priority ?? 100));
  }

  classify(error: AgainErrorPayload): ErrorClassification {
    for (const rule of this.rules) {
      if (rule.match(error)) {
        return rule.classification;
      }
    }
    return 'permanent';
  }
}
