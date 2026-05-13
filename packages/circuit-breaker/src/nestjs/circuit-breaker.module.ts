import { Module } from '@nestjs/common';
import { CircuitBreakerRegistry } from '../circuit-breaker/circuit-breaker.registry.js';
import { CircuitBreakerService } from './circuit-breaker.service.js';
import { CircuitBreakerGuard } from './circuit-breaker.guard.js';
import { CircuitBreakerInterceptor } from './circuit-breaker.interceptor.js';

@Module({
  providers: [
    CircuitBreakerRegistry,
    CircuitBreakerService,
    CircuitBreakerGuard,
    CircuitBreakerInterceptor,
  ],
  exports: [
    CircuitBreakerRegistry,
    CircuitBreakerService,
    CircuitBreakerGuard,
    CircuitBreakerInterceptor,
  ],
})
export class CircuitBreakerModule {}
