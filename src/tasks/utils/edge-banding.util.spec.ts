import { describe, it, expect } from 'vitest';
import { Color, TaskStatus } from '@prisma/client';
import {
  calculatePartEdgeMeters,
  calculateTaskEdgeBanding,
  calculateOrderEdgeBandingSummary,
  requiresEdgeBanding,
} from './edge-banding.util.js';

describe('edge-banding.util', () => {
  describe('requiresEdgeBanding', () => {
    it('zwraca false jeśli żadna krawędź nie jest wybrana', () => {
      expect(
        requiresEdgeBanding({
          length: 720,
          width: 510,
          edgeLength1: false,
          edgeLength2: false,
          edgeWidth1: false,
          edgeWidth2: false,
        }),
      ).toBe(false);
      expect(requiresEdgeBanding(null)).toBe(false);
    });

    it('zwraca true jeśli co najmniej jedna krawędź jest wybrana', () => {
      expect(
        requiresEdgeBanding({
          length: 720,
          width: 510,
          edgeLength1: true,
          edgeLength2: false,
          edgeWidth1: false,
          edgeWidth2: false,
        }),
      ).toBe(true);

      expect(
        requiresEdgeBanding({
          length: 564,
          width: 100,
          edgeLength1: false,
          edgeLength2: false,
          edgeWidth1: true,
          edgeWidth2: false,
        }),
      ).toBe(true);
    });
  });

  describe('calculatePartEdgeMeters', () => {
    it('zwraca 0 m gdy brak oklejenia krawędzi', () => {
      const part = {
        length: 720,
        width: 510,
        edgeLength1: false,
        edgeLength2: false,
        edgeWidth1: false,
        edgeWidth2: false,
      };
      expect(calculatePartEdgeMeters(part)).toBe(0);
    });

    it('poprawnie sumuje długość dla wybranych krawędzi D1 i S1', () => {
      const part = {
        length: 720,
        width: 510,
        edgeLength1: true, // 720 mm
        edgeLength2: false,
        edgeWidth1: true,  // 510 mm
        edgeWidth2: false,
      };
      // 720 + 510 = 1230 mm = 1.23 m
      expect(calculatePartEdgeMeters(part)).toBe(1.23);
    });

    it('poprawnie sumuje długość dla wszystkich 4 krawędzi (obwód)', () => {
      const part = {
        length: 800,
        width: 400,
        edgeLength1: true, // 800
        edgeLength2: true, // 800
        edgeWidth1: true,  // 400
        edgeWidth2: true,  // 400
      };
      // 2 * (800 + 400) = 2400 mm = 2.4 m
      expect(calculatePartEdgeMeters(part)).toBe(2.4);
    });
  });

  describe('calculateTaskEdgeBanding', () => {
    it('oblicza zapotrzebowanie na okleinę dla partii produkcyjnej', () => {
      const task = {
        id: 1,
        quantity: 10,
        status: TaskStatus.PENDING,
        barcode: 'BAR-001',
        partDefId: 5,
        partDefinition: {
          id: 5,
          name: 'Bok lewy',
          length: 720,
          width: 510,
          thickness: 18,
          edgeLength1: true,
          edgeLength2: false,
          edgeWidth1: true,
          edgeWidth2: false,
          edgeTapeType: 'ABS',
          edgeTapeColor: Color.SONOMA,
          edgeTapeThickness: 1.0,
        },
      };

      const result = calculateTaskEdgeBanding(task);

      expect(result.taskId).toBe(1);
      expect(result.partName).toBe('Bok lewy');
      expect(result.quantity).toBe(10);
      expect(result.requiresEdgeBanding).toBe(true);
      expect(result.metersPerPiece).toBe(1.23);
      // 1.23 * 10 = 12.3 mb
      expect(result.totalMeters).toBe(12.3);
      expect(result.edgeTapeType).toBe('ABS');
      expect(result.edgeTapeColor).toBe(Color.SONOMA);
      expect(result.edgeTapeThickness).toBe(1.0);
    });
  });

  describe('calculateOrderEdgeBandingSummary', () => {
    it('tworzy podsumowanie z podziałem na rodzaje taśm i sumuje łączne metry', () => {
      const order = {
        id: 100,
        quantity: 2,
        color: Color.SONOMA,
        product: {
          name: 'Szafka dolna kuchenna 60',
        },
        tasks: [
          // Bok lewy: 2 szt * 2 szafki = 4 formatki (720x510, D1 + S1 = 1.23 m/szt) -> 4 * 1.23 = 4.92 m ABS SONOMA 1.0
          {
            id: 1,
            quantity: 4,
            status: TaskStatus.PENDING,
            barcode: 'ORD-1',
            partDefinition: {
              id: 1,
              name: 'Bok lewy',
              length: 720,
              width: 510,
              edgeLength1: true,
              edgeLength2: false,
              edgeWidth1: true,
              edgeWidth2: false,
              edgeTapeType: 'ABS',
              edgeTapeColor: Color.SONOMA,
              edgeTapeThickness: 1.0,
            },
          },
          // Półka: 1 szt * 2 szafki = 2 formatki (564x490, D1 = 0.564 m/szt) -> 2 * 0.564 = 1.13 m Melamina SONOMA 0.8
          {
            id: 2,
            quantity: 2,
            status: TaskStatus.PENDING,
            barcode: 'ORD-2',
            partDefinition: {
              id: 2,
              name: 'Półka',
              length: 564,
              width: 490,
              edgeLength1: true,
              edgeLength2: false,
              edgeWidth1: false,
              edgeWidth2: false,
              edgeTapeType: 'Melamina',
              edgeTapeColor: Color.SONOMA,
              edgeTapeThickness: 0.8,
            },
          },
          // Trawers: brak okleiny -> 0 mb
          {
            id: 3,
            quantity: 4,
            status: TaskStatus.PENDING,
            barcode: 'ORD-3',
            partDefinition: {
              id: 3,
              name: 'Trawers',
              length: 564,
              width: 100,
              edgeLength1: false,
              edgeLength2: false,
              edgeWidth1: false,
              edgeWidth2: false,
            },
          },
        ],
      };

      const summary = calculateOrderEdgeBandingSummary(order);

      expect(summary.orderId).toBe(100);
      expect(summary.productName).toBe('Szafka dolna kuchenna 60');
      expect(summary.tasks).toHaveLength(3);

      // Tape breakdown: 2 rodzaje taśm
      expect(summary.tapeBreakdown).toHaveLength(2);

      const absSonoma = summary.tapeBreakdown.find(
        (t) => t.tapeType === 'ABS' && t.tapeThickness === 1.0,
      );
      expect(absSonoma).toBeDefined();
      expect(absSonoma?.totalMeters).toBe(4.92);
      expect(absSonoma?.totalPieces).toBe(4);

      const melaminaSonoma = summary.tapeBreakdown.find(
        (t) => t.tapeType === 'Melamina' && t.tapeThickness === 0.8,
      );
      expect(melaminaSonoma).toBeDefined();
      expect(melaminaSonoma?.totalMeters).toBe(1.13);
      expect(melaminaSonoma?.totalPieces).toBe(2);

      // Łącznie: 4.92 + 1.13 = 6.05 mb
      expect(summary.totalMeters).toBe(6.05);
    });
  });
});
