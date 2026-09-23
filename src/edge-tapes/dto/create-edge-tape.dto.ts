import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Color } from '@prisma/client';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Min,
} from 'class-validator';

export class CreateEdgeTapeDto {
  @ApiProperty({
    description: 'Nazwa okleiny / obrzeża',
    example: 'Okleina ABS Dąb Sonoma 1.0mm',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    description: 'Typ materiału okleiny (np. ABS, Melamina, PCV)',
    example: 'ABS',
  })
  @IsString()
  @IsNotEmpty()
  type: string;

  @ApiProperty({
    description: 'Kolor okleiny',
    enum: Color,
    example: Color.SONOMA,
  })
  @IsEnum(Color)
  color: Color;

  @ApiProperty({
    description: 'Grubość okleiny w milimetrach',
    example: 1.0,
  })
  @IsNumber()
  @IsPositive()
  thickness: number;

  @ApiPropertyOptional({
    description: 'Szerokość okleiny w milimetrach (np. 22 mm)',
    example: 22.0,
  })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  width?: number;

  @ApiPropertyOptional({
    description: 'Początkowy stan magazynowy w metrach bieżących (mb)',
    example: 500.0,
    default: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  stockMeters?: number;
}
