import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';

export class ConsumeEdgeTapeDto {
  @ApiProperty({
    description: 'Liczba zużytych / odliczonych metrów bieżących okleiny (mb)',
    example: 15.5,
  })
  @IsNumber()
  @IsPositive()
  meters: number;

  @ApiPropertyOptional({
    description: 'Opcjonalny powód odliczenia (np. odpad technologiczny, uszkodzona rolka, próbki)',
    example: 'Odpad technologiczny przy ustawianiu okleiniarki',
  })
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiPropertyOptional({
    description: 'Opcjonalne ID zlecenia produkcyjnego',
    example: 1,
  })
  @IsOptional()
  @IsInt()
  @IsPositive()
  orderId?: number;
}
