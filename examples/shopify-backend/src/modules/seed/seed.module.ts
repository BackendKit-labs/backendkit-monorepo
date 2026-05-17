import { Module } from '@nestjs/common';
import { SeedService } from './seed.service';
import { ProductsModule } from '../products/products.module';
import { CustomersModule } from '../customers/customers.module';
import { InventoryModule } from '../inventory/inventory.module';

@Module({
  imports: [ProductsModule, CustomersModule, InventoryModule],
  providers: [SeedService],
})
export class SeedModule {}
