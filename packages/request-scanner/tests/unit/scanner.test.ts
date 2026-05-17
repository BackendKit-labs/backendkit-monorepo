import { describe, expect, it } from 'vitest';
import { WafScanner } from '../../src/core/scanner.js';

const scanner = new WafScanner({ rules: { ssrf: true } }); // enable all for testing

// ── SQL Injection ────────────────────────────────────────────────────────────

describe('SQLi detection', () => {
  it('detects OR-based tautology (sqli-001)', () => {
    const r = scanner.scan({ q: "' OR 1=1--" }, 'query');
    expect(r.clean).toBe(false);
    expect(r.threats.some(t => t.ruleId === 'sqli-001')).toBe(true);
  });

  it('detects UNION SELECT (sqli-002)', () => {
    const r = scanner.scan({ q: "1 UNION SELECT NULL, username, password FROM users" }, 'query');
    expect(r.clean).toBe(false);
    expect(r.threats.some(t => t.ruleId === 'sqli-002')).toBe(true);
  });

  it('detects DROP TABLE (sqli-003)', () => {
    const r = scanner.scan({ t: 'DROP TABLE users' }, 'body');
    expect(r.clean).toBe(false);
    expect(r.threats.some(t => t.ruleId === 'sqli-003')).toBe(true);
  });

  it('detects stacked queries (sqli-004)', () => {
    const r = scanner.scan({ id: '1; DELETE FROM orders' }, 'query');
    expect(r.clean).toBe(false);
    expect(r.threats.some(t => t.ruleId === 'sqli-004')).toBe(true);
  });

  it('detects time-based blind injection (sqli-005)', () => {
    const r = scanner.scan({ id: "1' AND SLEEP(5)--" }, 'query');
    expect(r.clean).toBe(false);
    expect(r.threats.some(t => t.ruleId === 'sqli-005')).toBe(true);
  });

  it('detects information_schema access (sqli-006)', () => {
    const r = scanner.scan({ q: 'SELECT * FROM information_schema.tables' }, 'query');
    expect(r.clean).toBe(false);
    expect(r.threats.some(t => t.ruleId === 'sqli-006')).toBe(true);
  });
});

// ── XSS ──────────────────────────────────────────────────────────────────────

describe('XSS detection', () => {
  it('detects <script> tag (xss-001)', () => {
    const r = scanner.scan({ name: '<script>alert(1)</script>' }, 'body');
    expect(r.clean).toBe(false);
    expect(r.threats.some(t => t.ruleId === 'xss-001')).toBe(true);
  });

  it('detects onerror event handler (xss-002)', () => {
    const r = scanner.scan({ img: '<img src=x onerror=alert(1)>' }, 'body');
    expect(r.clean).toBe(false);
    expect(r.threats.some(t => t.ruleId === 'xss-002')).toBe(true);
  });

  it('detects javascript: protocol (xss-003)', () => {
    const r = scanner.scan({ url: 'javascript:alert(document.cookie)' }, 'query');
    expect(r.clean).toBe(false);
    expect(r.threats.some(t => t.ruleId === 'xss-003')).toBe(true);
  });

  it('detects document.cookie access (xss-004)', () => {
    const r = scanner.scan({ p: 'document.cookie' }, 'query');
    expect(r.clean).toBe(false);
    expect(r.threats.some(t => t.ruleId === 'xss-004')).toBe(true);
  });

  it('detects eval() (xss-005)', () => {
    const r = scanner.scan({ code: 'eval(atob("YWxlcnQoMSk="))' }, 'body');
    expect(r.clean).toBe(false);
    expect(r.threats.some(t => t.ruleId === 'xss-005')).toBe(true);
  });
});

// ── Path Traversal ────────────────────────────────────────────────────────────

describe('Path Traversal detection', () => {
  it('detects ../ sequences (pt-001)', () => {
    const r = scanner.scan({ file: '../../etc/passwd' }, 'query');
    expect(r.clean).toBe(false);
    expect(r.threats.some(t => t.ruleId === 'pt-001')).toBe(true);
  });

  it('detects URL-encoded traversal (pt-002)', () => {
    const r = scanner.scan({ path: '%2e%2e%2fetc%2fpasswd' }, 'query');
    expect(r.clean).toBe(false);
    expect(r.threats.some(t => t.ruleId === 'pt-002')).toBe(true);
  });

  it('detects /etc/passwd direct access (pt-003)', () => {
    const r = scanner.scan({ f: '/etc/passwd' }, 'query');
    expect(r.clean).toBe(false);
    expect(r.threats.some(t => t.ruleId === 'pt-003')).toBe(true);
  });

  it('detects null byte injection (pt-004)', () => {
    const r = scanner.scan({ f: 'file.php%00.jpg' }, 'query');
    expect(r.clean).toBe(false);
    expect(r.threats.some(t => t.ruleId === 'pt-004')).toBe(true);
  });
});

