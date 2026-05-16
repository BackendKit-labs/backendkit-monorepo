import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Inject,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, tap } from 'rxjs';
import { AUTO_LEARN_METADATA, AUTO_LEARNING_INSTANCE } from './auto-learning.constants.js';
import { AutoLearnOptions } from './auto-learning.decorator.js';
import { AutoLearningCore } from '../core/auto-learning-core.js';

@Injectable()
export class AutoLearningInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    @Inject(AUTO_LEARNING_INSTANCE)
    private readonly core: AutoLearningCore,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    if (context.getType() !== 'http') return next.handle();

    const options = this.reflector.get<AutoLearnOptions>(
      AUTO_LEARN_METADATA,
      context.getHandler(),
    );

    if (!options) {
      return next.handle();
    }

    const start = Date.now();
    const req = context.switchToHttp().getRequest();
    const { method, path } = this.extractRequestInfo(req);

    const record = (statusCode: number) => {
      const result = this.core.recordPattern({
        method,
        path,
        statusCode,
        durationMs: Date.now() - start,
        timestamp: new Date(),
        metadata: this.buildMetadata(req, options),
      });
      if (!result.ok) {
        this.core.observability.error('Failed to record pattern', { error: result.error });
      }
    };

    return next.handle().pipe(
      tap({
        next: () => record(context.switchToHttp().getResponse().statusCode),
        error: (err: unknown) => {
          const status =
            typeof (err as any)?.getStatus === 'function'
              ? (err as any).getStatus()
              : ((err as any)?.status ?? 500);
          record(status);
        },
      }),
    );
  }

  private extractRequestInfo(req: any): { method: string; path: string } {
    const method = req.method ?? 'UNKNOWN';
    const raw = req.route?.path ?? req.path ?? req.url ?? '/';
    const path = raw.split('?')[0];
    return { method, path };
  }

  private buildMetadata(req: any, options: AutoLearnOptions): Record<string, unknown> | undefined {
    const meta: Record<string, unknown> = {};
    if (options.trackParams && req.params) meta.params = req.params;
    if (options.trackBody && req.body) meta.body = req.body;
    if (options.customMetadata) Object.assign(meta, options.customMetadata(req));
    return Object.keys(meta).length > 0 ? meta : undefined;
  }
}
