import { Module } from '@nestjs/common';
import { CircuitBreakerModule } from '@backendkit-labs/circuit-breaker/nestjs';
import { BulkheadModule } from '@backendkit-labs/bulkhead/nestjs';
import { ShippingController } from './shipping.controller';
import { ShippingService } from './shipping.service';
import { HttpClientsModule } from '../../infrastructure/http-clients/http-clients.module';

@Module({
  imports: [CircuitBreakerModule, BulkheadModule, HttpClientsModule],
  controllers: [ShippingController],
  providers: [ShippingService],
  exports: [ShippingService],
})
export class ShippingModule {}
