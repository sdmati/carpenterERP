import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TaskStatus } from '@prisma/client';

export class PackingListItemDto {
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

  @ApiProperty({ enum: TaskStatus, example: TaskStatus.DRILLED, description: 'Aktualny status partii' })
  status: TaskStatus;

  @ApiProperty({ example: true, description: 'Czy formatka jest nawiercona i gotowa do spakowania' })
  isReadyToPack: boolean;

  @ApiProperty({ example: false, description: 'Czy formatka została już spakowana (status COMPLETED)' })
  isPacked: boolean;
}

export class OrderPackingSummaryDto {
  @ApiProperty({ example: 1, description: 'ID zlecenia' })
  orderId: number;

  @ApiPropertyOptional({ example: 'Szafka dolna kuchenna 60', required: false })
  productName?: string;

  @ApiProperty({ example: 5, description: 'Liczba zamawianych mebli' })
  orderQuantity: number;

  @ApiProperty({ example: 5, description: 'Łączna liczba partii w zleceniu' })
  totalTasksCount: number;

  @ApiProperty({ example: 25, description: 'Łączna liczba formatek w zleceniu' })
  totalPiecesCount: number;

  @ApiProperty({ example: 5, description: 'Liczba partii gotowych do pakowania (DRILLED)' })
  readyTasksCount: number;

  @ApiProperty({ example: 25, description: 'Liczba sztuk gotowych do pakowania' })
  readyPiecesCount: number;

  @ApiProperty({ example: 0, description: 'Liczba partii już spakowanych (COMPLETED)' })
  packedTasksCount: number;

  @ApiProperty({ example: 0, description: 'Liczba sztuk już spakowanych' })
  packedPiecesCount: number;

  @ApiProperty({ example: 0, description: 'Liczba partii jeszcze nienawierconych' })
  undrilledTasksCount: number;

  @ApiProperty({ example: 100.0, description: 'Procent skompletowania/spakowania zlecenia' })
  completionPercentage: number;

  @ApiProperty({ example: false, description: 'Czy całe zlecenie zostało już w pełni spakowane' })
  isFullyPacked: boolean;

  @ApiProperty({ type: [PackingListItemDto], description: 'Szczegóły elementów do pakowania' })
  tasks: PackingListItemDto[];
}
