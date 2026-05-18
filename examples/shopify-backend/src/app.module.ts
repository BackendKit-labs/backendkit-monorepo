import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ObservabilityModule } from '@backendkit-labs/observability';
import { SimAwareExceptionsFilter } from './filters/sim-aware-exceptions.filter';
import { CircuitBreakerModule } from '@backendkit-labs/circuit-breaker/nestjs';
import { BulkheadModule } from '@backendkit-labs/bulkhead/nestjs';
import { WafModule, WafMiddleware } from '@backendkit-labs/request-scanner/nestjs';
import { AutoLearningModule } from '@backendkit-labs/auto-learning/nestjs';
import { ProductsModule } from './modules/products/products.module';
import { CustomersModule } from './modules/customers/customers.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { ShippingModule } from './modules/shipping/shipping.module';
import { OrdersModule } from './modules/orders/orders.module';
import { WebhooksModule } from './modules/webhooks/webhooks.module';
import { HealthModule } from './modules/health/health.module';
import { SimulationModule } from './modules/simulation/simulation.module';
import { SeedModule } from './modules/seed/seed.module';
import { HttpClientsModule } from './infrastructure/http-clients/http-clients.module';

@Module({
  providers: [SimAwareExceptionsFilter],
  exports: [SimAwareExceptionsFilter],
  imports: [
    ObservabilityModule.forRoot({
      serviceName: 'shopify-backend',
      environment: process.env.NODE_ENV ?? 'development',
      logLevel: (process.env.LOG_LEVEL as any) ?? 'info',
    }),
    CircuitBreakerModule,
    BulkheadModule,
    AutoLearningModule.forRoot({
      intervalMs: 30_000,
      autoStart: true,
      adapters: { circuitBreaker: true, bulkhead: true },
    }),
    WafModule.forRoot({
      mode: 'block',
      excludePaths: ['/health', '/sim'],
    }),
    HttpClientsModule,
    SimulationModule,
    ProductsModule,
    CustomersModule,
    InventoryModule,
    PaymentsModule,
    ShippingModule,
    OrdersModule,
    WebhooksModule,
    HealthModule,
    SeedModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(WafMiddleware)
      .exclude('/health(.*)', '/sim(.*)')
      .forRoutes('*');
  }
}
