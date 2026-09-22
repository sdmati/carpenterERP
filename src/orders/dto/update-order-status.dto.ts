import { ApiProperty } from '@nestjs/swagger';
import { OrderStatus } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class UpdateOrderStatusDto {
  @ApiProperty({
    enum: OrderStatus,
    description:
      'Nowy status zamówienia (PACKER lub ADMIN może ustawić PACKED gdy wszystkie części są DRILLED; ADMIN może ustawić dowolny status)',
    example: OrderStatus.PACKED,
  })
  @IsEnum(OrderStatus)
  status: OrderStatus;
}
