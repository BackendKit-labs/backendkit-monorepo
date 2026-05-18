import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { LoggerService } from '@backendkit-labs/observability';
import { ProductsService } from '../products/products.service';
import { CustomersService } from '../customers/customers.service';
import { InventoryService } from '../inventory/inventory.service';

@Injectable()
export class SeedService implements OnApplicationBootstrap {
  constructor(
    private readonly products: ProductsService,
    private readonly customers: CustomersService,
    private readonly inventory: InventoryService,
    private readonly logger: LoggerService,
  ) {}

  onApplicationBootstrap(): void {
    this.seedProducts();
    this.seedCustomers();
    this.logger.log('Seed data loaded', 'SeedService');
  }

  private seedProducts(): void {
    // Product 1
    this.products.createWithId(
      'prod-seed-1',
      {
        name: 'BackendKit T-Shirt',
        description: 'Classic cotton tee with BackendKit Labs logo',
        price: 2999,
        variants: [{ name: 'Medium', sku: 'BK-TEE-M', price: 2999 }],
      },
      ['var-seed-1'],
    );
    this.inventory.initialize('prod-seed-1', 10_000);

    // Product 2
    this.products.createWithId(
      'prod-seed-2',
      {
        name: 'Circuit Breaker Hoodie',
        description: 'Premium hoodie, fault-tolerant like your code',
        price: 5499,
        variants: [
          { name: 'Small', sku: 'CBH-S', price: 5499 },
          { name: 'Large', sku: 'CBH-L', price: 5499 },
        ],
      },
      ['var-seed-2a', 'var-seed-2b'],
    );
    this.inventory.initialize('prod-seed-2', 10_000);

    // Product 3
    this.products.createWithId(
      'prod-seed-3',
      {
        name: 'Observability Mug',
        description: '16oz mug — see everything, miss nothing',
        price: 1599,
        variants: [{ name: 'Standard', sku: 'OBS-MUG', price: 1599 }],
      },
      ['var-seed-3'],
    );
    this.inventory.initialize('prod-seed-3', 10_000);

    // Product 4
    this.products.createWithId(
      'prod-seed-4',
      {
        name: 'Pipeline Sticker Pack',
        description: 'Set of 10 vinyl stickers — pipelines, bulkheads, and more',
        price: 799,
        variants: [{ name: 'Pack of 10', sku: 'PIPE-STK', price: 799 }],
      },
      ['var-seed-4'],
    );
    this.inventory.initialize('prod-seed-4', 10_000);

    // Product 5
    this.products.createWithId(
      'prod-seed-5',
      {
        name: 'BackendKit Laptop Sleeve',
        description: '13-inch neoprene sleeve with BackendKit branding',
        price: 3499,
        variants: [
          { name: '13-inch', sku: 'SLEEVE-13', price: 3499 },
          { name: '15-inch', sku: 'SLEEVE-15', price: 3999 },
        ],
      },
      ['var-seed-5a', 'var-seed-5b'],
    );
    this.inventory.initialize('prod-seed-5', 10_000);
  }

  private seedCustomers(): void {
    this.customers.createWithId('cust-seed-1', {
      email: 'alice@example.com',
      name: 'Alice Wonderland',
    });

    this.customers.createWithId('cust-seed-2', {
      email: 'bob@example.com',
      name: 'Bob Builder',
    });

    this.customers.createWithId('cust-seed-3', {
      email: 'carol@example.com',
      name: 'Carol Danvers',
    });
  }
}
