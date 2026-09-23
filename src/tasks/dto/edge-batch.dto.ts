import { ApiPropertyOptional } from '@nestjs/swagger';
import { Color } from '@prisma/client';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
} from 'class-validator';

export class EdgeBatchDto {
  @ApiPropertyOptional({
    description: 'ID zlecenia produkcyjnego (oznaczy pasujące partie w zleceniu jako EDGED)',
    example: 1,
  })
  @IsOptional()
  @IsInt()
  @IsPositive()
  orderId?: number;

  @ApiPropertyOptional({
    description: 'Lista identyfikatorów partii produkcyjnych do oznaczenia jako EDGED',
    example: [1, 2],
  })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  taskIds?: number[];

  @ApiPropertyOptional({
    description: 'Opcjonalne zawężenie do typu okleiny (np. ABS, Melamina)',
    example: 'ABS',
  })
  @IsOptional()
  @IsString()
  edgeTapeType?: string;

  @ApiPropertyOptional({
    description: 'Opcjonalny kolor okleiny',
    enum: Color,
    example: Color.SONOMA,
  })
  @IsOptional()
  @IsEnum(Color)
  edgeTapeColor?: Color;

  @ApiPropertyOptional({
    description: 'Opcjonalna grubość okleiny w mm (np. 1.0)',
    example: 1.0,
  })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  edgeTapeThickness?: number;
}
