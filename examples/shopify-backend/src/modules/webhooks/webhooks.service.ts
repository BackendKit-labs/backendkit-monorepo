import { Injectable } from '@nestjs/common';
import { MetricsService, LoggerService } from '@backendkit-labs/observability';
import { v4 as uuid } from 'uuid';
import { WebhookEventDto } from './dto/webhook-event.dto';

@Injectable()
export class WebhooksService {
  constructor(
    private readonly metrics: MetricsService,
    private readonly logger: LoggerService,
  ) {}

  process(dto: WebhookEventDto): { received: boolean; eventId: string } {
    const eventId = uuid();
    this.metrics.record('webhook.received', 1, {
      tags: { event: dto.event, source: dto.source },
    });
    this.logger.log(
      `Webhook received: eventId=${eventId} event=${dto.event} source=${dto.source}`,
      'WebhooksService',
    );
    return { received: true, eventId };
  }
}
