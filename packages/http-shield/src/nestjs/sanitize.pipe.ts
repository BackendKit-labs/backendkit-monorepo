import { BadRequestException, Inject, Injectable, Optional, PipeTransform } from '@nestjs/common';
import { WafScanner } from '../core/scanner.js';
import type { ScanTarget } from '../core/types.js';
import { WAF_OPTIONS, type WafModuleOptions } from './waf.options.js';

/**
 * Pipe-level WAF check for individual controller parameters.
 * When used inside a WafModule context, it shares the same scanner instance.
 * Can also be used standalone without the module.
 *
 * @example
 * // Per-param validation
 * @Get(':id')
 * findOne(@Param('id', SanitizePipe) id: string) { ... }
 *
 * // With explicit target
 * @Post()
 * create(@Body(new SanitizePipe('body')) dto: CreateDto) { ... }
 */
@Injectable()
export class SanitizePipe implements PipeTransform {
  private readonly scanner: WafScanner;

  constructor(
    @Optional() @Inject(WAF_OPTIONS) options: WafModuleOptions | null,
    @Optional() scanner: WafScanner | null,
    private readonly target: ScanTarget = 'params',
  ) {
    // Use the module's shared scanner when available, otherwise create a standalone one
    this.scanner = scanner ?? new WafScanner(options ?? {});
  }

  transform(value: unknown): unknown {
    const result = this.scanner.scan(value, this.target);

    if (!result.clean) {
      const worst = result.threats.sort((a, b) => {
        const order: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
        return order[a.severity] - order[b.severity];
      })[0];

      throw new BadRequestException({
        message:  'Invalid input detected',
        code:     `WAF_${worst.category.toUpperCase().replace(/-/g, '_')}`,
        ruleId:   worst.ruleId,
        field:    worst.field,
      });
    }

    return value;
  }
}
