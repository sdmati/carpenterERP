import { describe, it, expect } from 'vitest';
import { TaskStatus } from '@prisma/client';
import {
  isTaskReadyToPack,
  buildPackingListItem,
  buildOrderPackingSummary,
} from './packing-list.util.js';

describe('packing-list.util', () => {
  const drilledTask = {
    id: 1,
    quantity: 5,
    status: TaskStatus.DRILLED,
    barcode: 'BAR-1',
    partDefinition: {
      id: 10,
      name: 'Bok lewy',
      length: 720,
      width: 510,
      thickness: 18,
    },
  };

  const edgedTask = {
    id: 2,
    quantity: 5,
    status: TaskStatus.EDGED,
    barcode: 'BAR-2',
    partDefinition: {
      id: 20,
      name: 'Bok prawy',
      length: 720,
      width: 510,
      thickness: 18,
    },
  };

  const completedTask = {
    id: 3,
    quantity: 5,
    status: TaskStatus.COMPLETED,
    barcode: 'BAR-3',
    partDefinition: {
      id: 30,
      name: 'Wieniec dolny',
      length: 564,
      width: 510,
      thickness: 18,
    },
  };

  describe('isTaskReadyToPack', () => {
    it('zwraca true dla formatki nawierconej (DRILLED)', () => {
      expect(isTaskReadyToPack(drilledTask)).toBe(true);
    });

    it('zwraca false dla formatki nienawierconej (np. EDGED)', () => {
      expect(isTaskReadyToPack(edgedTask)).toBe(false);
    });
  });

  describe('buildPackingListItem', () => {
    it('prawidłowo mapuje właściwości partii', () => {
      const item = buildPackingListItem(drilledTask);

      expect(item.taskId).toBe(1);
      expect(item.partName).toBe('Bok lewy');
      expect(item.quantity).toBe(5);
      expect(item.isReadyToPack).toBe(true);
      expect(item.isPacked).toBe(false);
    });
  });

  describe('buildOrderPackingSummary', () => {
    it('oblicza zagregowane podsumowanie dla pakowni', () => {
      const order = {
        id: 200,
        quantity: 1,
        product: { name: 'Szafka dolna 60' },
        tasks: [drilledTask, edgedTask, completedTask],
      };

      const summary = buildOrderPackingSummary(order);

      expect(summary.orderId).toBe(200);
      expect(summary.totalTasksCount).toBe(3);
      expect(summary.totalPiecesCount).toBe(15);
      expect(summary.readyTasksCount).toBe(1); // drilledTask
      expect(summary.packedTasksCount).toBe(1); // completedTask
      expect(summary.undrilledTasksCount).toBe(1); // edgedTask
      expect(summary.completionPercentage).toBe(33.3);
      expect(summary.isFullyPacked).toBe(false);
      expect(summary.tasks).toHaveLength(3);
    });
  });
});
