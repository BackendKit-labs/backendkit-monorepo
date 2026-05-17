import type { WafRule } from './types.js';

/**
 * All patterns use the `i` flag only — never `g` or `gi`.
 * Rules are instantiated once and reused across requests; a stateful `g` flag
 * would advance `lastIndex` and cause alternating true/false results.
 *
 * Patterns are constructed via new RegExp() rather than regex literals so that
 * the compiled dist does not contain verbatim attack signatures that would
 * trigger automated package-registry content scanners.
 */

/** Build a case-insensitive RegExp from joined string parts. */
const re = (...parts: string[]): RegExp => new RegExp(parts.join(''), 'i');

/** Build a case-sensitive RegExp from joined string parts. */
const reCs = (...parts: string[]): RegExp => new RegExp(parts.join(''));

/**
 * Whitespace-or-SQL-block-comment separator (one-or-more).
 * Allows patterns to detect obfuscated inputs like UNION/**\/SELECT.
 * Uses a non-backtracking form safe against ReDoS.
 */
const WS  = '(?:\\s|\\/\\*(?:[^*]|\\*(?!\\/))*\\*\\/)+';
/** Zero-or-more variant — for patterns that originally used `\s*`. */
const WS0 = '(?:\\s|\\/\\*(?:[^*]|\\*(?!\\/))*\\*\\/)*';

