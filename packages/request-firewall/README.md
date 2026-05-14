# @backendkit-labs/request-firewall

[![npm version](https://img.shields.io/npm/v/@backendkit-labs/request-firewall?style=flat-square&color=cb3837)](https://www.npmjs.com/package/@backendkit-labs/request-firewall)
[![CI](https://img.shields.io/github/actions/workflow/status/backendkit-dev/backendkit-monorepo/ci.yml?style=flat-square&label=CI)](https://github.com/backendkit-dev/backendkit-monorepo/actions/workflows/ci.yml)
[![License](https://img.shields.io/npm/l/@backendkit-labs/request-firewall?style=flat-square)](LICENSE)
[![Node](https://img.shields.io/node/v/@backendkit-labs/request-firewall?style=flat-square)](package.json)

> Web Application Firewall for Node.js â€” pattern-based threat detection with optional NestJS integration.

Detects and blocks the most common web attack vectors before they reach your application logic. Framework-agnostic core with 23 built-in rules across 6 categories. Designed for production: configurable modes, per-category toggles, path exclusions, and zero runtime dependencies in the core.

---

## Attack Categories

| Category | Rules | Severity | Default |
|---|---|---|---|
| SQL Injection | 7 | critical â€“ medium | âœ… enabled |
| XSS | 7 | critical â€“ medium | âœ… enabled |
| Path Traversal | 4 | critical â€“ medium | âœ… enabled |
| Command Injection | 3 | critical â€“ high | âœ… enabled |
| NoSQL Injection | 3 | critical â€“ high | âœ… enabled |
| SSRF | 3 | critical â€“ high | âš ï¸ opt-in |

SSRF is disabled by default due to higher false-positive rates in services that accept webhook URLs. Enable it explicitly when you control all URL inputs.

---

## Installation

```bash
npm install @backendkit-labs/request-firewall
```

NestJS peer dependencies (only for the `/nestjs` subpath):

```bash
npm install @nestjs/common @nestjs/core rxjs
```

---

## TypeScript Configuration

### Subpath exports (`/nestjs`)

This package uses the `exports` field in `package.json` to expose the `/nestjs` subpath. TypeScript's ability to resolve it depends on the `moduleResolution` setting in your `tsconfig.json`.

**Modern resolution (recommended) â€” no extra config needed:**

```json
{
  "compilerOptions": {
    "moduleResolution": "bundler"
  }
}
```

`"bundler"`, `"node16"`, and `"nodenext"` all understand the `exports` field natively. This is the recommended setting for any project using a bundler or NestJS on TypeScript â‰¥ 5.

**Legacy resolution (`"node"`) â€” add a `paths` alias:**

NestJS projects generated before ~2024 default to `"moduleResolution": "node"`, which ignores the `exports` field. Add an explicit alias so TypeScript can find the types:

```json
{
  "compilerOptions": {
    "moduleResolution": "node",
    "paths": {
      "@backendkit-labs/request-firewall/nestjs": [
        "./node_modules/@backendkit-labs/request-firewall/dist/nestjs/index"
      ]
    }
  }
}
```

> **Why?** The `"node"` resolver was designed before subpath exports existed and only reads `main`/`types` at the package root â€” it ignores the `exports` map entirely. The `paths` alias manually points TypeScript to the correct `.d.ts` file.

### NestJS decorator support

```json
{
  "compilerOptions": {
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  }
}
```

And import `reflect-metadata` once at application startup:

```typescript
// main.ts
import 'reflect-metadata';
```

> NestJS CLI scaffolds these automatically. You only need to verify them if setting up a project manually.

---

## Quick Start â€” Framework-agnostic

```typescript
import { WafScanner } from '@backendkit-labs/request-firewall';

const scanner = new WafScanner();

const result = scanner.scan(req.body, 'body');
if (!result.clean) {
  console.log(result.threats); // [{ ruleId, category, severity, location, field, value }]
  return res.status(403).json({ message: 'Blocked' });
}
```

---

## Quick Start â€” NestJS

```typescript
// app.module.ts
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { WafModule, WafMiddleware } from '@backendkit-labs/request-firewall/nestjs';

@Module({
  imports: [
    WafModule.forRoot({
      mode:         'block',
      excludePaths: ['/health', '/metrics'],
      onThreat: (threats, req) => {
        logger.warn('WAF blocked request', {
          url:     req.url,
          threats: threats.map(t => ({ rule: t.ruleId, field: t.field })),
        });
      },
    }),
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(WafMiddleware).forRoutes('*');
  }
}
```

---

## WafScanner API

The `WafScanner` is the core detection engine. It is framework-agnostic and has no runtime dependencies.

### Constructor

```typescript
const scanner = new WafScanner(options?);
```

### `scan(data, location)`

Scans any value â€” string, object, array, or nested structure â€” for threats. Recursively extracts all string values including **object keys** (critical for NoSQL injection detection).

```typescript
const result = scanner.scan(req.body, 'body');
// WafScanResult { clean: boolean, threats: WafThreat[] }

result.clean           // false if any threat was found
result.threats         // WafThreat[]
result.threats[0].ruleId    // 'sqli-002'
result.threats[0].category  // 'sqli'
result.threats[0].severity  // 'critical'
result.threats[0].location  // 'body'
result.threats[0].field     // 'user.filter.$ne[key]'
result.threats[0].value     // truncated matched string (max 120 chars)
```

### `WafScannerOptions`

```typescript
new WafScanner({
  // Enable or disable individual categories.
  // Explicit value overrides the rule's built-in default.
  rules: {
    sqli:          true,  // default: true
    xss:           true,  // default: true
    'path-traversal': true, // default: true
    'cmd-injection':  true, // default: true
    'nosql-injection': true, // default: true
    ssrf:          false, // default: false â€” opt-in
  },

  // Custom rules merged on top of built-in ones
  customRules: [
    {
      id:          'custom-001',
      category:    'sqli',
      severity:    'high',
      description: 'Company-specific table name detection',
      pattern:     /FROM\s+internal_users/i,
      enabled:     true,
    },
  ],

  maxDepth:        10,    // max recursion depth for nested objects
  maxStringLength: 8_000, // strings are truncated before pattern testing
});
```

---

## Built-in Rules

### SQL Injection

| Rule ID | Pattern | Severity |
|---------|---------|---------|
| `sqli-001` | Tautology / boolean bypass (`' OR 1=1`) | critical |
| `sqli-002` | UNION SELECT | critical |
| `sqli-003` | DDL attack (DROP, TRUNCATE, ALTER) | critical |
| `sqli-004` | Stacked queries via `;` | critical |
| `sqli-005` | Time-based blind (SLEEP, WAITFOR, BENCHMARK) | high |
| `sqli-006` | System catalog / information_schema access | high |
| `sqli-007` | Inline SQL comment to bypass WHERE (`'--`) | medium |

### XSS

| Rule ID | Pattern | Severity |
|---------|---------|---------|
| `xss-001` | `<script>` tag injection | critical |
| `xss-002` | Inline event handler (`onerror=`, `onclick=`, â€¦) | high |
| `xss-003` | `javascript:` / `vbscript:` protocol | critical |
| `xss-004` | `document.cookie` / `document.write` | high |
| `xss-005` | `eval()` call | high |
| `xss-006` | CSS `expression()` / `behavior:` | medium |
| `xss-007` | HTML-entity encoded `<script` (`&#60;script`) | medium |

### Path Traversal

| Rule ID | Pattern | Severity |
|---------|---------|---------|
| `pt-001` | `../` or `..\` sequences | high |
| `pt-002` | URL-encoded traversal (`%2e%2e%2f`, `%252e%252e`) | high |
| `pt-003` | Sensitive file access (`/etc/passwd`, `win.ini`) | critical |
| `pt-004` | Null byte injection (`%00`) | medium |

### Command Injection

| Rule ID | Pattern | Severity |
|---------|---------|---------|
| `cmd-001` | Shell operator + system command (`; cat`, `\|\| whoami`) | critical |
| `cmd-002` | Command substitution (`` `...` `` or `$(...)`) | critical |
| `cmd-003` | Pipe to shell interpreter (`\| bash`) | high |

### NoSQL Injection

| Rule ID | Pattern | Severity |
|---------|---------|---------|
| `nosql-001` | MongoDB comparison operators (`$gt`, `$lt`, `$ne`, `$in` â€¦) | critical |
| `nosql-002` | MongoDB evaluation operators (`$where`, `$regex`, `$expr`) | critical |
| `nosql-003` | MongoDB logical operators (`$or`, `$and`, `$nor`) | high |

### SSRF (opt-in)

| Rule ID | Pattern | Severity |
|---------|---------|---------|
| `ssrf-001` | RFC-1918 private IP in URL (`10.x`, `192.168.x`, â€¦) | high |
| `ssrf-002` | Localhost / `0.0.0.0` in URL | high |
| `ssrf-003` | AWS EC2 metadata endpoint (`169.254.169.254`) | critical |

---

## NestJS Integration

### `WafModule.forRoot(options)`

```typescript
WafModule.forRoot({
  // 'block'   â€” reject with 403 (default)
  // 'log'     â€” allow but call onThreat and attach req.wafThreats
  // 'monitor' â€” allow and call onThreat, no console output
  mode: 'block',

  rules: {
    ssrf: true,            // opt-in for SSRF detection
    'cmd-injection': false, // disable for this service
  },

  scanTargets: ['query', 'body', 'params'], // default â€” add 'headers' or 'cookies' if needed

  excludePaths: ['/health', '/metrics', '/favicon.ico'],

  onThreat: (threats, req) => {
    alerting.trigger('waf.threat', {
      url:     req.url,
      method:  req.method,
      threats: threats.map(t => t.ruleId),
    });
  },

  maxDepth:        10,
  maxStringLength: 8_000,
});
```

### `WafMiddleware`

Apply to all routes in `AppModule.configure()`:

```typescript
import { MiddlewareConsumer, NestModule } from '@nestjs/common';
import { WafMiddleware } from '@backendkit-labs/request-firewall/nestjs';

export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(WafMiddleware).forRoutes('*');
  }
}
```

**Block mode** response (HTTP 403):

```json
{
  "ok":       false,
  "message":  "Request blocked by WAF",
  "code":     "WAF_SQLI",
  "ruleId":   "sqli-002",
  "location": "body"
}
```

**Log / monitor mode** â€” the request continues and threats are attached to the request object for downstream inspection:

```typescript
// In a guard or interceptor
const threats = (req as any).wafThreats; // WafThreat[] | undefined
```

### `SanitizePipe`

Validates individual controller parameters. Throws `BadRequestException` when a threat is detected.

```typescript
import { SanitizePipe } from '@backendkit-labs/request-firewall/nestjs';

@Controller('users')
export class UsersController {
  // Per-param validation
  @Get(':id')
  findOne(@Param('id', SanitizePipe) id: string) { ... }

  // Entire body
  @Post()
  create(@Body(new SanitizePipe(null, null, 'body')) dto: CreateDto) { ... }
}
```

**Error response (HTTP 400):**

```json
{
  "message": "Invalid input detected",
  "code":    "WAF_XSS",
  "ruleId":  "xss-001",
  "field":   "bio"
}
```

---

## Design Notes

### Why not `g` flag on patterns?

`RegExp` objects with the `g` flag are **stateful** â€” `.test()` advances `lastIndex` after a match. When rules are instantiated once and reused across requests (as they must be for performance), using `g` causes every second call to return a false negative:

```typescript
const pattern = /UNION\s+SELECT/gi; // â† has `g`
pattern.test("UNION SELECT null"); // true  (lastIndex = 16)
pattern.test("UNION SELECT null"); // false (starts from lastIndex 16, no match)
pattern.test("UNION SELECT null"); // true  (lastIndex reset after miss)
```

All built-in rules use the `i` flag only. If you write custom rules, never use `g` or `gi`.

### Object keys are scanned

`JSON.stringify` converts `{ "$ne": null }` to `'{"$ne":null}'` which looks like a string and matches patterns. But it also adds quotes, escapes characters, and makes it hard to report which field was attacked.

This scanner recursively walks the object and scans **keys and values separately** â€” so `{ password: { "$ne": null } }` is caught via the key `$ne`, with the field reported as `password.$ne[key]`.

### SSRF is opt-in

Patterns like `http://192.168.x.x` have a high false-positive rate in services that accept webhook URLs, redirect URIs, or RSS feed URLs from users. Enable SSRF detection only when you can validate that all URL inputs are fully user-controlled and should never point to internal addresses.

---

## Architecture

```
@backendkit-labs/request-firewall             (core â€” zero runtime dependencies)
  WafScanner                     detection engine
  BUILT_IN_RULES                 23 pre-compiled rules across 6 categories
  WafScanResult / WafThreat      result types

@backendkit-labs/request-firewall/nestjs      (optional NestJS layer)
  WafModule                      DynamicModule with forRoot()
  WafMiddleware                  global request scanner
  SanitizePipe                   per-param / per-body validation
```

---

## License

Apache-2.0 â€” [BackendKit Labs](https://github.com/backendkit-dev)


