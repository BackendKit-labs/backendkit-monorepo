import { Controller, Post, Body, InternalServerErrorException } from '@nestjs/common';
import { v4 as uuid } from 'uuid';
import { SimConfigService } from './sim-config.service';

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

@Controller('sim/payment')
export class PaymentSimulatorController {
  constructor(private readonly simConfig: SimConfigService) {}

  @Post('charge')
  async charge(@Body() body: any) {
    await sleep(this.simConfig.paymentDelayMs + Math.random() * 50);
    if (Math.random() < this.simConfig.paymentFailureRate) {
      throw new InternalServerErrorException('Payment gateway timeout');
    }
    return { transactionId: uuid(), status: 'charged', amount: body.amount ?? 0 };
  }

  @Post('refund')
  async refund(@Body() body: any) {
    await sleep(100);
    return { refundId: uuid(), transactionId: body.transactionId, status: 'refunded' };
  }
}
