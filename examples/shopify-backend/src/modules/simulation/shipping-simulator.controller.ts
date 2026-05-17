import { Controller, Post, Get, Body, Param, InternalServerErrorException } from '@nestjs/common';
import { v4 as uuid } from 'uuid';

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

@Controller('sim/shipping')
export class ShippingSimulatorController {
  @Post('shipments')
  async createShipment(@Body() body: any) {
    const failureRate = parseFloat(process.env.SHIPPING_FAILURE_RATE ?? '0.15');
    const delayMs     = parseInt(process.env.SHIPPING_DELAY_MS ?? '250', 10);
    await sleep(delayMs + Math.random() * 100);
    if (Math.random() < failureRate) {
      throw new InternalServerErrorException('Shipping provider unavailable');
    }
    return { shipmentId: uuid(), trackingNumber: `TRK-${Date.now()}`, status: 'created' };
  }

  @Get('shipments/:id')
  async trackShipment(@Param('id') id: string) {
    await sleep(50);
    return { shipmentId: id, status: 'in_transit', location: 'Distribution Center' };
  }
}
