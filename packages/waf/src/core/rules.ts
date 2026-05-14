import type { WafRule } from './types.js';

/**
 * All patterns use the `i` flag only — never `g` or `gi`.
 * Rules are instantiated once and reused across requests; a stateful `g` flag
 * would advance `lastIndex` and cause alternating true/false results.
 */
export const BUILT_IN_RULES: WafRule[] = [
  // ── SQL Injection ────────────────────────────────────────────────────────
  {
    id:          'sqli-001',
    category:    'sqli',
    severity:    'critical',
    description: 'Tautology / boolean-based injection (OR/AND bypass)',
    pattern:     /(?:'|")\s*(?:OR|AND)\s+|(?:\s+|\b)(?:OR|AND)\s+\d+\s*=\s*\d+/i,
    enabled:     true,
  },
  {
    id:          'sqli-002',
    category:    'sqli',
    severity:    'critical',
    description: 'UNION-based SELECT injection',
    pattern:     /UNION\s+(?:ALL\s+)?SELECT\s+/i,
    enabled:     true,
  },
  {
    id:          'sqli-003',
    category:    'sqli',
    severity:    'critical',
    description: 'DDL attack — DROP, TRUNCATE, ALTER',
    pattern:     /(?:DROP|TRUNCATE|ALTER)\s+(?:TABLE|DATABASE|SCHEMA|INDEX|VIEW)\s+/i,
    enabled:     true,
  },
  {
    id:          'sqli-004',
    category:    'sqli',
    severity:    'critical',
    description: 'Stacked queries via semicolon',
    pattern:     /;\s*(?:SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|EXEC(?:UTE)?|ALTER|TRUNCATE)\b/i,
    enabled:     true,
  },
  {
    id:          'sqli-005',
    category:    'sqli',
    severity:    'high',
    description: 'Time-based blind injection (SLEEP, WAITFOR, BENCHMARK, PG_SLEEP)',
    pattern:     /(?:SLEEP|BENCHMARK|PG_SLEEP|WAITFOR\s+DELAY)\s*\(/i,
    enabled:     true,
  },
  {
    id:          'sqli-006',
    category:    'sqli',
    severity:    'high',
    description: 'System catalog / schema enumeration',
    pattern:     /information_schema|sys\.(?:tables|columns|databases|objects)|sysobjects|syscolumns|msysobjects/i,
    enabled:     true,
  },
  {
    id:          'sqli-007',
    category:    'sqli',
    severity:    'medium',
    description: 'Inline comment used to bypass WHERE clauses',
    pattern:     /(?:'|")\s*(?:--|#|\/\*)/i,
    enabled:     true,
  },

  // ── Cross-Site Scripting ─────────────────────────────────────────────────
  {
    id:          'xss-001',
    category:    'xss',
    severity:    'critical',
    description: '<script> tag injection',
    pattern:     /<script[\s>]/i,
    enabled:     true,
  },
  {
    id:          'xss-002',
    category:    'xss',
    severity:    'high',
    description: 'Inline event handler attribute (on*=)',
    pattern:     /\bon\w+\s*=/i,
    enabled:     true,
  },
  {
    id:          'xss-003',
    category:    'xss',
    severity:    'critical',
    description: 'javascript: / vbscript: / data:text/html protocol injection',
    pattern:     /(?:javascript|vbscript|data\s*:\s*text\/html)\s*:/i,
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
    description: 'Sensitive file access (/etc/passwd, win.ini, /proc/self)',
    pattern:     /(?:\/etc\/(?:passwd|shadow|hosts|group)|\/proc\/self|\\windows\\system32|win\.ini|boot\.ini)/i,
    enabled:     true,
  },
  {
    id:          'pt-004',
    category:    'path-traversal',
    severity:    'medium',
    description: 'Null byte injection used to truncate file paths',
    pattern:     /%00/,
    enabled:     true,
  },

  // ── Command Injection ────────────────────────────────────────────────────
  {
    id:          'cmd-001',
    category:    'cmd-injection',
    severity:    'critical',
    description: 'Shell operator followed by a system command',
    pattern:     /(?:;|\|\|?|&&)\s*(?:cat|ls|dir|type|pwd|whoami|id|uname|hostname|ifconfig|ipconfig|wget|curl|nc|netcat|python\d?|perl|ruby|bash|sh|cmd|powershell|php)\b/i,
    enabled:     true,
  },
  {
    id:          'cmd-002',
    category:    'cmd-injection',
    severity:    'critical',
    description: 'Command substitution via backticks or $(...)',
    pattern:     /`[^`]{1,200}`|\$\([^)]{1,200}\)/,
    enabled:     true,
  },
  {
    id:          'cmd-003',
    category:    'cmd-injection',
    severity:    'high',
    description: 'Pipe to a shell interpreter',
    pattern:     /\|\s*(?:bash|sh|cmd\.exe|powershell)\b/i,
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
    enabled:     false, // disabled by default — high false-positive rate in webhook URLs
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
    description: 'AWS EC2 instance metadata endpoint (169.254.169.254)',
    pattern:     /169\.254\.169\.254|metadata\.google\.internal/i,
    enabled:     false,
  },
];
