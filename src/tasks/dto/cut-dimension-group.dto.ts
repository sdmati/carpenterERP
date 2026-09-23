import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNumber, IsOptional, IsPositive } from 'class-validator';

export class CutDimensionGroupDto {
  @ApiProperty({ description: 'ID zlecenia produkcyjnego', example: 1 })
  @IsInt()
  @IsPositive()
  orderId: number;

  @ApiProperty({ description: 'Długość formatek w mm', example: 720 })
  @IsNumber()
  @IsPositive()
  length: number;

  @ApiProperty({ description: 'Szerokość formatek w mm', example: 510 })
  @IsNumber()
  @IsPositive()
  width: number;

  @ApiPropertyOptional({ description: 'Opcjonalne ID materiału', example: 1 })
  @IsOptional()
  @IsInt()
  @IsPositive()
  materialId?: number;

  @ApiPropertyOptional({
    description: 'Opcjonalna liczba całych arkuszy płyty zużytych podczas rozkroju',
    example: 2,
  })
  @IsOptional()
  @IsInt()
  @IsPositive()
  sheetsUsed?: number;
}
