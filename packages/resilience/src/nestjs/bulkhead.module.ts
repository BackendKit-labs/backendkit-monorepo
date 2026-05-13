import { Module } from '@nestjs/common';
import { BulkheadRegistry } from '../bulkhead/bulkhead.registry.js';
import { BulkheadService } from './bulkhead.service.js';
import { BulkheadGuard } from './bulkhead.guard.js';
import { BulkheadInterceptor } from './bulkhead.interceptor.js';
import { HttpBulkheadMiddleware } from './http-bulkhead.middleware.js';

@Module({
  providers: [
    BulkheadRegistry,
    BulkheadService,
    BulkheadGuard,
    BulkheadInterceptor,
    HttpBulkheadMiddleware,
  ],
  exports: [
    BulkheadRegistry,
    BulkheadService,
    BulkheadGuard,
    BulkheadInterceptor,
    HttpBulkheadMiddleware,
  ],
})
export class BulkheadModule {}
