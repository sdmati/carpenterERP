import { Color, TaskStatus } from '@prisma/client';
import {
  OrderEdgeBandingSummaryDto,
  PartEdgeDetailsDto,
  TapeBreakdownDto,
  TaskEdgeBandingItemDto,
} from '../dto/edge-banding-summary.dto.js';

export interface PartWithEdgeInfo {
  id?: number;
  name?: string;
  length: number;
  width: number;
  thickness?: number;
  edgeLength1?: boolean | null;
  edgeLength2?: boolean | null;
  edgeWidth1?: boolean | null;
  edgeWidth2?: boolean | null;
  edgeTapeType?: string | null;
  edgeTapeColor?: Color | null;
  edgeTapeThickness?: number | null;
}

export interface TaskWithEdgeInfo {
  id: number;
  quantity: number;
  status: TaskStatus;
  barcode?: string | null;
  partDefId?: number;
  partDefinition: PartWithEdgeInfo;
}

export interface OrderWithTasksAndEdgeInfo {
  id: number;
  quantity: number;
  color?: Color | null;
  product?: {
    name: string;
  } | null;
  tasks: TaskWithEdgeInfo[];
}

/**
 * Sprawdza czy formatka wymaga jakiegokolwiek okleinowania.
 */
export function requiresEdgeBanding(part?: PartWithEdgeInfo | null): boolean {
  if (!part) return false;
  return Boolean(
    part.edgeLength1 ||
    part.edgeLength2 ||
    part.edgeWidth1 ||
    part.edgeWidth2,
  );
}

/**
 * Oblicza metry bieżące okleiny na pojedynczą formatkę (w metrach).
 * Wymiary w mm przeliczane na metry (/ 1000).
 */
export function calculatePartEdgeMeters(part?: PartWithEdgeInfo | null): number {
  if (!part) return 0;
  let mm = 0;
  if (part.edgeLength1) mm += part.length;
  if (part.edgeLength2) mm += part.length;
  if (part.edgeWidth1) mm += part.width;
  if (part.edgeWidth2) mm += part.width;

  return Math.round((mm / 1000) * 1000) / 1000;
}

/**
 * Przelicza zapotrzebowanie na okleinę dla pojedynczej partii produkcyjnej (zadania).
 */
export function calculateTaskEdgeBanding(task: TaskWithEdgeInfo): TaskEdgeBandingItemDto {
  const part = task.partDefinition || {
    id: 0,
    name: '',
    length: 0,
    width: 0,
    thickness: 18,
  };
  const isRequired = requiresEdgeBanding(part);
  const metersPerPiece = calculatePartEdgeMeters(part);
  const totalMeters = Math.round(metersPerPiece * (task.quantity || 0) * 100) / 100;

  const edges: PartEdgeDetailsDto = {
    edgeLength1: Boolean(part.edgeLength1),
    edgeLength2: Boolean(part.edgeLength2),
    edgeWidth1: Boolean(part.edgeWidth1),
    edgeWidth2: Boolean(part.edgeWidth2),
  };

  return {
    taskId: task.id,
    barcode: task.barcode ?? null,
    partDefId: task.partDefId ?? part.id ?? 0,
    partName: part.name ?? '',
    quantity: task.quantity,
    length: part.length,
    width: part.width,
    thickness: part.thickness ?? 18,
    edges,
    requiresEdgeBanding: isRequired,
    edgeTapeType: part.edgeTapeType ?? null,
    edgeTapeColor: part.edgeTapeColor ?? null,
    edgeTapeThickness: part.edgeTapeThickness ?? null,
    metersPerPiece,
    totalMeters,
    status: task.status,
  };
}

/**
 * Tworzy pełne zestawienie okleinowania dla zlecenia:
 * - szczegóły dla każdego zadania / partii
 * - łączne metry dla zlecenia
 * - grupowanie wg typu, koloru i grubości okleiny (np. dla zamówienia rolek obrzeża)
 */
export function calculateOrderEdgeBandingSummary(
  order: OrderWithTasksAndEdgeInfo,
): OrderEdgeBandingSummaryDto {
  const taskItems: TaskEdgeBandingItemDto[] = (order.tasks || []).map((t) =>
    calculateTaskEdgeBanding(t),
  );

  const tapeMap = new Map<string, TapeBreakdownDto>();

  for (const item of taskItems) {
    if (!item.requiresEdgeBanding || item.totalMeters === 0) {
      continue;
    }

    const type = item.edgeTapeType || 'STANDARD';
    const color = item.edgeTapeColor || order.color || 'STANDARD';
    const thickness = item.edgeTapeThickness ?? 1.0;
    const key = `${type}_${color}_${thickness}`;

    const existing = tapeMap.get(key);
    if (existing) {
      existing.totalMeters = Math.round((existing.totalMeters + item.totalMeters) * 100) / 100;
      existing.totalPieces += item.quantity;
    } else {
      tapeMap.set(key, {
        tapeType: type,
        tapeColor: color,
        tapeThickness: thickness,
        totalMeters: item.totalMeters,
        totalPieces: item.quantity,
      });
    }
  }

  const tapeBreakdown = Array.from(tapeMap.values());
  const orderTotalMeters = Math.round(
    tapeBreakdown.reduce((sum, b) => sum + b.totalMeters, 0) * 100,
  ) / 100;

  return {
    orderId: order.id,
    productName: order.product?.name,
    orderQuantity: order.quantity,
    totalMeters: orderTotalMeters,
    tapeBreakdown,
    tasks: taskItems,
  };
}
