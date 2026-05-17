import { IsNumber, Min } from 'class-validator';

export class ReserveInventoryDto {
  @IsNumber()
  @Min(1)
  quantity!: number;
}
