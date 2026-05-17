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
import { InventoryService } from './inventory.service';
import { ReserveInventoryDto } from './dto/reserve-inventory.dto';

@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get(':productId')
  getStock(@Param('productId') productId: string) {
    const stock = this.inventoryService.getStock(productId);
    return { productId, availableStock: stock };
  }

  @Post(':productId/reserve')
  @HttpCode(HttpStatus.OK)
  async reserve(
    @Param('productId') productId: string,
    @Body() dto: ReserveInventoryDto,
  ) {
    const result = await this.inventoryService.reserve(productId, dto.quantity);
    if (!result.ok) {
      throw new BadRequestException(
        `Insufficient stock. Available: ${result.error.available}`,
      );
    }
    return result.value;
  }

  @Post(':productId/release')
  @HttpCode(HttpStatus.OK)
  async release(
    @Param('productId') productId: string,
    @Body() body: { reservationId: string },
  ) {
    if (!body.reservationId) {
      throw new BadRequestException('reservationId is required');
    }
    const result = await this.inventoryService.release(body.reservationId);
    if (!result.ok) {
      throw new NotFoundException(result.error);
    }
    return { released: true, reservationId: body.reservationId };
  }
}
