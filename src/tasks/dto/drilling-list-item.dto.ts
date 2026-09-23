import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TaskStatus } from '@prisma/client';

export class DrillingListItemDto {
  @ApiProperty({ example: 1, description: 'ID zadania/partii' })
  taskId: number;

  @ApiPropertyOptional({ example: 'ORD-001-PART-1', required: false, nullable: true })
  barcode: string | null;

  @ApiProperty({ example: 1, description: 'ID definicji części' })
  partDefId: number;

  @ApiProperty({ example: 'Bok lewy', description: 'Nazwa elementu' })
  partName: string;

  @ApiProperty({ example: 5, description: 'Liczba formatek w partii' })
  quantity: number;

  @ApiProperty({ example: 720, description: 'Długość w mm' })
  length: number;

  @ApiProperty({ example: 510, description: 'Szerokość w mm' })
  width: number;

  @ApiProperty({ example: 18, description: 'Grubość w mm' })
  thickness: number;

  @ApiPropertyOptional({ example: 'Płyta laminowana Dąb Sonoma 18mm', description: 'Nazwa materiału płyty' })
  materialName?: string;

  @ApiProperty({ enum: TaskStatus, example: TaskStatus.EDGED, description: 'Aktualny status partii' })
  status: TaskStatus;

  @ApiProperty({ example: true, description: 'Czy element wymagał wcześniejszego oklejenia krawędzi' })
  requiresEdgeBanding: boolean;

  @ApiProperty({ example: true, description: 'Czy formatka spełnia warunki i jest gotowa do wiercenia CNC' })
  isReadyToDrill: boolean;

  @ApiProperty({ example: false, description: 'Czy formatka została już nawiercona' })
  isDrilled: boolean;
}

export class OrderDrillingSummaryDto {
  @ApiProperty({ example: 1, description: 'ID zlecenia' })
  orderId: number;

  @ApiPropertyOptional({ example: 'Szafka dolna kuchenna 60', required: false })
  productName?: string;

  @ApiProperty({ example: 5, description: 'Liczba zamawianych mebli' })
  orderQuantity: number;

  @ApiProperty({ example: 5, description: 'Łączna liczba partii/zadań w zleceniu' })
  totalTasksCount: number;

  @ApiProperty({ example: 25, description: 'Łączna liczba formatek do nawiercenia' })
  totalPiecesCount: number;

  @ApiProperty({ example: 3, description: 'Liczba partii gotowych do wiercenia' })
  readyTasksCount: number;

  @ApiProperty({ example: 15, description: 'Liczba sztuk formatek gotowych do wiercenia' })
  readyPiecesCount: number;

  @ApiProperty({ example: 0, description: 'Liczba partii już nawierconych' })
  drilledTasksCount: number;

  @ApiProperty({ example: 0, description: 'Liczba sztuk formatek już nawierconych' })
  drilledPiecesCount: number;

  @ApiProperty({ example: 2, description: 'Liczba partii oczekujących na wcześniejsze etapy (CUT/EDGED)' })
  pendingTasksCount: number;

  @ApiProperty({ example: false, description: 'Czy wszystkie formatki w zleceniu zostały już nawiercone' })
  isFullyDrilled: boolean;

  @ApiProperty({ type: [DrillingListItemDto], description: 'Lista partii z informacjami o wierceniu' })
  tasks: DrillingListItemDto[];
}