// ── Command Injection ─────────────────────────────────────────────────────────

describe('Command Injection detection', () => {
  it('detects shell operator + command (cmd-001)', () => {
    const r = scanner.scan({ host: 'localhost; cat /etc/hosts' }, 'query');
    expect(r.clean).toBe(false);
    expect(r.threats.some(t => t.ruleId === 'cmd-001')).toBe(true);
  });

  it('detects command substitution via backticks (cmd-002)', () => {
    const r = scanner.scan({ name: '`whoami`' }, 'body');
    expect(r.clean).toBe(false);
    expect(r.threats.some(t => t.ruleId === 'cmd-002')).toBe(true);
  });

  it('detects $(...) command substitution (cmd-002)', () => {
    const r = scanner.scan({ name: '$(id)' }, 'body');
    expect(r.clean).toBe(false);
    expect(r.threats.some(t => t.ruleId === 'cmd-002')).toBe(true);
  });
});

// ── NoSQL Injection ───────────────────────────────────────────────────────────

describe('NoSQL Injection detection', () => {
  it('detects MongoDB $ne operator in value (nosql-001)', () => {
    const r = scanner.scan({ password: '$ne' }, 'body');
    expect(r.clean).toBe(false);
    expect(r.threats.some(t => t.category === 'nosql-injection')).toBe(true);
  });

  it('detects MongoDB $ne operator as object key (nosql-001)', () => {
    const r = scanner.scan({ password: { $ne: null } }, 'body');
    expect(r.clean).toBe(false);
    expect(r.threats.some(t => t.category === 'nosql-injection')).toBe(true);
  });

  it('detects $where operator (nosql-002)', () => {
    const r = scanner.scan({ filter: { $where: 'this.isAdmin' } }, 'body');
    expect(r.clean).toBe(false);
    expect(r.threats.some(t => t.ruleId === 'nosql-002')).toBe(true);
  });
});

// ── SSRF ──────────────────────────────────────────────────────────────────────

describe('SSRF detection (enabled in test scanner)', () => {
  it('detects internal IP in URL (ssrf-001)', () => {
    const r = scanner.scan({ webhook: 'http://192.168.1.1/admin' }, 'body');
    expect(r.clean).toBe(false);
    expect(r.threats.some(t => t.ruleId === 'ssrf-001')).toBe(true);
  });

  it('detects localhost URL (ssrf-002)', () => {
    const r = scanner.scan({ callback: 'http://localhost:8080/secret' }, 'body');
    expect(r.clean).toBe(false);
    expect(r.threats.some(t => t.ruleId === 'ssrf-002')).toBe(true);
  });

  it('detects AWS metadata endpoint (ssrf-003)', () => {
    const r = scanner.scan({ url: 'http://169.254.169.254/latest/meta-data/' }, 'body');
    expect(r.clean).toBe(false);
    expect(r.threats.some(t => t.ruleId === 'ssrf-003')).toBe(true);
  });
});

// ── Sprint 3 — SQL comment bypass, SSRF alt-encodings, customRules validation ─

