import { IsString, IsNumber, IsArray, ValidateNested, Min, IsNotEmpty, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';
import { ProductVariantDto } from './create-product.dto';

export class UpdateProductDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductVariantDto)
  variants?: ProductVariantDto[];
}
