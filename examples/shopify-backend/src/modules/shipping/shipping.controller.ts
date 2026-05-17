import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  HttpCode,
  HttpStatus,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ShippingService } from './shipping.service';
import { CreateShipmentDto } from './dto/create-shipment.dto';

@Controller('shipping')
export class ShippingController {
  constructor(private readonly shippingService: ShippingService) {}

  @Post('shipments')
  @HttpCode(HttpStatus.CREATED)
  async createShipment(@Body() dto: CreateShipmentDto) {
    const result = await this.shippingService.createShipment(dto);
    if (!result.ok) {
      throw new BadRequestException(result.error.message);
    }
    return result.value;
  }

  @Get('shipments/:id/track')
  async trackShipment(@Param('id') id: string) {
    const result = await this.shippingService.trackShipment(id);
    if (!result.ok) {
      throw new NotFoundException(`Shipment ${id} not found or tracking unavailable`);
    }
    return { shipmentId: id, ...result.value };
  }
}
