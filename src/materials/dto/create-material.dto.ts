import { ApiProperty } from '@nestjs/swagger';

export class CreateMaterialDto {
  @ApiProperty({
    description: 'Nazwa materiału',
    example: 'Płyta wiórowa 16mm Dąb sonoma',
  })
  name: string;

  @ApiProperty({
    description: 'Ilość w metrach kwadratowych',
    example: 25.5
  })
  stockArea: number;

}
