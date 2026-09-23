import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
} from 'class-validator';
import { Color } from '@prisma/client';

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
    description: 'Czy pierwsza krawędź wzdłuż długości (D1) ma być oklejona',
    example: true,
    required: false,
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  edgeLength1?: boolean;

  @ApiProperty({
    description: 'Czy druga krawędź wzdłuż długości (D2) ma być oklejona',
    example: false,
    required: false,
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  edgeLength2?: boolean;

  @ApiProperty({
    description: 'Czy pierwsza krawędź wzdłuż szerokości (S1) ma być oklejona',
    example: true,
    required: false,
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  edgeWidth1?: boolean;

  @ApiProperty({
    description: 'Czy druga krawędź wzdłuż szerokości (S2) ma być oklejona',
    example: false,
    required: false,
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  edgeWidth2?: boolean;

  @ApiProperty({
    description: 'Typ obrzeża/okleiny (np. ABS, PCV, Melamina)',
    example: 'ABS',
    required: false,
  })
  @IsString()
  @IsOptional()
  edgeTapeType?: string;

  @ApiProperty({
    description: 'Kolor obrzeża/okleiny',
    enum: Color,
    example: Color.SONOMA,
    required: false,
  })
  @IsEnum(Color)
  @IsOptional()
  edgeTapeColor?: Color;

  @ApiProperty({
    description: 'Grubość obrzeża/okleiny w mm (np. 0.8, 1.0, 2.0)',
    example: 1.0,
    required: false,
  })
  @IsNumber()
  @IsPositive()
  @IsOptional()
  edgeTapeThickness?: number;

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
