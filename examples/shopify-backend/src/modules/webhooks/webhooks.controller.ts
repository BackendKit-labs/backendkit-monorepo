import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { SanitizePipe } from '@backendkit-labs/request-scanner/nestjs';
import { WebhooksService } from './webhooks.service';
import { WebhookEventDto } from './dto/webhook-event.dto';

@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly webhooks: WebhooksService) {}

  @Post('shopify')
  @HttpCode(HttpStatus.CREATED)
  async receiveShopify(
    @Body(new SanitizePipe({ mode: 'block' }, null, 'body')) dto: WebhookEventDto,
  ): Promise<{ received: boolean; eventId: string }> {
    return this.webhooks.process(dto);
  }
}
