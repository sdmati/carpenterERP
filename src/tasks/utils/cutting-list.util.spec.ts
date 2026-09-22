import { describe, it, expect } from 'vitest';
import { groupTasksIntoCuttingList } from './cutting-list.util.js';
import { Color, TaskStatus } from '@prisma/client';

describe('groupTasksIntoCuttingList', () => {
  it('grupuje formatki o tych samych wymiarach i materiale w jedną pozycję listy rozkroju', () => {
    const tasks = [
      {
        id: 1,
        quantity: 5,
        status: TaskStatus.PENDING,
        barcode: 'ORD-001-PART-1',
        partDefinition: {
          id: 10,
          name: 'Bok lewy',
          length: 720,
          width: 510,
          thickness: 18,
          material: {
            id: 1,
            name: 'Dąb Sonoma 18mm',
            color: Color.SONOMA,
            thickness: 18,
          },
        },
      },
      {
        id: 2,
        quantity: 5,
        status: TaskStatus.PENDING,
        barcode: 'ORD-001-PART-2',
        partDefinition: {
          id: 11,
          name: 'Bok prawy', // Inna nazwa i inne późniejsze wiercenie, ale TEN SAM wymiar i materiał!
          length: 720,
          width: 510,
          thickness: 18,
          material: {
            id: 1,
            name: 'Dąb Sonoma 18mm',
            color: Color.SONOMA,
            thickness: 18,
          },
        },
      },
      {
        id: 3,
        quantity: 5,
        status: TaskStatus.PENDING,
        barcode: 'ORD-001-PART-3',
        partDefinition: {
          id: 12,
          name: 'Wieniec dolny',
          length: 564,
          width: 510,
          thickness: 18,
          material: {
            id: 1,
            name: 'Dąb Sonoma 18mm',
            color: Color.SONOMA,
            thickness: 18,
          },
        },
      },
    ];

    const result = groupTasksIntoCuttingList(tasks);

    // Mamy 2 różne wymiary (720x510 oraz 564x510)
    expect(result).toHaveLength(2);

    // Grupa 720 x 510 powinna łączyć Bok lewy (5 szt.) i Bok prawy (5 szt.) -> łącznie 10 sztuk
    const group720 = result.find(
      (g) => g.dimensions.length === 720 && g.dimensions.width === 510,
    );
    expect(group720).toBeDefined();
    expect(group720!.totalQuantity).toBe(10);
    expect(group720!.cutQuantity).toBe(0);
    expect(group720!.pendingQuantity).toBe(10);
    expect(group720!.isFullyCut).toBe(false);
    expect(group720!.parts).toHaveLength(2);
    expect(group720!.parts.map((p) => p.partName)).toEqual(['Bok lewy', 'Bok prawy']);

    // Grupa 564 x 510
    const group564 = result.find(
      (g) => g.dimensions.length === 564 && g.dimensions.width === 510,
    );
    expect(group564).toBeDefined();
    expect(group564!.totalQuantity).toBe(5);
  });

  it('poprawnie wylicza cutQuantity i isFullyCut gdy część lub całość jest wycięta', () => {
    const tasks = [
      {
        id: 1,
        quantity: 4,
        status: TaskStatus.CUT,
        barcode: 'B1',
        partDefinition: {
          id: 1,
          name: 'Front A',
          length: 400,
          width: 300,
          thickness: 18,
          material: { id: 2, name: 'Biała 18mm', color: Color.WHITE, thickness: 18 },
        },
      },
      {
        id: 2,
        quantity: 2,
        status: TaskStatus.PENDING,
        barcode: 'B2',
        partDefinition: {
          id: 2,
          name: 'Front B',
          length: 400,
          width: 300,
          thickness: 18,
          material: { id: 2, name: 'Biała 18mm', color: Color.WHITE, thickness: 18 },
        },
      },
    ];

    const result = groupTasksIntoCuttingList(tasks);
    expect(result).toHaveLength(1);
    expect(result[0].totalQuantity).toBe(6);
    expect(result[0].cutQuantity).toBe(4);
    expect(result[0].pendingQuantity).toBe(2);
    expect(result[0].isFullyCut).toBe(false);

    // Gdy zmienimy drugie zadanie na CUT:
    tasks[1].status = TaskStatus.CUT;
    const resultFullyCut = groupTasksIntoCuttingList(tasks);
    expect(resultFullyCut[0].cutQuantity).toBe(6);
    expect(resultFullyCut[0].pendingQuantity).toBe(0);
    expect(resultFullyCut[0].isFullyCut).toBe(true);
  });
});
