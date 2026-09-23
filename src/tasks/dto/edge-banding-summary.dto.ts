import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Color, TaskStatus } from '@prisma/client';

export class PartEdgeDetailsDto {
  @ApiProperty({ example: true, description: 'Długość 1 (D1)' })
  edgeLength1: boolean;

  @ApiProperty({ example: false, description: 'Długość 2 (D2)' })
  edgeLength2: boolean;

  @ApiProperty({ example: true, description: 'Szerokość 1 (S1)' })
  edgeWidth1: boolean;

  @ApiProperty({ example: false, description: 'Szerokość 2 (S2)' })
  edgeWidth2: boolean;
}

export class TaskEdgeBandingItemDto {
  @ApiProperty({ example: 1, description: 'ID zadania/partii' })
  taskId: number;

  @ApiProperty({ example: 'ORD-001-PART-1', required: false, nullable: true })
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

  @ApiProperty({ type: PartEdgeDetailsDto, description: 'Szczegóły okleinowania poszczególnych krawędzi' })
  edges: PartEdgeDetailsDto;

  @ApiProperty({ example: true, description: 'Czy formatka wymaga okleinowania' })
  requiresEdgeBanding: boolean;

  @ApiProperty({ example: 'ABS', required: false, nullable: true, description: 'Typ okleiny' })
  edgeTapeType: string | null;

  @ApiProperty({ enum: Color, example: Color.SONOMA, required: false, nullable: true, description: 'Kolor okleiny' })
  edgeTapeColor: Color | null;

  @ApiProperty({ example: 1.0, required: false, nullable: true, description: 'Grubość okleiny w mm' })
  edgeTapeThickness: number | null;

  @ApiProperty({ example: 1.23, description: 'Metry bieżące okleiny na 1 sztukę (mb)' })
  metersPerPiece: number;

  @ApiProperty({ example: 6.15, description: 'Metry bieżące okleiny na całą partię (mb)' })
  totalMeters: number;

  @ApiProperty({ enum: TaskStatus, example: TaskStatus.PENDING, description: 'Aktualny status partii' })
  status: TaskStatus;
}

export class TapeBreakdownDto {
  @ApiProperty({ example: 'ABS', description: 'Typ okleiny' })
  tapeType: string;

  @ApiProperty({ enum: Color, example: Color.SONOMA, description: 'Kolor okleiny' })
  tapeColor: Color | string;

  @ApiProperty({ example: 1.0, description: 'Grubość okleiny w mm' })
  tapeThickness: number;

  @ApiProperty({ example: 35.4, description: 'Łączna długość okleiny w metrach bieżących (mb)' })
  totalMeters: number;

  @ApiProperty({ example: 25, description: 'Łączna liczba formatek z tym typem okleiny' })
  totalPieces: number;

  @ApiPropertyOptional({ example: 500, description: 'Aktualny stan magazynowy okleiny w metrach bieżących (mb)' })
  availableStockMeters?: number;

  @ApiPropertyOptional({ example: true, description: 'Czy stan magazynowy jest wystarczający na pokrycie zapotrzebowania' })
  isSufficient?: boolean;

  @ApiPropertyOptional({ example: 0, description: 'Brakująca długość okleiny w metrach (0 jeśli wystarcza)' })
  missingMeters?: number;
}

export class OrderEdgeBandingSummaryDto {
  @ApiProperty({ example: 1, description: 'ID zlecenia' })
  orderId: number;

  @ApiProperty({ example: 'Szafka dolna kuchenna 60', required: false })
  productName?: string;

  @ApiProperty({ example: 5, description: 'Liczba zamawianych mebli' })
  orderQuantity: number;

  @ApiProperty({ example: 45.8, description: 'Łączne zapotrzebowanie na okleinę dla zlecenia w metrach bieżących (mb)' })
  totalMeters: number;

  @ApiPropertyOptional({ example: true, description: 'Czy wszystkie potrzebne rodzaje okleiny są w wystarczającej ilości w magazynie' })
  isStockSufficient?: boolean;

  @ApiPropertyOptional({ example: false, description: 'Czy okleina została już odliczona z magazynu dla tego zlecenia' })
  edgeTapeDeducted?: boolean;

  @ApiProperty({ type: [TapeBreakdownDto], description: 'Zestawienie zapotrzebowania pogrupowane po typie okleiny' })
  tapeBreakdown: TapeBreakdownDto[];

  @ApiProperty({ type: [TaskEdgeBandingItemDto], description: 'Szczegóły zapotrzebowania dla poszczególnych partii' })
  tasks: TaskEdgeBandingItemDto[];
}
