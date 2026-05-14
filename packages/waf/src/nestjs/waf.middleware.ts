import { Inject, Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { WafScanner } from '../core/scanner.js';
import type { ScanTarget, WafThreat } from '../core/types.js';
import { WAF_OPTIONS, type WafModuleOptions } from './waf.options.js';

const DEFAULT_TARGETS: ScanTarget[] = ['query', 'body', 'params'];

@Injectable()
export class WafMiddleware implements NestMiddleware {
  constructor(
    @Inject(WAF_OPTIONS) private readonly options: WafModuleOptions,
    private readonly scanner: WafScanner,
  ) {}

  use(req: Request, res: Response, next: NextFunction): void {
    if (this.isExcluded(req.path)) return next();

    const targets = this.options.scanTargets ?? DEFAULT_TARGETS;
    const threats: WafThreat[] = [];
    const mode    = this.options.mode ?? 'block';

    for (const target of targets) {
      const data = this.getTarget(req, target);
      if (data === undefined) continue;

      const result = this.scanner.scan(data, target);
      threats.push(...result.threats);

      // Fail fast on block mode — no need to scan remaining targets
      if (threats.length > 0 && mode === 'block') break;
    }

    if (threats.length === 0) return next();

    this.options.onThreat?.(threats, req);

    if (mode !== 'block') {
      // log / monitor — attach threats to request for downstream inspection
      (req as Request & { wafThreats: WafThreat[] }).wafThreats = threats;
      return next();
    }

    const worst  = this.pickWorst(threats);
    const code   = `WAF_${worst.category.toUpperCase().replace(/-/g, '_')}`;

    res.status(403).json({
      ok:        false,
      message:   'Request blocked by WAF',
      code,
      ruleId:    worst.ruleId,
      location:  worst.location,
    });
  }

  private getTarget(req: Request, target: ScanTarget): unknown {
    switch (target) {
      case 'query':   return req.query;
      case 'body':    return req.body;
      case 'params':  return req.params;
      case 'headers': return req.headers;
      case 'cookies': return (req as Request & { cookies?: unknown }).cookies;
    }
  }

  private isExcluded(path: string): boolean {
    return (this.options.excludePaths ?? []).some(p => path.startsWith(p));
  }

  private pickWorst(threats: WafThreat[]): WafThreat {
    const order: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    return threats.slice().sort((a, b) => order[a.severity] - order[b.severity])[0];
  }
}
