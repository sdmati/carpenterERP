import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateProductDto {
  @ApiProperty({
    description: 'Nazwa mebla / produktu w katalogu',
    example: 'Szafa 2-drzwiowa z szufladami',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({
    description: 'Kolorystyka lub wykończenie mebla',
    example: 'Dąb Artisan / Czarny mat',
  })
  @IsOptional()
  @IsString()
  color?: string;
}
