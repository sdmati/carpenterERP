import { TaskStatus } from '@prisma/client';
import { CuttingListItemDto } from '../dto/cutting-list-item.dto.js';

export function groupTasksIntoCuttingList(tasks: any[]): CuttingListItemDto[] {
  const groupsMap = new Map<string, CuttingListItemDto>();

  for (const task of tasks) {
    const partDef = task.partDefinition;
    if (!partDef || !partDef.material) {
      continue;
    }
    const material = partDef.material;
    const groupKey = `mat-${material.id}_${partDef.length}x${partDef.width}x${partDef.thickness}`;

    let group = groupsMap.get(groupKey);
    if (!group) {
      group = {
        groupKey,
        dimensions: {
          length: partDef.length,
          width: partDef.width,
          thickness: partDef.thickness,
          formatted: `${partDef.length} x ${partDef.width} x ${partDef.thickness} mm`,
        },
        material: {
          id: material.id,
          name: material.name,
          color: material.color,
          thickness: material.thickness,
        },
        totalQuantity: 0,
        cutQuantity: 0,
        pendingQuantity: 0,
        isFullyCut: false,
        parts: [],
      };
      groupsMap.set(groupKey, group);
    }

    group.totalQuantity += task.quantity;
    if (task.status === TaskStatus.PENDING) {
      group.pendingQuantity += task.quantity;
    } else {
      group.cutQuantity += task.quantity;
    }

    group.parts.push({
      taskId: task.id,
      partDefId: partDef.id,
      partName: partDef.name,
      barcode: task.barcode,
      quantity: task.quantity,
      status: task.status,
    });
  }

  for (const group of groupsMap.values()) {
    group.isFullyCut = group.pendingQuantity === 0 && group.totalQuantity > 0;
  }

  return Array.from(groupsMap.values());
}
