import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
export class CreateProductDto {
  @ApiProperty({
    description: 'Product name',
    example: 'Szafa 2 drzwiowa',
  })
  name: string;
}
