import { Controller, Get, Patch, Body } from '@nestjs/common';
import { SimConfigService } from './sim-config.service';

@Controller('sim/config')
export class SimConfigController {
  constructor(private readonly config: SimConfigService) {}

  @Get()
  getConfig() {
    return {
      paymentFailureRate:  this.config.paymentFailureRate,
      paymentDelayMs:      this.config.paymentDelayMs,
      shippingFailureRate: this.config.shippingFailureRate,
      shippingDelayMs:     this.config.shippingDelayMs,
    };
  }

  @Patch()
  updateConfig(@Body() body: Partial<{
    paymentFailureRate:  number;
    paymentDelayMs:      number;
    shippingFailureRate: number;
    shippingDelayMs:     number;
  }>) {
    if (body.paymentFailureRate  !== undefined) this.config.paymentFailureRate  = body.paymentFailureRate;
    if (body.paymentDelayMs      !== undefined) this.config.paymentDelayMs      = body.paymentDelayMs;
    if (body.shippingFailureRate !== undefined) this.config.shippingFailureRate = body.shippingFailureRate;
    if (body.shippingDelayMs     !== undefined) this.config.shippingDelayMs     = body.shippingDelayMs;
    return this.getConfig();
  }
}
