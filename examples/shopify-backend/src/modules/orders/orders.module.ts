import { Module, forwardRef } from '@nestjs/common';
import { Pipeline } from '@backendkit-labs/pipeline';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { OrdersRepository } from './orders.repository';
import { CustomersModule } from '../customers/customers.module';
import { InventoryModule } from '../inventory/inventory.module';
import { PaymentsModule } from '../payments/payments.module';
import { ShippingModule } from '../shipping/shipping.module';
import { HttpClientsModule } from '../../infrastructure/http-clients/http-clients.module';
import { ORDER_PIPELINE, OrderContext, OrderError } from './pipeline';
import {
  ValidateOrderStep,
  CheckInventoryStep,
  ChargePaymentStep,
  UpdateInventoryStep,
  CreateShipmentStep,
  NotifyCustomerStep,
} from './pipeline';

@Module({
  imports: [
    forwardRef(() => CustomersModule),
    InventoryModule,
    PaymentsModule,
    ShippingModule,
    HttpClientsModule,
  ],
  controllers: [OrdersController],
  providers: [
    OrdersService,
    OrdersRepository,
    ValidateOrderStep,
    CheckInventoryStep,
    ChargePaymentStep,
    UpdateInventoryStep,
    CreateShipmentStep,
    NotifyCustomerStep,
    {
      provide: ORDER_PIPELINE.symbol,
      useFactory: (
        validateOrder: ValidateOrderStep,
        checkInventory: CheckInventoryStep,
        chargePayment: ChargePaymentStep,
        updateInventory: UpdateInventoryStep,
        createShipment: CreateShipmentStep,
        notifyCustomer: NotifyCustomerStep,
      ): Pipeline<OrderContext, OrderError> => {
        return new Pipeline<OrderContext, OrderError>({ mode: 'stop-on-first' })
          .pipe(validateOrder)
          .pipe(checkInventory)
          .pipe(chargePayment)
          .pipe(updateInventory)
          .pipe(createShipment)
          .pipe(notifyCustomer);
      },
      inject: [
        ValidateOrderStep,
        CheckInventoryStep,
        ChargePaymentStep,
        UpdateInventoryStep,
        CreateShipmentStep,
        NotifyCustomerStep,
      ],
    },
  ],
  exports: [OrdersService, OrdersRepository],
})
export class OrdersModule {}
