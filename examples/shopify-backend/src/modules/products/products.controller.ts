import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  HttpCode,
  HttpStatus,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { TrackPerformance } from '@backendkit-labs/observability';
import { AutoLearn } from '@backendkit-labs/auto-learning/nestjs';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  findAll() {
    return this.productsService.findAll();
  }

  @Get(':id')
  findById(@Param('id') id: string) {
    const result = this.productsService.findById(id);
    if (!result.ok) {
      throw new NotFoundException(`Product ${id} not found`);
    }
    return result.value;
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @TrackPerformance()
  @AutoLearn()
  create(@Body() dto: CreateProductDto) {
    const result = this.productsService.create(dto);
    if (!result.ok) {
      if (result.error === 'invalid-price') {
        throw new BadRequestException('Price must be greater than 0');
      }
      throw new BadRequestException('At least one variant is required');
    }
    return result.value;
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateProductDto) {
    const result = this.productsService.update(id, dto);
    if (!result.ok) {
      throw new NotFoundException(`Product ${id} not found`);
    }
    return result.value;
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(@Param('id') id: string) {
    const result = this.productsService.delete(id);
    if (!result.ok) {
      throw new NotFoundException(`Product ${id} not found`);
    }
  }
}
