import { Module } from '@nestjs/common';
import { PaymentSimulatorController } from './payment-simulator.controller';
import { ShippingSimulatorController } from './shipping-simulator.controller';
import { SimConfigController } from './sim-config.controller';
import { SimConfigService } from './sim-config.service';

@Module({
  controllers: [PaymentSimulatorController, ShippingSimulatorController, SimConfigController],
  providers: [SimConfigService],
  exports: [SimConfigService],
})
export class SimulationModule {}
