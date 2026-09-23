import { TaskStatus } from '@prisma/client';
import {
  PackingListItemDto,
  OrderPackingSummaryDto,
} from '../dto/packing-list-item.dto.js';

export function isTaskReadyToPack(task: any): boolean {
  return task?.status === TaskStatus.DRILLED;
}

export function buildPackingListItem(task: any): PackingListItemDto {
  const partDef = task.partDefinition || {};
  const ready = isTaskReadyToPack(task);
  const packed = task.status === TaskStatus.COMPLETED;

  return {
    taskId: task.id,
    barcode: task.barcode ?? null,
    partDefId: partDef.id ?? 0,
    partName: partDef.name ?? '',
    quantity: task.quantity,
    length: partDef.length ?? 0,
    width: partDef.width ?? 0,
    thickness: partDef.thickness ?? 18,
    status: task.status,
    isReadyToPack: ready,
    isPacked: packed,
  };
}

export function buildPackingList(tasks: any[]): PackingListItemDto[] {
  return tasks.map((task) => buildPackingListItem(task));
}

export function buildOrderPackingSummary(order: any): OrderPackingSummaryDto {
  const tasks = order.tasks || [];
  const items = buildPackingList(tasks);

  const totalTasksCount = items.length;
  const totalPiecesCount = items.reduce((sum, t) => sum + t.quantity, 0);

  const readyTasks = items.filter((t) => t.isReadyToPack);
  const readyTasksCount = readyTasks.length;
  const readyPiecesCount = readyTasks.reduce((sum, t) => sum + t.quantity, 0);

  const packedTasks = items.filter((t) => t.isPacked);
  const packedTasksCount = packedTasks.length;
  const packedPiecesCount = packedTasks.reduce((sum, t) => sum + t.quantity, 0);

  const undrilledTasksCount = items.filter(
    (t) => !t.isReadyToPack && !t.isPacked,
  ).length;

  const completionPercentage =
    totalTasksCount > 0
      ? Math.round((packedTasksCount / totalTasksCount) * 1000) / 10
      : 0;

  const isFullyPacked = totalTasksCount > 0 && packedTasksCount === totalTasksCount;

  return {
    orderId: order.id,
    productName: order.product?.name,
    orderQuantity: order.quantity,
    totalTasksCount,
    totalPiecesCount,
    readyTasksCount,
    readyPiecesCount,
    packedTasksCount,
    packedPiecesCount,
    undrilledTasksCount,
    completionPercentage,
    isFullyPacked,
    tasks: items,
  };
}
