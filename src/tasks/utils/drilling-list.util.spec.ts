import { describe, it, expect } from 'vitest';
import { TaskStatus } from '@prisma/client';
import {
  isTaskReadyToDrill,
  buildDrillingListItem,
  buildOrderDrillingSummary,
} from './drilling-list.util.js';

describe('drilling-list.util', () => {
  const edgedTask = {
    id: 1,
    quantity: 5,
    status: TaskStatus.EDGED,
    barcode: 'BAR-1',
    partDefinition: {
      id: 10,
      name: 'Bok lewy',
      length: 720,
      width: 510,
      thickness: 18,
      edgeLength1: true,
      material: { name: 'Dąb Sonoma 18mm' },
    },
  };

  const cutTaskWithoutEdge = {
    id: 2,
    quantity: 2,
    status: TaskStatus.CUT,
    barcode: 'BAR-2',
    partDefinition: {
      id: 20,
      name: 'Trawers',
      length: 564,
      width: 100,
      thickness: 18,
      edgeLength1: false,
      material: { name: 'Dąb Sonoma 18mm' },
    },
  };

  const cutTaskNeedsEdge = {
    id: 3,
    quantity: 5,
    status: TaskStatus.CUT,
    barcode: 'BAR-3',
    partDefinition: {
      id: 30,
      name: 'Wieniec',
      length: 564,
      width: 510,
      thickness: 18,
      edgeLength1: true,
    },
  };

  const drilledTask = {
    id: 4,
    quantity: 5,
    status: TaskStatus.DRILLED,
    barcode: 'BAR-4',
    partDefinition: {
      id: 40,
      name: 'Półka',
      length: 564,
      width: 490,
      thickness: 18,
      edgeLength1: true,
    },
  };

  describe('isTaskReadyToDrill', () => {
    it('zwraca true dla formatki wymagającej oklejenia ze statusem EDGED', () => {
      expect(isTaskReadyToDrill(edgedTask)).toBe(true);
    });

    it('zwraca false dla formatki wymagającej oklejenia ze statusem CUT (najpierw musi być EDGED)', () => {
      expect(isTaskReadyToDrill(cutTaskNeedsEdge)).toBe(false);
    });

    it('zwraca true dla formatki niewymagającej oklejenia ze statusem CUT', () => {
      expect(isTaskReadyToDrill(cutTaskWithoutEdge)).toBe(true);
    });
  });

  describe('buildDrillingListItem', () => {
    it('prawidłowo mapuje właściwości partii do DTO', () => {
      const item = buildDrillingListItem(edgedTask);

      expect(item.taskId).toBe(1);
      expect(item.barcode).toBe('BAR-1');
      expect(item.partName).toBe('Bok lewy');
      expect(item.quantity).toBe(5);
      expect(item.requiresEdgeBanding).toBe(true);
      expect(item.isReadyToDrill).toBe(true);
      expect(item.isDrilled).toBe(false);
      expect(item.materialName).toBe('Dąb Sonoma 18mm');
    });
  });

  describe('buildOrderDrillingSummary', () => {
    it('oblicza zagregowane podsumowanie dla zlecenia', () => {
      const order = {
        id: 100,
        quantity: 1,
        product: { name: 'Szafka dolna 60' },
        tasks: [edgedTask, cutTaskWithoutEdge, cutTaskNeedsEdge, drilledTask],
      };

      const summary = buildOrderDrillingSummary(order);

      expect(summary.orderId).toBe(100);
      expect(summary.totalTasksCount).toBe(4);
      expect(summary.totalPiecesCount).toBe(17); // 5 + 2 + 5 + 5
      expect(summary.readyTasksCount).toBe(2); // edgedTask + cutTaskWithoutEdge
      expect(summary.readyPiecesCount).toBe(7); // 5 + 2
      expect(summary.drilledTasksCount).toBe(1); // drilledTask
      expect(summary.drilledPiecesCount).toBe(5);
      expect(summary.pendingTasksCount).toBe(1); // cutTaskNeedsEdge
      expect(summary.isFullyDrilled).toBe(false);
      expect(summary.tasks).toHaveLength(4);
    });
  });
});
