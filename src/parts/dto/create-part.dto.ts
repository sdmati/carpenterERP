import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
} from 'class-validator';

export class CreatePartDto {
  @ApiProperty({
    description: 'Nazwa elementu mebla',
    example: 'Bok szafki dolnej lewy',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    description: 'Liczba sztuk danej elementu wchodzącej w skład jednego mebla',
    example: 2,
  })
  @IsInt()
  @IsPositive()
  quantity: number;

  @ApiProperty({
    description: 'Długość elementu w milimetrach',
    example: 720.0,
  })
  @IsNumber()
  @IsPositive()
  length: number;

  @ApiProperty({
    description: 'Szerokość elementu w milimetrach',
    example: 560.0,
  })
  @IsNumber()
  @IsPositive()
  width: number;

  @ApiPropertyOptional({
    description: 'Grubość elementu w milimetrach',
    example: 18.0,
  })
  @IsNumber()
  @IsPositive()
  thickness?: number;

  @ApiProperty({
    description: 'Identyfikator mebla (produktu), do którego przypisany jest element',
    example: 1,
  })
  @IsInt()
  @IsPositive()
  productId: number;

  @ApiProperty({
    description: 'Identyfikator materiału/płyty meblowej (np. Płyta laminowana SONOMA)',
    example: 3,
  })
  @IsInt()
  @IsPositive()
  materialId: number;
}
