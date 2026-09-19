import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
} from 'class-validator';
import { Color } from '@prisma/client';

export class CreateMaterialDto {
  @ApiProperty({
    description: 'Nazwa materiału / płyty meblowej',
    example: 'Płyta wiórowa laminowana Dąb Sonoma 18mm',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    description: 'Długość arkusza w milimetrach',
    example: 2800.0,
  })
  @IsNumber()
  @IsPositive()
  length: number;

  @ApiProperty({
    description: 'Szerokość arkusza w milimetrach',
    example: 2070.0,
  })
  @IsNumber()
  @IsPositive()
  width: number;

  @ApiProperty({
    description: 'Grubość płyty w milimetrach',
    example: 18.0,
  })
  @IsNumber()
  @IsPositive()
  thickness: number;

  @ApiProperty({
    description: 'Kolor płyty meblowej',
    enum: Color,
    example: Color.SONOMA,
  })
  @IsEnum(Color)
  color: Color;

  @ApiPropertyOptional({
    description: 'Ilość całych arkuszy na stanie',
    example: 15,
    default: 0,
  })
  @IsOptional()
  @IsInt()
  stockQuantity?: number;

  @ApiPropertyOptional({
    description: 'Ilość materiału w metrach kwadratowych',
    example: 86.94,
    default: 0,
  })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  stockArea?: number;
}
