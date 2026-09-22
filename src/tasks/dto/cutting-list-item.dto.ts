import { ApiProperty } from '@nestjs/swagger';
import { Color, TaskStatus } from '@prisma/client';

export class PartInGroupDto {
  @ApiProperty({ description: 'ID zadania produkcyjnego', example: 1 })
  taskId: number;

  @ApiProperty({ description: 'ID definicji części', example: 10 })
  partDefId: number;

  @ApiProperty({ description: 'Nazwa elementu mebla', example: 'Bok lewy' })
  partName: string;

  @ApiProperty({ description: 'Kod kreskowy na wózek/formatkę', example: 'ORD-001-PART-1' })
  barcode: string | null;

  @ApiProperty({ description: 'Ilość sztuk tego elementu', example: 5 })
  quantity: number;

  @ApiProperty({ enum: TaskStatus, description: 'Status zadania', example: TaskStatus.PENDING })
  status: TaskStatus;
}

export class CuttingDimensionsDto {
  @ApiProperty({ description: 'Długość formatki w mm', example: 720 })
  length: number;

  @ApiProperty({ description: 'Szerokość formatki w mm', example: 510 })
  width: number;

  @ApiProperty({ description: 'Grubość formatki w mm', example: 18 })
  thickness: number;

  @ApiProperty({ description: 'Sformatowany wymiar', example: '720 x 510 x 18 mm' })
  formatted: string;
}

export class CuttingMaterialDto {
  @ApiProperty({ description: 'ID materiału', example: 1 })
  id: number;

  @ApiProperty({ description: 'Nazwa materiału / płyty', example: 'Płyta laminowana Dąb Sonoma 18mm' })
  name: string;

  @ApiProperty({ enum: Color, description: 'Kolor płyty', example: Color.SONOMA })
  color: Color;

  @ApiProperty({ description: 'Grubość płyty w mm', example: 18 })
  thickness: number;
}

export class CuttingListItemDto {
  @ApiProperty({ description: 'Unikalny klucz grupy rozkroju', example: 'mat-1_720x510x18' })
  groupKey: string;

  @ApiProperty({ description: 'Wymiary formatek w tej grupie' })
  dimensions: CuttingDimensionsDto;

  @ApiProperty({ description: 'Materiał z którego należy wyciąć płyty' })
  material: CuttingMaterialDto;

  @ApiProperty({ description: 'Łączna liczba płyt do wycięcia w tym rozmiarze', example: 10 })
  totalQuantity: number;

  @ApiProperty({ description: 'Liczba już wyciętych płyt (status CUT, DRILLED lub COMPLETED)', example: 0 })
  cutQuantity: number;

  @ApiProperty({ description: 'Liczba płyt pozostałych do wycięcia (status PENDING)', example: 10 })
  pendingQuantity: number;

  @ApiProperty({ description: 'Czy wszystkie płyty w tym rozmiarze zostały już wycięte', example: false })
  isFullyCut: boolean;

  @ApiProperty({ type: [PartInGroupDto], description: 'Części mebla wchodzące w skład tej grupy wymiarowej' })
  parts: PartInGroupDto[];
}
