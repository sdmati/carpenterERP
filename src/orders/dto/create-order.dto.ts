import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsPositive } from 'class-validator';
import { OrderStatus } from '@prisma/client';

export class CreateOrderDto {
  @ApiProperty({
    description: 'Ilość zamawianych mebli do wyprodukowania w ramach zlecenia',
    example: 50,
  })
  @IsInt()
  @IsPositive()
  quantity: number;

  @ApiProperty({
    description: 'Identyfikator zamawianego produktu (mebla) z katalogu',
    example: 1,
  })
  @IsInt()
  @IsPositive()
  productId: number;

  @ApiPropertyOptional({
    description: 'Status realizacji zlecenia produkcyjnego',
    enum: OrderStatus,
    default: OrderStatus.PENDING,
    example: OrderStatus.PENDING,
  })
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;
}
