---
title: Request Firewall
description: Web Application Firewall for Node.js — 23 built-in threat-detection rules across 6 attack categories, framework-agnostic core, and optional NestJS integration.
---

# @backendkit-labs/request-scanner

[![npm](https://img.shields.io/npm/v/@backendkit-labs/request-scanner?style=flat-square&color=cb3837)](https://www.npmjs.com/package/@backendkit-labs/request-scanner)
[![License](https://img.shields.io/npm/l/@backendkit-labs/request-scanner?style=flat-square)](https://github.com/BackendKit-labs/backendkit-monorepo/blob/master/LICENSE)
[![Node](https://img.shields.io/node/v/@backendkit-labs/request-scanner?style=flat-square)](https://nodejs.org)

> Web Application Firewall for Node.js. Pattern-based threat detection with 23 built-in rules across 6 attack categories. Zero runtime dependencies.

Framework-agnostic core that works in any Node.js project. Optional NestJS integration adds a blocking middleware, a sanitization pipe, and a module for declarative configuration.

## Installation

```bash
npm install @backendkit-labs/request-scanner
```

NestJS peer dependencies (only for the `/nestjs` subpath):

```bash
npm install @nestjs/common @nestjs/core rxjs
```

## Attack Categories

| Category | Rules | Severity | Enabled by default |
|---|---|---|---|
| SQL Injection | 7 | critical – medium | Yes |
| XSS | 7 | critical – medium | Yes |
| Path Traversal | 4 | critical – medium | Yes |
| Command Injection | 3 | critical – high | Yes |
| NoSQL Injection | 3 | critical – high | Yes |
| SSRF | 3 | critical – high | No (opt-in) |

:::warning SSRF rules require opt-in
SSRF detection patterns match URLs and IP ranges, which can produce false positives in applications that legitimately accept URLs as input (e.g., webhook configuration forms). Enable them explicitly after reviewing your use case.
:::

## Quick Start

```typescript
import { WafScanner } from '@backendkit-labs/request-scanner';

const scanner = new WafScanner();

// Scan any object — body, query params, route params, headers
const result = scanner.scan(req.body, 'body');

if (!result.clean) {
  console.log(result.threats);
  // [{ ruleId: 'sqli-001', category: 'sql-injection', severity: 'critical',
  //    location: 'body', field: 'username', value: "' OR '1'='1" }]
  res.status(400).json({ error: 'Request blocked' });
}
```

## WafScanner

### Constructor options

```typescript
const scanner = new WafScanner({
  // Enable optional rule categories (all default-enabled categories are always active)
  rules: {
    ssrf: true,   // opt-in SSRF detection
  },

  // Max object nesting depth to traverse (default: 10)
  // Prevents prototype-pollution via deeply nested payloads
  maxDepth: 10,
});
```

### `.scan(input, location)`

Recursively scans `input` against all active rules.

```typescript
const result = scanner.scan(input, location);
// result.clean:   boolean — true if no threats found
// result.threats: WafThreat[]
```

`location` is a label attached to every threat for traceability — use `'body'`, `'query'`, `'params'`, `'headers'`, or any custom string.

### `WafThreat`

```typescript
interface WafThreat {
  ruleId:   string;    // e.g. 'sqli-001', 'xss-003'
  category: string;   // 'sql-injection' | 'xss' | 'path-traversal' | ...
  severity: 'critical' | 'high' | 'medium' | 'low';
  location: string;   // the label passed to .scan()
  field:    string;   // dot-notation path within the object — e.g. 'user.address.city'
  value:    string;   // the offending string value
}
```

### Scanning multiple sources

```typescript
const bodyResult   = scanner.scan(req.body,   'body');
const queryResult  = scanner.scan(req.query,  'query');
const paramsResult = scanner.scan(req.params, 'params');

const allThreats = [
  ...bodyResult.threats,
  ...queryResult.threats,
  ...paramsResult.threats,
];

if (allThreats.length > 0) {
  return res.status(400).json({ error: 'Malicious input detected', threats: allThreats });
}
```

### Standalone usage (Express, Fastify, plain Node.js)

```typescript
import { WafScanner } from '@backendkit-labs/request-scanner';

const scanner = new WafScanner({ rules: { ssrf: true } });

function wafMiddleware(req, res, next) {
  const sources = [
    scanner.scan(req.body,   'body'),
    scanner.scan(req.query,  'query'),
    scanner.scan(req.params, 'params'),
  ];

  const threats = sources.flatMap(r => r.threats);

  if (threats.length > 0) {
    return res.status(400).json({ error: 'Request blocked by WAF', threats });
  }

  next();
}

app.use(express.json());
app.use(wafMiddleware);
```

## NestJS Integration

### `WafModule.forRoot()`

```typescript
// app.module.ts
import { WafModule, WafMiddleware } from '@backendkit-labs/request-scanner/nestjs';
import { NestModule, MiddlewareConsumer, Module } from '@nestjs/common';

@Module({
  imports: [
    WafModule.forRoot({
      // 'block'   — reject threats with 400 Bad Request (default)
      // 'log'     — log and pass through
      // 'monitor' — collect metrics only, no logging, no blocking
      mode: 'block',

      // Paths excluded from WAF scanning
      excludePaths: ['/health', '/metrics', '/docs'],

      // Enable opt-in rule categories
      rules: { ssrf: true },

      // Called when threats are detected (all modes)
      onThreat: (threats, req) => {
        logger.warn('WAF threat detected', {
          ip:       req.ip,
          path:     req.path,
          threats,
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

:::tip Mode selection
Use `'block'` in production. Use `'log'` when first deploying to measure false positive rate without impacting traffic. Use `'monitor'` in tests or when you handle blocking logic via `onThreat` yourself.
:::

### `WafMiddleware` — global request scanning

`WafMiddleware` scans `req.body`, `req.query`, and `req.params` for every request. When a threat is found in `'block'` mode it immediately responds with `400 Bad Request`:

```json
{
  "statusCode": 400,
  "error":      "Bad Request",
  "message":    "Request blocked by WAF",
  "threats": [
    {
      "ruleId":   "sqli-001",
      "category": "sql-injection",
      "severity": "critical",
      "location": "body",
      "field":    "filters.name",
      "value":    "' OR 1=1 --"
    }
  ]
}
```

Paths in `excludePaths` receive no scanning and pass through immediately.

### `SanitizePipe` — per-parameter scanning

Apply at the controller level to scan individual parameters. Throws `BadRequestException` if the value contains threats.

```typescript
import { SanitizePipe } from '@backendkit-labs/request-scanner/nestjs';
import { Controller, Get, Post, Param, Body } from '@nestjs/common';

@Controller('products')
export class ProductsController {
  // Scan a route param
  @Get(':id')
  findOne(@Param('id', SanitizePipe) id: string) {
    return this.productsService.findOne(id);
  }

  // Scan a body DTO
  @Post('search')
  search(@Body(SanitizePipe) dto: SearchDto) {
    return this.productsService.search(dto);
  }
}
```

:::info SanitizePipe vs WafMiddleware
Use `WafMiddleware` globally to protect all endpoints at once. Use `SanitizePipe` when you need selective scanning — for example, when some endpoints legitimately accept HTML or URL values that would trigger middleware-level rules.
:::

## TypeScript Configuration

### Modern bundler (`moduleResolution: bundler` or `node16`)

Subpath exports resolve automatically — no extra configuration needed.

```json
{
  "compilerOptions": {
    "moduleResolution": "bundler"
  }
}
```

### Legacy `node` moduleResolution

Add a path alias for the NestJS subpath:

```json
{
  "compilerOptions": {
    "moduleResolution": "node",
    "paths": {
      "@backendkit-labs/request-scanner/nestjs": [
        "./node_modules/@backendkit-labs/request-scanner/dist/nestjs/index"
      ]
    }
  }
}
```

## Architecture

```
@backendkit-labs/request-scanner              (core — zero runtime dependencies)
  WafScanner                                   pattern-based scanner with configurable rules
  WafThreat                                    structured threat report (ruleId, field, value, ...)
  23 built-in rules across 6 categories        SQL injection, XSS, Path Traversal,
                                               Command Injection, NoSQL Injection, SSRF

@backendkit-labs/request-scanner/nestjs       (optional NestJS layer)
  WafModule                                    NestJS module — .forRoot() configuration
  WafMiddleware                                global request scanning middleware
  SanitizePipe                                 per-parameter NestJS pipe
```
