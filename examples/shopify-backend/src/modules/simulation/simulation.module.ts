import { Module } from '@nestjs/common';
import { PaymentSimulatorController } from './payment-simulator.controller';
import { ShippingSimulatorController } from './shipping-simulator.controller';

@Module({
  controllers: [PaymentSimulatorController, ShippingSimulatorController],
})
export class SimulationModule {}
