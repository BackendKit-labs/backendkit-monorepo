import { IsString, IsArray, IsNotEmpty } from 'class-validator';

export class CreateShipmentDto {
  @IsString()
  @IsNotEmpty()
  orderId!: string;

  @IsString()
  @IsNotEmpty()
  customerId!: string;

  @IsArray()
  items!: any[];
}
