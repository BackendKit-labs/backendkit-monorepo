import { Injectable } from '@nestjs/common';
import { InMemoryStore } from '../../infrastructure/store/in-memory.store';
import { Order } from '../../common/entities';

@Injectable()
export class OrdersRepository {
  private readonly store = new InMemoryStore<Order>();

  findAll(predicate?: (o: Order) => boolean): Order[] {
    return this.store.findAll(predicate);
  }

  findById(id: string): Order | undefined {
    return this.store.findById(id);
  }

  save(order: Order): Order {
    return this.store.save(order);
  }

  update(id: string, partial: Partial<Order>): Order | undefined {
    return this.store.update(id, partial);
  }
}
