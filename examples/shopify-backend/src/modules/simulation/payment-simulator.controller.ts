import { Controller, Post, Body, InternalServerErrorException } from '@nestjs/common';
import { v4 as uuid } from 'uuid';

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

@Controller('sim/payment')
export class PaymentSimulatorController {
  @Post('charge')
  async charge(@Body() body: any) {
    const failureRate = parseFloat(process.env.PAYMENT_FAILURE_RATE ?? '0.2');
    const delayMs     = parseInt(process.env.PAYMENT_DELAY_MS ?? '150', 10);
    await sleep(delayMs + Math.random() * 50);
    if (Math.random() < failureRate) {
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
