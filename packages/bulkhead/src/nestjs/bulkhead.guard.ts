import {
  Injectable,
  Inject,
  CanActivate,
  ExecutionContext,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { BulkheadRegistry } from '../bulkhead/bulkhead.registry.js';

export interface BulkheadGuardOptions {
  /** Named bulkhead to use; defaults to the route path */
  name?: string;
  /** Create a separate bulkhead per x-client-id header value */
  perClient?: boolean;
  maxConcurrent?: number;
  timeoutMs?: number;
}

export const UseBulkhead = (options: BulkheadGuardOptions = {}) =>
  Reflector.createDecorator<BulkheadGuardOptions>({ key: 'bulkhead', transform: () => options });

@Injectable()
export class BulkheadGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(BulkheadRegistry) private readonly registry: BulkheadRegistry,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const options = this.reflector.get<BulkheadGuardOptions>('bulkhead', context.getHandler());
    if (!options) return true;

    const request = context.switchToHttp().getRequest();
    const clientId: string = request.headers['x-client-id'] ?? 'anonymous';

    const bulkhead = options.perClient
      ? this.registry.getForClient(clientId, options.name ?? (request.route?.path as string))
      : this.registry.getForService(options.name ?? 'default');

    if (!bulkhead.canAccept()) {
      throw new ServiceUnavailableException('Service temporarily unavailable due to high load');
    }

    (request as Record<string, unknown>)['bulkhead'] = bulkhead;
    return true;
  }
}
