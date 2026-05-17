import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  HttpCode,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { ChargePaymentDto } from './dto/charge-payment.dto';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('charge')
  @HttpCode(HttpStatus.CREATED)
  async charge(@Body() dto: ChargePaymentDto) {
    return this.paymentsService.charge(dto);
  }

  @Get(':id')
  findById(@Param('id') id: string) {
    const record = this.paymentsService.findById(id);
    if (!record) {
      throw new NotFoundException(`Payment record ${id} not found`);
    }
    return record;
  }
}
