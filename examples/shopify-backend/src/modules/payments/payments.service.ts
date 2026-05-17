import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ok, fail, Result } from '@backendkit-labs/result';
import { MetricsService, LoggerService, TrackPerformance } from '@backendkit-labs/observability';
import { CircuitBreakerRegistry } from '@backendkit-labs/circuit-breaker';
import { WithCircuitBreaker } from '@backendkit-labs/circuit-breaker/nestjs';
import { InjectHttpClient } from '@backendkit-labs/http-client/nestjs';
import { HttpClient } from '@backendkit-labs/http-client';
import { v4 as uuid } from 'uuid';
import { PAYMENT_CLIENT } from '../../infrastructure/http-clients/tokens';
import { PaymentRecord } from '../../common/entities';

@Injectable()
export class PaymentsService {
  private readonly records = new Map<string, PaymentRecord>();

  constructor(
    private readonly circuitBreakerRegistry: CircuitBreakerRegistry,
    @InjectHttpClient(PAYMENT_CLIENT) private readonly client: HttpClient,
    private readonly logger: LoggerService,
    private readonly metrics: MetricsService,
  ) {}

  @WithCircuitBreaker({ name: 'payment-gateway', failureThreshold: 50, openTimeoutMs: 15_000 })
  @TrackPerformance()
  async charge(dto: {
    orderId: string;
    amount: number;
    method: string;
  }): Promise<{ transactionId: string; amount: number }> {
    const result = await this.client.post<{ transactionId: string; status: string; amount: number }>(
      '/charge',
      { orderId: dto.orderId, amount: dto.amount, method: dto.method },
    );

    if (!result.ok) {
      const reason = result.error.message ?? 'Payment gateway error';
      this.logger.error(`Payment charge failed: orderId=${dto.orderId} reason=${reason}`, 'PaymentsService');
      this.metrics.record('payment.failed', 1);
      throw new ServiceUnavailableException(`Payment failed: ${reason}`);
    }

    const { transactionId, amount } = result.value.data;
    const record: PaymentRecord = {
      id: uuid(),
      orderId: dto.orderId,
      amount,
      transactionId,
      status: 'charged',
      createdAt: new Date(),
    };
    this.records.set(record.id, record);

    this.metrics.record('payment.charged', amount, { unit: 'cents' });
    this.logger.log(
      `Payment charged: orderId=${dto.orderId} transactionId=${transactionId} amount=${amount}`,
      'PaymentsService',
    );

    return { transactionId, amount };
  }

  async refund(transactionId: string): Promise<Result<{ refundId: string }, string>> {
    const result = await this.client.post<{ refundId: string; status: string }>(
      '/refund',
      { transactionId },
    );

    if (!result.ok) {
      const reason = result.error.message ?? 'Refund failed';
      this.logger.error(`Refund failed: transactionId=${transactionId} reason=${reason}`, 'PaymentsService');
      return fail(reason);
    }

    this.logger.log(`Refund processed: transactionId=${transactionId}`, 'PaymentsService');
    return ok({ refundId: result.value.data.refundId });
  }

  findById(id: string): PaymentRecord | undefined {
    return this.records.get(id);
  }
}
