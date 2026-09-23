import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsInt, IsOptional, IsPositive } from 'class-validator';

export class PackBatchDto {
  @ApiPropertyOptional({
    description: 'ID zlecenia produkcyjnego (oznaczy nawiercone partie w zleceniu jako COMPLETED / spakowane)',
    example: 1,
  })
  @IsOptional()
  @IsInt()
  @IsPositive()
  orderId?: number;

  @ApiPropertyOptional({
    description: 'Lista identyfikatorów partii produkcyjnych do spakowania (COMPLETED)',
    example: [1, 2, 3],
  })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  taskIds?: number[];
}
