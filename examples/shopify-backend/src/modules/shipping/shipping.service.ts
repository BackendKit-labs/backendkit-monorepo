import { Injectable } from '@nestjs/common';
import { ok, fail, Result } from '@backendkit-labs/result';
import { MetricsService, LoggerService, TrackPerformance } from '@backendkit-labs/observability';
import { CircuitBreakerRegistry } from '@backendkit-labs/circuit-breaker';
import { WithCircuitBreaker } from '@backendkit-labs/circuit-breaker/nestjs';
import { BulkheadRegistry } from '@backendkit-labs/bulkhead';
import { WithBulkhead } from '@backendkit-labs/bulkhead/nestjs';
import { InjectHttpClient } from '@backendkit-labs/http-client/nestjs';
import { HttpClient } from '@backendkit-labs/http-client';
import { v4 as uuid } from 'uuid';
import { SHIPPING_CLIENT } from '../../infrastructure/http-clients/tokens';
import { ShipmentRecord } from '../../common/entities';

@Injectable()
export class ShippingService {
  private readonly records = new Map<string, ShipmentRecord>();

  constructor(
    private readonly circuitBreakerRegistry: CircuitBreakerRegistry,
    private readonly bulkheadRegistry: BulkheadRegistry,
    @InjectHttpClient(SHIPPING_CLIENT) private readonly client: HttpClient,
    private readonly metrics: MetricsService,
    private readonly logger: LoggerService,
  ) {}

  @WithCircuitBreaker({
    name: 'shipping-provider',
    failureThreshold: 40,
    openTimeoutMs: 20_000,
    fallback: () => ({ shipmentId: null, fallback: true }),
  })
  @WithBulkhead({ name: 'shipping-provider', maxConcurrent: 8, timeoutMs: 10_000 })
  @TrackPerformance()
  async createShipment(dto: {
    orderId: string;
    customerId: string;
    items: any[];
  }): Promise<Result<{ shipmentId: string; trackingNumber: string }, { message: string }>> {
    const result = await this.client.post<{
      shipmentId: string;
      trackingNumber: string;
      status: string;
    }>('/shipments', dto);

    if (!result.ok) {
      const message = result.error.message ?? 'Shipping provider error';
      this.logger.error(
        `Shipment creation failed: orderId=${dto.orderId} reason=${message}`,
        'ShippingService',
      );
      this.metrics.record('shipment.failed', 1);
      return fail({ message });
    }

    const { shipmentId, trackingNumber } = result.value.data;
    const record: ShipmentRecord = {
      id: shipmentId,
      orderId: dto.orderId,
      customerId: dto.customerId,
      status: 'created',
      trackingNumber,
      createdAt: new Date(),
    };
    this.records.set(record.id, record);

    this.metrics.record('shipment.created', 1);
    this.logger.log(
      `Shipment created: orderId=${dto.orderId} shipmentId=${shipmentId} tracking=${trackingNumber}`,
      'ShippingService',
    );

    return ok({ shipmentId, trackingNumber });
  }

  async trackShipment(shipmentId: string): Promise<Result<{ status: string }, string>> {
    const result = await this.client.get<{ shipmentId: string; status: string; location: string }>(
      `/shipments/${shipmentId}`,
    );

    if (!result.ok) {
      const message = result.error.message ?? 'Tracking error';
      this.logger.warn(`Tracking failed: shipmentId=${shipmentId} reason=${message}`, 'ShippingService');
      return fail(message);
    }

    return ok({ status: result.value.data.status });
  }

  findById(id: string): ShipmentRecord | undefined {
    return this.records.get(id);
  }
}
