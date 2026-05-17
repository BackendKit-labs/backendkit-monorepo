import { IsString, IsNumber, IsNotEmpty, Min } from 'class-validator';

export class ChargePaymentDto {
  @IsString()
  @IsNotEmpty()
  orderId!: string;

  @IsNumber()
  @Min(1)
  amount!: number;

  @IsString()
  @IsNotEmpty()
  method!: string;
}
