import { Controller, Get } from '@nestjs/common';
import { HealthService } from './health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  getHealth() {
    return this.healthService.getHealth();
  }

  @Get('circuit-breakers')
  getCircuitBreakers() {
    return this.healthService.getCircuitBreakerMetrics();
  }

  @Get('bulkheads')
  getBulkheads() {
    return this.healthService.getBulkheadMetrics();
  }
}