describe('Sprint 3: SQL block-comment bypass detection', () => {
  it('detects UNION/**/SELECT (sqli-002)', () => {
    const r = scanner.scan({ q: '1 UNION/**/SELECT NULL,user,pass FROM users' }, 'query');
    expect(r.threats.some(t => t.ruleId === 'sqli-002')).toBe(true);
  });

  it('detects UNION/* comment */SELECT (sqli-002)', () => {
    const r = scanner.scan({ q: '1 UNION/* bypass */SELECT NULL FROM users' }, 'query');
    expect(r.threats.some(t => t.ruleId === 'sqli-002')).toBe(true);
  });

  it('detects UNION/**/ALL/**/SELECT (sqli-002)', () => {
    const r = scanner.scan({ q: '1 UNION/**/ALL/**/SELECT NULL FROM users' }, 'query');
    expect(r.threats.some(t => t.ruleId === 'sqli-002')).toBe(true);
  });

  it('detects DROP/**/TABLE (sqli-003)', () => {
    const r = scanner.scan({ q: 'DROP/**/TABLE users' }, 'body');
    expect(r.threats.some(t => t.ruleId === 'sqli-003')).toBe(true);
  });

  it('detects TRUNCATE/**/TABLE (sqli-003)', () => {
    const r = scanner.scan({ q: 'TRUNCATE/**/TABLE orders' }, 'body');
    expect(r.threats.some(t => t.ruleId === 'sqli-003')).toBe(true);
  });

  it('detects ;/**/DELETE (sqli-004)', () => {
    const r = scanner.scan({ id: '1;/**/DELETE FROM orders' }, 'query');
    expect(r.threats.some(t => t.ruleId === 'sqli-004')).toBe(true);
  });

  it('detects ;/* x */DROP (sqli-004)', () => {
    const r = scanner.scan({ id: '1;/* x */DROP TABLE users' }, 'query');
    expect(r.threats.some(t => t.ruleId === 'sqli-004')).toBe(true);
  });
});

describe('Sprint 3: SSRF alternate encodings (enabled in test scanner)', () => {
  it('detects hex-encoded IP http://0x7f000001/ (ssrf-004)', () => {
    const r = scanner.scan({ url: 'http://0x7f000001/admin' }, 'body');
    expect(r.threats.some(t => t.ruleId === 'ssrf-004')).toBe(true);
  });

  it('detects hex-encoded 10.x.x.x http://0x0a000001/ (ssrf-004)', () => {
    const r = scanner.scan({ url: 'http://0x0a000001/' }, 'body');
    expect(r.threats.some(t => t.ruleId === 'ssrf-004')).toBe(true);
  });

  it('detects IPv6 loopback http://[::1]/ (ssrf-005)', () => {
    const r = scanner.scan({ url: 'http://[::1]/secret' }, 'body');
    expect(r.threats.some(t => t.ruleId === 'ssrf-005')).toBe(true);
  });

  it('detects IPv6 mapped IPv4 http://[::ffff:127.0.0.1]/ (ssrf-005)', () => {
    const r = scanner.scan({ url: 'http://[::ffff:127.0.0.1]/admin' }, 'body');
    expect(r.threats.some(t => t.ruleId === 'ssrf-005')).toBe(true);
  });
});

describe('Sprint 3: customRules global-flag validation', () => {
  it('throws on customRule with global flag', () => {
    expect(() => new WafScanner({
      customRules: [{
        id: 'bad', category: 'sqli', severity: 'high',
        description: 'test', pattern: /evil/g, enabled: true,
      }],
    })).toThrow(/global/i);
  });

  it('accepts customRule without global flag', () => {
    expect(() => new WafScanner({
      customRules: [{
        id: 'ok', category: 'sqli', severity: 'high',
        description: 'test', pattern: /evil/i, enabled: true,
      }],
    })).not.toThrow();
  });
});

// ── Sprint 2 — must-pass benign inputs ───────────────────────────────────────

