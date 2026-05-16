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

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - start;
        const status = context.switchToHttp().getResponse().statusCode;

        this.core.recordPattern({
          method,
          path,
          statusCode: status,
          durationMs: duration,
          timestamp: new Date(),
          metadata: options.customMetadata ? options.customMetadata(req) : undefined,
        });
      }),
    );
  }

  private extractRequestInfo(req: any): { method: string; path: string } {
    const method = req.method ?? 'UNKNOWN';
    const path = req.route?.path ?? req.path ?? req.url ?? '/';
    return { method, path };
  }
}
