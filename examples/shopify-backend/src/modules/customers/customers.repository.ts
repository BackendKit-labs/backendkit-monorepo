import { Injectable } from '@nestjs/common';
import { InMemoryStore } from '../../infrastructure/store/in-memory.store';
import { Customer } from '../../common/entities';

@Injectable()
export class CustomersRepository {
  private readonly store = new InMemoryStore<Customer>();

  findAll(): Customer[] {
    return this.store.findAll();
  }

  findById(id: string): Customer | undefined {
    return this.store.findById(id);
  }

  save(customer: Customer): Customer {
    return this.store.save(customer);
  }

  update(id: string, partial: Partial<Customer>): Customer | undefined {
    return this.store.update(id, partial);
  }

  delete(id: string): boolean {
    return this.store.delete(id);
  }
}
