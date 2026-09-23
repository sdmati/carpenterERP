import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsInt, IsOptional, IsPositive } from 'class-validator';

export class DrillBatchDto {
  @ApiPropertyOptional({
    description: 'ID zlecenia produkcyjnego (oznaczy gotowe partie w zleceniu jako DRILLED)',
    example: 1,
  })
  @IsOptional()
  @IsInt()
  @IsPositive()
  orderId?: number;

  @ApiPropertyOptional({
    description: 'Lista identyfikatorów partii produkcyjnych do nawiercenia',
    example: [1, 2, 3],
  })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  taskIds?: number[];
}
