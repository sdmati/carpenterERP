import { ApiProperty } from '@nestjs/swagger';
import {
  IsInt,
  IsNotEmpty,
  IsNumber,
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

  @ApiProperty({
    description: 'Grubość elementu w milimetrach',
    example: 18.0,
  })
  @IsNumber()
  @IsPositive()
  @IsNotEmpty()
  thickness: number;

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
