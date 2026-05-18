import { Controller, Post, Get, Body, Param, InternalServerErrorException } from '@nestjs/common';
import { v4 as uuid } from 'uuid';
import { SimConfigService } from './sim-config.service';

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

@Controller('sim/shipping')
export class ShippingSimulatorController {
  constructor(private readonly simConfig: SimConfigService) {}

  @Post('shipments')
  async createShipment(@Body() body: any) {
    await sleep(this.simConfig.shippingDelayMs + Math.random() * 100);
    if (Math.random() < this.simConfig.shippingFailureRate) {
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