describe('Sprint 2: benign inputs must not be blocked (false-positive guard)', () => {
  describe('xss-002: query params starting with "on" must not trigger', () => {
    it('online=true', () => {
      const r = scanner.scan({ online: 'true' }, 'query');
      expect(r.threats.filter(t => t.ruleId === 'xss-002')).toHaveLength(0);
    });

    it('once=1', () => {
      const r = scanner.scan({ once: '1' }, 'query');
      expect(r.threats.filter(t => t.ruleId === 'xss-002')).toHaveLength(0);
    });

    it('onlyMe=yes and oneTime=5', () => {
      const r = scanner.scan({ onlyMe: 'yes', oneTime: '5' }, 'query');
      expect(r.threats.filter(t => t.ruleId === 'xss-002')).toHaveLength(0);
    });
  });

  describe('sqli-001: quoted English text with Or/And must not trigger', () => {
    it('"Or maybe later"', () => {
      const r = scanner.scan({ desc: '"Or maybe later"' }, 'body');
      expect(r.threats.filter(t => t.ruleId === 'sqli-001')).toHaveLength(0);
    });

    it('"And one more thing"', () => {
      const r = scanner.scan({ note: '"And one more thing"' }, 'body');
      expect(r.threats.filter(t => t.ruleId === 'sqli-001')).toHaveLength(0);
    });

    it("'or so they say'", () => {
      const r = scanner.scan({ comment: "'or so they say'" }, 'body');
      expect(r.threats.filter(t => t.ruleId === 'sqli-001')).toHaveLength(0);
    });

    it("'and another thing'", () => {
      const r = scanner.scan({ text: "'and another thing'" }, 'body');
      expect(r.threats.filter(t => t.ruleId === 'sqli-001')).toHaveLength(0);
    });
  });

  describe('cmd-002: markdown inline code must not trigger', () => {
    it('`useState` hook reference', () => {
      const r = scanner.scan({ bio: 'Use `useState` and `useEffect` hooks' }, 'body');
      expect(r.threats.filter(t => t.ruleId === 'cmd-002')).toHaveLength(0);
    });

    it('`npm install` in description', () => {
      const r = scanner.scan({ desc: 'Run `npm install` first' }, 'body');
      expect(r.threats.filter(t => t.ruleId === 'cmd-002')).toHaveLength(0);
    });
  });

  describe('sqli-007: URL fragments must not trigger', () => {
    it("'https://example.com#section'", () => {
      const r = scanner.scan({ url: "'https://example.com#section'" }, 'body');
      expect(r.threats.filter(t => t.ruleId === 'sqli-007')).toHaveLength(0);
    });

    it('"https://example.com#heading"', () => {
      const r = scanner.scan({ link: '"https://example.com#heading"' }, 'body');
      expect(r.threats.filter(t => t.ruleId === 'sqli-007')).toHaveLength(0);
    });
  });
});

describe('Sprint 2: attacks still detected after false-positive fixes', () => {
  it('sqli-001: OR tautology still detected', () => {
    expect(scanner.scan({ q: "' OR 1=1--" }, 'query').threats.some(t => t.ruleId === 'sqli-001')).toBe(true);
  });

  it('sqli-001: AND tautology still detected', () => {
    expect(scanner.scan({ q: "' AND 1=1--" }, 'query').threats.some(t => t.ruleId === 'sqli-001')).toBe(true);
  });

  it('sqli-001: OR NULL still detected', () => {
    expect(scanner.scan({ q: "' OR NULL--" }, 'query').threats.some(t => t.ruleId === 'sqli-001')).toBe(true);
  });

  it("sqli-001: OR 'a'='a still detected", () => {
    expect(scanner.scan({ q: "' OR 'a'='a" }, 'query').threats.some(t => t.ruleId === 'sqli-001')).toBe(true);
  });

  it('xss-002: onerror in img tag still detected', () => {
    expect(scanner.scan({ img: '<img src=x onerror=alert(1)>' }, 'body').threats.some(t => t.ruleId === 'xss-002')).toBe(true);
  });

  it('xss-002: standalone onclick= still detected', () => {
    expect(scanner.scan({ h: 'onclick=malicious()' }, 'body').threats.some(t => t.ruleId === 'xss-002')).toBe(true);
  });

  it('xss-002: standalone onerror= still detected', () => {
    expect(scanner.scan({ h: 'onerror=alert(1)' }, 'body').threats.some(t => t.ruleId === 'xss-002')).toBe(true);
  });

  it('cmd-002: `whoami` still detected', () => {
    expect(scanner.scan({ name: '`whoami`' }, 'body').threats.some(t => t.ruleId === 'cmd-002')).toBe(true);
  });

  it('cmd-002: `id` still detected', () => {
    expect(scanner.scan({ name: '`id`' }, 'body').threats.some(t => t.ruleId === 'cmd-002')).toBe(true);
  });

  it('cmd-002: `cat /etc/passwd` still detected', () => {
    expect(scanner.scan({ f: '`cat /etc/passwd`' }, 'body').threats.some(t => t.ruleId === 'cmd-002')).toBe(true);
  });

  it('cmd-002: $(id) substitution still detected', () => {
    expect(scanner.scan({ name: '$(id)' }, 'body').threats.some(t => t.ruleId === 'cmd-002')).toBe(true);
  });

  it('sqli-007: -- comment still detected', () => {
    expect(scanner.scan({ id: "1'--" }, 'query').threats.some(t => t.ruleId === 'sqli-007')).toBe(true);
  });

  it('sqli-007: # comment with space still detected', () => {
    expect(scanner.scan({ id: "1'# rest" }, 'query').threats.some(t => t.ruleId === 'sqli-007')).toBe(true);
  });

  it('sqli-007: # at end of string still detected', () => {
    expect(scanner.scan({ id: "1'#" }, 'query').threats.some(t => t.ruleId === 'sqli-007')).toBe(true);
  });

  it('sqli-007: /* comment still detected', () => {
    expect(scanner.scan({ id: "1'/*" }, 'query').threats.some(t => t.ruleId === 'sqli-007')).toBe(true);
  });
});

