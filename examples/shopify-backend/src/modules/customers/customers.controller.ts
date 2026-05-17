import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  HttpCode,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { AutoLearn } from '@backendkit-labs/auto-learning/nestjs';
import { CustomersService } from './customers.service';
import { CreateCustomerDto } from './dto/create-customer.dto';

@Controller('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get()
  findAll() {
    return this.customersService.findAll();
  }

  @Get(':id')
  findById(@Param('id') id: string) {
    const customer = this.customersService.findById(id);
    if (!customer) {
      throw new NotFoundException(`Customer ${id} not found`);
    }
    return customer;
  }

  @Get(':id/orders/count')
  getOrderCount(@Param('id') id: string) {
    const customer = this.customersService.findById(id);
    if (!customer) {
      throw new NotFoundException(`Customer ${id} not found`);
    }
    return { customerId: id, orderCount: this.customersService.getOrderCount(id) };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @AutoLearn()
  create(@Body() dto: CreateCustomerDto) {
    return this.customersService.create(dto);
  }
}
