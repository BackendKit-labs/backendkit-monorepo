import { Injectable } from '@nestjs/common';
import { ok, fail, Result } from '@backendkit-labs/result';
import { MetricsService, LoggerService, TrackPerformance } from '@backendkit-labs/observability';
import { v4 as uuid } from 'uuid';
import { ProductsRepository } from './products.repository';
import { Product, ProductVariant } from '../../common/entities';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Injectable()
export class ProductsService {
  constructor(
    private readonly repository: ProductsRepository,
    private readonly metrics: MetricsService,
    private readonly logger: LoggerService,
  ) {}

  findAll(): Product[] {
    return this.repository.findAll();
  }

  findById(id: string): Result<Product, 'not-found'> {
    const product = this.repository.findById(id);
    if (!product) {
      return fail('not-found');
    }
    return ok(product);
  }

  @TrackPerformance()
  create(dto: CreateProductDto): Result<Product, 'invalid-price' | 'invalid-variants'> {
    if (dto.price <= 0) {
      this.logger.warn(`Product creation rejected: invalid price ${dto.price}`, 'ProductsService');
      return fail('invalid-price');
    }
    if (!dto.variants || dto.variants.length === 0) {
      this.logger.warn('Product creation rejected: no variants provided', 'ProductsService');
      return fail('invalid-variants');
    }

    const variants: ProductVariant[] = dto.variants.map(v => ({
      id: uuid(),
      name: v.name,
      sku: v.sku,
      price: v.price,
    }));

    const product: Product = {
      id: uuid(),
      name: dto.name,
      description: dto.description,
      price: dto.price,
      variants,
      createdAt: new Date(),
    };

    const saved = this.repository.save(product);
    this.metrics.record('product.created', 1);
    this.logger.log(`Product created: ${saved.id} - ${saved.name}`, 'ProductsService');
    return ok(saved);
  }

  update(id: string, dto: UpdateProductDto): Result<Product, 'not-found'> {
    const existing = this.repository.findById(id);
    if (!existing) {
      return fail('not-found');
    }

    let variants = existing.variants;
    if (dto.variants) {
      variants = dto.variants.map(v => ({
        id: uuid(),
        name: v.name,
        sku: v.sku,
        price: v.price,
      }));
    }

    const updated = this.repository.update(id, {
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.description !== undefined && { description: dto.description }),
      ...(dto.price !== undefined && { price: dto.price }),
      variants,
    });

    if (!updated) {
      return fail('not-found');
    }

    this.logger.log(`Product updated: ${id}`, 'ProductsService');
    return ok(updated);
  }

  delete(id: string): Result<void, 'not-found'> {
    const exists = this.repository.findById(id);
    if (!exists) {
      return fail('not-found');
    }
    this.repository.delete(id);
    this.logger.log(`Product deleted: ${id}`, 'ProductsService');
    return ok(undefined);
  }

  createWithId(id: string, dto: CreateProductDto, variantIds?: string[]): Product {
    const variants: ProductVariant[] = dto.variants.map((v, idx) => ({
      id: variantIds?.[idx] ?? uuid(),
      name: v.name,
      sku: v.sku,
      price: v.price,
    }));

    const product: Product = {
      id,
      name: dto.name,
      description: dto.description,
      price: dto.price,
      variants,
      createdAt: new Date(),
    };

    return this.repository.save(product);
  }
}
