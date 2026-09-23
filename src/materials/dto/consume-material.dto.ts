import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsPositive, Min } from 'class-validator';

export class ConsumeMaterialDto {
  @ApiProperty({
    description: 'Liczba zużytych całych arkuszy płyty',
    example: 3,
    minimum: 1,
  })
  @IsInt()
  @Min(1)
  sheetsCount: number;

  @ApiPropertyOptional({
    description: 'Opcjonalne ID zlecenia produkcyjnego, do którego zużyto arkusze',
    example: 1,
  })
  @IsOptional()
  @IsInt()
  @IsPositive()
  orderId?: number;

  @ApiPropertyOptional({
    description: 'Opcjonalne ID materiału płyty',
    example: 1,
  })
  @IsOptional()
  @IsInt()
  @IsPositive()
  materialId?: number;
}
