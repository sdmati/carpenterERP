import { TaskStatus } from '@prisma/client';
import {
  DrillingListItemDto,
  OrderDrillingSummaryDto,
} from '../dto/drilling-list-item.dto.js';
import { requiresEdgeBanding } from './edge-banding.util.js';

export function isTaskReadyToDrill(task: any): boolean {
  if (!task || !task.partDefinition) return false;
  const needsEdge = requiresEdgeBanding(task.partDefinition);
  if (needsEdge) {
    return task.status === TaskStatus.EDGED;
  }
  return task.status === TaskStatus.CUT;
}

export function buildDrillingListItem(task: any): DrillingListItemDto {
  const partDef = task.partDefinition || {};
  const material = partDef.material;
  const needsEdge = requiresEdgeBanding(partDef);
  const ready = isTaskReadyToDrill(task);
  const drilled =
    task.status === TaskStatus.DRILLED || task.status === TaskStatus.COMPLETED;

  return {
    taskId: task.id,
    barcode: task.barcode ?? null,
    partDefId: partDef.id ?? 0,
    partName: partDef.name ?? '',
    quantity: task.quantity,
    length: partDef.length ?? 0,
    width: partDef.width ?? 0,
    thickness: partDef.thickness ?? 18,
    materialName: material?.name,
    status: task.status,
    requiresEdgeBanding: needsEdge,
    isReadyToDrill: ready,
    isDrilled: drilled,
  };
}

export function buildDrillingList(tasks: any[]): DrillingListItemDto[] {
  return tasks.map((task) => buildDrillingListItem(task));
}

export function buildOrderDrillingSummary(order: any): OrderDrillingSummaryDto {
  const tasks = order.tasks || [];
  const items = buildDrillingList(tasks);

  const totalTasksCount = items.length;
  const totalPiecesCount = items.reduce((sum, t) => sum + t.quantity, 0);

  const readyTasks = items.filter((t) => t.isReadyToDrill);
  const readyTasksCount = readyTasks.length;
  const readyPiecesCount = readyTasks.reduce((sum, t) => sum + t.quantity, 0);

  const drilledTasks = items.filter((t) => t.isDrilled);
  const drilledTasksCount = drilledTasks.length;
  const drilledPiecesCount = drilledTasks.reduce((sum, t) => sum + t.quantity, 0);

  const pendingTasksCount = items.filter(
    (t) => !t.isReadyToDrill && !t.isDrilled,
  ).length;

  const isFullyDrilled = totalTasksCount > 0 && drilledTasksCount === totalTasksCount;

  return {
    orderId: order.id,
    productName: order.product?.name,
    orderQuantity: order.quantity,
    totalTasksCount,
    totalPiecesCount,
    readyTasksCount,
    readyPiecesCount,
    drilledTasksCount,
    drilledPiecesCount,
    pendingTasksCount,
    isFullyDrilled,
    tasks: items,
  };
}
