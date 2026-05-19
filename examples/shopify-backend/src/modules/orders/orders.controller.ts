import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { TrackPerformance } from '@backendkit-labs/observability';
import { AutoLearn } from '@backendkit-labs/auto-learning/nestjs';
import { Idempotent } from '@backendkit-labs/idempotency';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  findAll() {
    return this.ordersService.findAll();
  }

  @Get(':id')
  findById(@Param('id') id: string) {
    return this.ordersService.findById(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Idempotent()
  @AutoLearn()
  @TrackPerformance()
  async createOrder(@Body() dto: CreateOrderDto) {
    return this.ordersService.createOrder(dto);
  }
}
