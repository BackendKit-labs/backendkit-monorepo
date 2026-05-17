import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { LoggerService } from '@backendkit-labs/observability';
import { v4 as uuid } from 'uuid';
import { CustomersRepository } from './customers.repository';
import { Customer } from '../../common/entities';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { OrdersRepository } from '../orders/orders.repository';

@Injectable()
export class CustomersService {
  constructor(
    private readonly repository: CustomersRepository,
    private readonly logger: LoggerService,
    @Inject(forwardRef(() => OrdersRepository))
    private readonly ordersRepository: OrdersRepository,
  ) {}

  findById(id: string): Customer | undefined {
    return this.repository.findById(id);
  }

  findAll(): Customer[] {
    return this.repository.findAll();
  }

  create(dto: CreateCustomerDto): Customer {
    const customer: Customer = {
      id: uuid(),
      email: dto.email,
      name: dto.name,
      createdAt: new Date(),
    };
    const saved = this.repository.save(customer);
    this.logger.log(`Customer created: ${saved.id} - ${saved.email}`, 'CustomersService');
    return saved;
  }

  createWithId(id: string, dto: CreateCustomerDto): Customer {
    const customer: Customer = {
      id,
      email: dto.email,
      name: dto.name,
      createdAt: new Date(),
    };
    return this.repository.save(customer);
  }

  getOrderCount(customerId: string): number {
    const orders = this.ordersRepository.findAll(o => o.customerId === customerId);
    return orders.length;
  }
}
