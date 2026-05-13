import {
  Injectable,
  Inject,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  ServiceUnavailableException,
  RequestTimeoutException,
} from '@nestjs/common';
import { firstValueFrom, Observable } from 'rxjs';
import { BulkheadRegistry } from '../bulkhead/bulkhead.registry.js';
import { BulkheadRejectedError, BulkheadTimeoutError } from '../bulkhead/bulkhead.js';

@Injectable()
export class BulkheadInterceptor implements NestInterceptor {
  constructor(@Inject(BulkheadRegistry) private readonly registry: BulkheadRegistry) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    const request = context.switchToHttp().getRequest();
    const clientId: string = request.headers['x-client-id'] ?? 'anonymous';
    const handlerName: string = context.getHandler().name;

    const bulkhead = this.registry.getForClient(clientId, handlerName);

    try {
      const result = await bulkhead.execute(() => firstValueFrom(next.handle()));
      return new Observable(subscriber => {
        subscriber.next(result);
        subscriber.complete();
      });
    } catch (error) {
      if (error instanceof BulkheadRejectedError) {
        throw new ServiceUnavailableException(
          'Service at capacity — please retry in a moment',
        );
      }
      if (error instanceof BulkheadTimeoutError) {
        throw new RequestTimeoutException(
          'Request timed out waiting for processing — please retry',
        );
      }
      throw error;
    }
  }
}
