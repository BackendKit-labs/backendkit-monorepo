import {
  Injectable,
  NotFoundException,
  BadRequestException,
  UnprocessableEntityException,
  ServiceUnavailableException,
  HttpException,
} from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { Pipeline, PipelineError } from '@backendkit-labs/pipeline';
import { MetricsService, LoggerService, TrackPerformance } from '@backendkit-labs/observability';
import { v4 as uuid } from 'uuid';
import { OrdersRepository } from './orders.repository';
import { ORDER_PIPELINE, OrderContext, OrderError } from './pipeline';
import { CreateOrderDto } from './dto/create-order.dto';
import { Order, OrderItem } from '../../common/entities';

@Injectable()
export class OrdersService {
  constructor(
    @Inject(ORDER_PIPELINE.symbol) private readonly pipeline: Pipeline<OrderContext, OrderError>,
    private readonly repository: OrdersRepository,
    private readonly logger: LoggerService,
    private readonly metrics: MetricsService,
  ) {}

  @TrackPerformance()
  async createOrder(dto: CreateOrderDto): Promise<{
    order: Order;
    durationMs: number;
    executedSteps: string[];
  }> {
    const orderId = uuid();
    const items: OrderItem[] = dto.items.map(item => ({
      productId: item.productId,
      variantId: item.variantId,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
    }));
    const totalAmount = items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);

    const ctx: OrderContext = {
      orderId,
      customerId: dto.customerId,
      items,
      totalAmount,
      paymentMethod: dto.paymentMethod,
    };

    const pipelineResult = await this.pipeline.run(ctx);

    if (!pipelineResult.ok) {
      const pipelineError: PipelineError<OrderError> = pipelineResult.error;
      const error: OrderError = pipelineError.cause;
      const durationMs = pipelineError.durationMs;
      this.logger.error(
        `Order failed: orderId=${orderId} kind=${error.kind} durationMs=${durationMs}`,
        'OrdersService',
      );
      this.metrics.record('order.failed', 1);
      throw this.mapErrorToException(error);
    }

    const finalCtx = pipelineResult.value;
    const executedSteps: string[] = pipelineResult.executedSteps ?? [];
    const durationMs = pipelineResult.durationMs ?? 0;

    const order: Order = {
      id: orderId,
      customerId: dto.customerId,
      items,
      totalAmount,
      status: 'confirmed',
      transactionId: finalCtx.transactionId,
      shipmentId: finalCtx.shipmentId,
      createdAt: new Date(),
    };

    this.repository.save(order);
    this.metrics.record('order.created', 1);
    this.metrics.record('order.revenue', totalAmount, { unit: 'cents' });
    this.logger.log(
      `Order created: orderId=${orderId} customerId=${dto.customerId} total=${totalAmount} durationMs=${durationMs}`,
      'OrdersService',
    );

    return { order, durationMs, executedSteps };
  }

  findById(id: string): Order {
    const order = this.repository.findById(id);
    if (!order) {
      throw new NotFoundException(`Order ${id} not found`);
    }
    return order;
  }

  findAll(): Order[] {
    return this.repository.findAll();
  }

  private mapErrorToException(error: OrderError): HttpException {
    switch (error.kind) {
      case 'validation':
        return new BadRequestException(error.message);
      case 'inventory-unavailable':
        return new UnprocessableEntityException(
          `Insufficient inventory for product ${error.productId}: requested=${error.requested} available=${error.available}`,
        );
      case 'payment-failed':
        return new ServiceUnavailableException(`Payment failed: ${error.reason}`);
      case 'shipment-failed':
        return new ServiceUnavailableException(`Shipment failed: ${error.reason}`);
      case 'notification-failed':
        return new ServiceUnavailableException(`Notification failed: ${error.reason}`);
      default:
        return new ServiceUnavailableException('Order processing failed');
    }
  }
}