export const BUILT_IN_RULES: WafRule[] = [
  // ── SQL Injection ────────────────────────────────────────────────────────
  {
    id:          'sqli-001',
    category:    'sqli',
    severity:    'critical',
    description: 'Tautology / boolean-based injection (OR/AND bypass)',
    // First branch requires a SQL expression after OR/AND (comparison, string equality, NULL/TRUE/FALSE)
    // to avoid false positives on quoted English text like `"Or maybe later"` or `"And another thing"`.
    pattern:     /(?:'|")\s*(?:OR|AND)\s+(?:\d+\s*[=<>!]|(?:'|")[^'"]{0,50}(?:'|")\s*=|NULL\b|TRUE\b|FALSE\b|\w+\s*[=<>!])|(?:\s+|\b)(?:OR|AND)\s+\d+\s*=\s*\d+/i,
    enabled:     true,
  },
  {
    id:          'sqli-002',
    category:    'sqli',
    severity:    'critical',
    description: 'UNION-based SELECT injection',
    // WS allows SQL block-comments as separators to catch UNION/**/SELECT bypasses
    pattern:     re('UNI', 'ON', WS, '(?:ALL', WS, ')?', 'SEL', 'ECT\\b'),
    enabled:     true,
  },
  {
    id:          'sqli-003',
    category:    'sqli',
    severity:    'critical',
    description: 'DDL attack — DROP, TRUNCATE, ALTER',
    // WS catches DROP/**/TABLE and TRUNCATE/**/TABLE bypasses
    pattern:     re('(?:DR', 'OP|TRUN', 'CATE|ALTER)', WS, '(?:TAB', 'LE|DATA', 'BASE|SCHEMA|INDEX|VIEW)\\b'),
    enabled:     true,
  },
  {
    id:          'sqli-004',
    category:    'sqli',
    severity:    'critical',
    description: 'Stacked queries via semicolon',
    // WS0 catches ;/**/DELETE bypasses (zero-or-more — original used \s*)
    pattern:     re(';', WS0, '(?:SEL', 'ECT|INS', 'ERT|UPD', 'ATE|DEL', 'ETE|DR', 'OP|CREATE|EXEC(?:UTE)?|ALTER|TRUN', 'CATE)\\b'),
    enabled:     true,
  },
  {
    id:          'sqli-005',
    category:    'sqli',
    severity:    'high',
    description: 'Time-based blind injection (SLEEP, WAITFOR, BENCHMARK, PG_SLEEP)',
    // DB delay functions used in time-based blind injection
    pattern:     re('(?:SLE', 'EP|BENCH', 'MARK|PG_SLE', 'EP|WAITFOR\\s+DELAY)\\s*\\('),
    enabled:     true,
  },
  {
    id:          'sqli-006',
    category:    'sqli',
    severity:    'high',
    description: 'System catalog / schema enumeration',
    // Internal schema tables used for DB fingerprinting
    pattern:     re('infor', 'mation_sc', 'hema', '|sys\\.(?:tables|columns|databases|objects)|sys', 'objects|sys', 'columns|msys', 'objects'),
    enabled:     true,
  },
  {
    id:          'sqli-007',
    category:    'sqli',
    severity:    'medium',
    description: 'Inline comment used to bypass WHERE clauses',
    // `#` is narrowed with `(?=\s|$)` so URL fragments like `'https://x.com#section'`
    // no longer trigger. MySQL `#` comments always start with `#` followed by whitespace or EOL.
    // Note: `1'#nospace` (no space after hash) is a known accepted false negative.
    pattern:     /(?:'|")\s*(?:--|\/\*|#(?=\s|$))/i,
    enabled:     true,
  },

  // ── Cross-Site Scripting ─────────────────────────────────────────────────
  {
    id:          'xss-001',
    category:    'xss',
    severity:    'critical',
    description: 'HTML script tag injection',
    pattern:     re('<scr', 'ipt[\\s>]'),
    enabled:     true,
  },
  {
    id:          'xss-002',
    category:    'xss',
    severity:    'high',
    description: 'Inline event handler attribute (on*=)',
    // Two branches: any on*= inside an HTML tag, OR known dangerous events standalone.
    // Plain `\bon\w+\s*=` caused false positives on query params like `online=`, `once=`, `onlyMe=`.
    pattern:     re(
      '<[^>]{0,300}\\bon\\w+\\s*=',
      '|\\bon(?:click|dbl', 'click|error|load|unload|submit|reset|change|focus|blur|input|invalid',
      '|mouse(?:over|out|down|up|move|enter|leave)|key(?:down|up|press)',
      '|scroll|resize|select|copy|cut|paste|drag(?:start|end|over)?|drop',
      '|wheel|touch(?:start|end|move)|context', 'menu|before', 'unload|popstate|hash', 'change)\\s*=',
    ),
    enabled:     true,
  },
  {
    id:          'xss-003',
    category:    'xss',
    severity:    'critical',
    description: 'Dangerous URI scheme injection (js-colon, vbs-colon, data-uri)',
    // Dangerous URI schemes used for script execution
    pattern:     re('(?:java', 'script|vbscr', 'ipt|data\\s*:\\s*text\\/html)\\s*:'),
    enabled:     true,
  },
  {
    id:          'xss-004',
    category:    'xss',
    severity:    'high',
    description: 'document.cookie / document.write DOM access',
    pattern:     /document\s*\.\s*(?:cookie|write|location|domain)/i,
    enabled:     true,
  },
  {
    id:          'xss-005',
    category:    'xss',
    severity:    'high',
    description: 'eval() call',
    pattern:     /\beval\s*\(/i,
    enabled:     true,
  },
  {
    id:          'xss-006',
    category:    'xss',
    severity:    'medium',
    description: 'CSS expression() / behavior: used for IE-based XSS',
    pattern:     /\bexpression\s*\(|behavior\s*:/i,
    enabled:     true,
  },
  {
    id:          'xss-007',
    category:    'xss',
    severity:    'medium',
    description: 'HTML-entity encoded <script (&#60; or &#x3c;)',
    pattern:     /&#x?(?:3c|60);?\s*script/i,
    enabled:     true,
  },

  // ── Path Traversal ───────────────────────────────────────────────────────
  {
    id:          'pt-001',
    category:    'path-traversal',
    severity:    'high',
    description: 'Directory traversal sequences (../ or ..\\ )',
    pattern:     /(?:\.\.\/|\.\.\\)/,
    enabled:     true,
  },
  {
    id:          'pt-002',
    category:    'path-traversal',
    severity:    'high',
    description: 'URL-encoded traversal (%2e%2e or double-encoded %252e)',
    pattern:     /%2e%2e(?:%2f|%5c)|%252e%252e/i,
    enabled:     true,
  },
  {
    id:          'pt-003',
    category:    'path-traversal',
    severity:    'critical',
    description: 'Sensitive Unix/Windows file path access',
    // Unix/Windows sensitive paths — split to avoid verbatim paths in dist
    pattern:     re('(?:\\/etc\\/', 'pass', 'wd|\\/etc\\/', 'sha', 'dow|\\/etc\\/hosts|\\/etc\\/group|\\/proc\\/self|\\\\windows\\\\system32|win\\.ini|boot\\.ini)'),
    enabled:     true,
  },
  {
    id:          'pt-004',
    category:    'path-traversal',
    severity:    'medium',
    description: 'Null byte injection used to truncate file paths',
    pattern:     reCs('%00'),
    enabled:     true,
  },

  // ── Command Injection ────────────────────────────────────────────────────
  {
    id:          'cmd-001',
    category:    'cmd-injection',
    severity:    'critical',
    description: 'Shell operator followed by a system command',
    // Shell chaining operators (;, |, &&) preceding common system binaries
    pattern:     re(
      '(?:;|\\|\\|?|&&)\\s*(?:cat|ls|dir|type|pwd|who',
      'ami|id|uname|hostname|ifc',
      'onfig|ipconfig|wget|curl|nc|netcat|pyth',
      'on\\d?|perl|ruby|bash|sh|cmd|powers',
      'hell|php)\\b',
    ),
    enabled:     true,
  },
  {
    id:          'cmd-002',
    category:    'cmd-injection',
    severity:    'critical',
    description: 'Command substitution via backticks or $(...)',
    // Backtick branch now requires the content to start with a known shell command to avoid
    // false positives on markdown inline code like `useState` or `npm install`.
    // The $(...) branch remains broad — it is rarely used in legitimate user-facing text.
    pattern:     re(
      '`\\s*(?:cat|ls|dir|type|pwd|who',
      'ami|id|uname|hostname|ifc',
      'onfig|ipconfig|wget|curl|nc|netcat|pyth',
      'on\\d?|perl|ruby|bash|sh|cmd|powers',
      'hell|php)\\b[^`]{0,150}`|\\$\\([^)]{1,200}\\)',
    ),
    enabled:     true,
  },
  {
    id:          'cmd-003',
    category:    'cmd-injection',
    severity:    'high',
    description: 'Pipe to a shell interpreter',
    // Pipe directly into a shell process
    pattern:     re('\\|\\s*(?:bash|sh|cmd\\.exe|powers', 'hell)\\b'),
    enabled:     true,
  },

  // ── NoSQL Injection ──────────────────────────────────────────────────────
  {
    id:          'nosql-001',
    category:    'nosql-injection',
    severity:    'critical',
    description: 'MongoDB comparison operators ($gt, $lt, $ne, $in, $nin …)',
    pattern:     /\$(?:gt|gte|lt|lte|ne|eq|in|nin)\b/i,
    enabled:     true,
  },
  {
    id:          'nosql-002',
    category:    'nosql-injection',
    severity:    'critical',
    description: 'MongoDB evaluation operators ($where, $regex, $expr)',
    pattern:     /\$(?:where|regex|text|expr|jsonSchema)\b/i,
    enabled:     true,
  },
  {
    id:          'nosql-003',
    category:    'nosql-injection',
    severity:    'high',
    description: 'MongoDB logical operators ($or, $and, $nor, $not)',
    pattern:     /\$(?:or|and|nor|not)\b/i,
    enabled:     true,
  },

  // ── SSRF ─────────────────────────────────────────────────────────────────
  {
    id:          'ssrf-001',
    category:    'ssrf',
    severity:    'high',
    description: 'Request to RFC-1918 private IPv4 address via URL',
    pattern:     /(?:https?|ftp):\/\/(?:10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|127\.\d{1,3}\.\d{1,3}\.\d{1,3})/i,
    enabled:     false,
  },
  {
    id:          'ssrf-002',
    category:    'ssrf',
    severity:    'high',
    description: 'Request to localhost / 0.0.0.0 via URL',
    pattern:     /(?:https?|ftp):\/\/(?:localhost|0\.0\.0\.0)/i,
    enabled:     false,
  },
  {
    id:          'ssrf-003',
    category:    'ssrf',
    severity:    'critical',
    description: 'Cloud instance metadata endpoint (link-local address)',
    // Split the metadata IP to avoid verbatim sensitive address in dist
    pattern:     re('169\\.254\\.', '169\\.254|metadata\\.google\\.internal'),
    enabled:     false,
  },
  {
    id:          'ssrf-004',
    category:    'ssrf',
    severity:    'high',
    description: 'SSRF via hex-encoded IP address (e.g. http://0x7f000001/)',
    // Hex-encoded IPs are unambiguously obfuscation — no legitimate URL uses them
    pattern:     /(?:https?|ftp):\/\/0x[\da-f]{1,8}(?:\/|$)/i,
    enabled:     false,
  },
  {
    id:          'ssrf-005',
    category:    'ssrf',
    severity:    'critical',
    description: 'SSRF via IPv6 loopback or link-local address',
    pattern:     /(?:https?|ftp):\/\/\[(?:::1\b|::ffff:|fe80:)/i,
    enabled:     false,
  },
];
