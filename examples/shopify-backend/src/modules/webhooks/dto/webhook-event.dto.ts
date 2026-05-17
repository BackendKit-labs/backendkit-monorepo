import { IsString, IsObject, IsNotEmpty } from 'class-validator';

export class WebhookEventDto {
  @IsString()
  @IsNotEmpty()
  event!: string;

  @IsObject()
  payload!: Record<string, any>;

  @IsString()
  @IsNotEmpty()
  source!: string;

  @IsString()
  @IsNotEmpty()
  timestamp!: string;
}