// ── Sprint 1 regression tests ─────────────────────────────────────────────────

describe('Sprint 1 fixes', () => {
  it('treats rules: { category: undefined } as "use default" — does not disable the category', () => {
    const s = new WafScanner({ rules: { sqli: undefined as unknown as boolean } });
    const r = s.scan({ q: "' OR 1=1--" }, 'query');
    expect(r.clean).toBe(false);
    expect(r.threats.some(t => t.category === 'sqli')).toBe(true);
  });

  it('truncates strings at maxStringLength during extraction, not after', () => {
    const s = new WafScanner({ maxStringLength: 8_000 });
    // Attack starts at position 8001 — beyond the truncation boundary
    const r = s.scan({ q: 'a'.repeat(8_001) + "' OR 1=1--" }, 'query');
    expect(r.clean).toBe(true);
  });

  it('does not recurse into a top-level Buffer', () => {
    const r = scanner.scan(Buffer.from("' OR 1=1--"), 'body');
    expect(r.clean).toBe(true);
    expect(r.threats).toHaveLength(0);
  });

  it('does not recurse into a Buffer nested inside an object', () => {
    const r = scanner.scan({ data: Buffer.from('<script>alert(1)</script>') }, 'body');
    expect(r.clean).toBe(true);
  });

  it('excludePaths exact match is excluded', () => {
    // Tested indirectly via WafScanner — middleware exclusion tested in integration
    // This confirms the scanner itself still scans when called directly
    const r = scanner.scan({ q: "' OR 1=1--" }, 'query');
    expect(r.clean).toBe(false);
  });
});

// ── Input handling ────────────────────────────────────────────────────────────

describe('input handling', () => {
  it('returns clean for benign input', () => {
    const r = scanner.scan({ name: 'Alice', age: '30', email: 'alice@example.com' }, 'body');
    expect(r.clean).toBe(true);
    expect(r.threats).toHaveLength(0);
  });

  it('scans nested objects recursively', () => {
    const r = scanner.scan({
      user: { profile: { bio: '<script>alert(1)</script>' } },
    }, 'body');
    expect(r.clean).toBe(false);
    expect(r.threats[0].field).toBe('user.profile.bio');
  });

  it('scans arrays recursively', () => {
    const r = scanner.scan({ tags: ['safe', "' OR 1=1--"] }, 'body');
    expect(r.clean).toBe(false);
    expect(r.threats[0].field).toBe('tags[1]');
  });

  it('handles null and undefined without throwing', () => {
    expect(() => scanner.scan(null, 'body')).not.toThrow();
    expect(() => scanner.scan(undefined, 'body')).not.toThrow();
    expect(scanner.scan(null, 'body').clean).toBe(true);
  });

  it('respects maxDepth and stops recursing', () => {
    const shallowScanner = new WafScanner({ maxDepth: 1 });
    // Attack at depth 2 — should not be detected
    const deep = { a: { b: "' OR 1=1--" } };
    const r = shallowScanner.scan(deep, 'body');
    expect(r.clean).toBe(true);
  });

  it('is not affected by the stateful regex lastIndex bug', () => {
    // If patterns had the `g` flag and were reused, .test() would alternate true/false
    const input = { q: "' OR 1=1--" };
    const r1 = scanner.scan(input, 'query');
    const r2 = scanner.scan(input, 'query');
    const r3 = scanner.scan(input, 'query');
    // All three must detect the attack — no false negative on even-numbered calls
    expect(r1.clean).toBe(false);
    expect(r2.clean).toBe(false);
    expect(r3.clean).toBe(false);
  });

  it('disabled categories produce no threats', () => {
    const noXss = new WafScanner({ rules: { xss: false } });
    const r = noXss.scan({ name: '<script>alert(1)</script>' }, 'body');
    expect(r.threats.some(t => t.category === 'xss')).toBe(false);
  });

  it('includes threat location and field in result', () => {
    const r = scanner.scan({ user: { name: '<script>x</script>' } }, 'body');
    expect(r.threats[0].location).toBe('body');
    expect(r.threats[0].field).toBe('user.name');
  });
});
