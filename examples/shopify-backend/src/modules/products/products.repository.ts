import { Injectable } from '@nestjs/common';
import { InMemoryStore } from '../../infrastructure/store/in-memory.store';
import { Product } from '../../common/entities';

@Injectable()
export class ProductsRepository {
  private readonly store = new InMemoryStore<Product>();

  findAll(): Product[] {
    return this.store.findAll();
  }

  findById(id: string): Product | undefined {
    return this.store.findById(id);
  }

  save(product: Product): Product {
    return this.store.save(product);
  }

  update(id: string, partial: Partial<Product>): Product | undefined {
    return this.store.update(id, partial);
  }

  delete(id: string): boolean {
    return this.store.delete(id);
  }
}
