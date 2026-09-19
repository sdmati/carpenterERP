import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CreateProductDto {
  @ApiProperty({
    description: 'Nazwa mebla / produktu w katalogu',
    example: 'Szafa 2-drzwiowa z szufladami',
  })
  @IsString()
  @IsNotEmpty()
  name: string;
}
