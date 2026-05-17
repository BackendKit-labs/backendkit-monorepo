import { Module } from '@nestjs/common';
import { CircuitBreakerModule } from '@backendkit-labs/circuit-breaker/nestjs';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { HttpClientsModule } from '../../infrastructure/http-clients/http-clients.module';

@Module({
  imports: [CircuitBreakerModule, HttpClientsModule],
  controllers: [PaymentsController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
