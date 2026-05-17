import { Module } from '@nestjs/common';
import { CircuitBreakerModule } from '@backendkit-labs/circuit-breaker/nestjs';
import { BulkheadModule } from '@backendkit-labs/bulkhead/nestjs';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

@Module({
  imports: [CircuitBreakerModule, BulkheadModule],
  controllers: [HealthController],
  providers: [HealthService],
})
export class HealthModule {}
