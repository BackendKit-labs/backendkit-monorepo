import { Injectable } from '@nestjs/common';

@Injectable()
export class SimConfigService {
  paymentFailureRate = parseFloat(process.env.PAYMENT_FAILURE_RATE ?? '0.2');
  paymentDelayMs     = parseInt(process.env.PAYMENT_DELAY_MS     ?? '150', 10);
  shippingFailureRate = parseFloat(process.env.SHIPPING_FAILURE_RATE ?? '0.15');
  shippingDelayMs    = parseInt(process.env.SHIPPING_DELAY_MS    ?? '250', 10);
}
