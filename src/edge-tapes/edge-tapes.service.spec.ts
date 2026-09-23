import { Test, TestingModule } from '@nestjs/testing';
import { EdgeTapesService } from './edge-tapes.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { Color, TaskStatus } from '@prisma/client';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('EdgeTapesService', () => {
  let service: EdgeTapesService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      edgeTape: {
        create: vi.fn(),
        findMany: vi.fn(),
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      productionOrder: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EdgeTapesService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<EdgeTapesService>(EdgeTapesService);
  });

  it('powinien być zdefiniowany', () => {
    expect(service).toBeDefined();
  });

  describe('consume (ręczne odliczenie okleiny)', () => {
    it('prawidłowo odejmuje metry okleiny ze stanu magazynowego', async () => {
      prisma.edgeTape.findUnique.mockResolvedValue({
        id: 1,
        name: 'Okleina ABS Dąb Sonoma 1.0mm',
        type: 'ABS',
        color: Color.SONOMA,
        thickness: 1.0,
        stockMeters: 500,
      });

      prisma.edgeTape.update.mockResolvedValue({
        id: 1,
        name: 'Okleina ABS Dąb Sonoma 1.0mm',
        type: 'ABS',
        color: Color.SONOMA,
        thickness: 1.0,
        stockMeters: 485,
      });

      const result = await service.consume(1, 15, 'Odpad technologiczny');

      expect(result.edgeTapeId).toBe(1);
      expect(result.metersConsumed).toBe(15);
      expect(result.previousStockMeters).toBe(500);
      expect(result.currentStockMeters).toBe(485);
      expect(result.reason).toBe('Odpad technologiczny');
      expect(prisma.edgeTape.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { stockMeters: 485 },
      });
    });

    it('wyrzuca BadRequestException gdy meters <= 0', async () => {
      await expect(service.consume(1, 0)).rejects.toThrow(BadRequestException);
      await expect(service.consume(1, -5)).rejects.toThrow(BadRequestException);
    });

    it('wyrzuca NotFoundException gdy okleina nie istnieje', async () => {
      prisma.edgeTape.findUnique.mockResolvedValue(null);

      await expect(service.consume(999, 10)).rejects.toThrow(NotFoundException);
    });

    it('wyrzuca BadRequestException gdy brak wystarczającego stanu magazynowego', async () => {
      prisma.edgeTape.findUnique.mockResolvedValue({
        id: 1,
        name: 'Okleina ABS Sonoma',
        stockMeters: 20,
      });

      await expect(service.consume(1, 50)).rejects.toThrow(BadRequestException);
    });
  });

  describe('checkAvailability (automatyczne sprawdzanie dostępności okleiny dla zlecenia)', () => {
    it('zwraca isStockSufficient = true gdy magazyn pokrywa zapotrzebowanie', async () => {
      prisma.productionOrder.findUnique.mockResolvedValue({
        id: 1,
        quantity: 5,
        color: Color.SONOMA,
        product: { name: 'Szafka dolna kuchenna 60' },
        edgeTapeDeducted: false,
        tasks: [
          {
            id: 101,
            quantity: 5,
            status: TaskStatus.PENDING,
            barcode: 'ORD-1-PART-1',
            partDefinition: {
              id: 1,
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
          },
        ],
      });

      prisma.edgeTape.findMany.mockResolvedValue([
        {
          id: 1,
          name: 'Okleina ABS Dąb Sonoma 1.0mm',
          type: 'ABS',
          color: Color.SONOMA,
          thickness: 1.0,
          stockMeters: 100,
        },
      ]);

      const result = await service.checkAvailability(1);

      expect(result.orderId).toBe(1);
      expect(result.isStockSufficient).toBe(true);
      expect(result.tapeBreakdown[0].isSufficient).toBe(true);
      expect(result.tapeBreakdown[0].missingMeters).toBe(0);
      expect(result.tapeBreakdown[0].availableStockMeters).toBe(100);
    });

    it('zwraca isStockSufficient = false i missingMeters gdy na magazynie brakuje okleiny', async () => {
      prisma.productionOrder.findUnique.mockResolvedValue({
        id: 1,
        quantity: 10,
        color: Color.SONOMA,
        product: { name: 'Szafka dolna kuchenna 60' },
        edgeTapeDeducted: false,
        tasks: [
          {
            id: 101,
            quantity: 10,
            status: TaskStatus.PENDING,
            barcode: 'ORD-1-PART-1',
            partDefinition: {
              id: 1,
              name: 'Bok lewy',
              length: 1000,
              width: 500,
              thickness: 18,
              edgeLength1: true,
              edgeLength2: true,
              edgeWidth1: false,
              edgeWidth2: false,
              edgeTapeType: 'ABS',
              edgeTapeColor: Color.SONOMA,
              edgeTapeThickness: 1.0,
            },
          },
        ],
      });

      prisma.edgeTape.findMany.mockResolvedValue([
        {
          id: 1,
          name: 'Okleina ABS Dąb Sonoma 1.0mm',
          type: 'ABS',
          color: Color.SONOMA,
          thickness: 1.0,
          stockMeters: 5, // Potrzeba 20 mb (2m * 10 sztuk), na stanie tylko 5 mb
        },
      ]);

      const result = await service.checkAvailability(1);

      expect(result.isStockSufficient).toBe(false);
      expect(result.tapeBreakdown[0].isSufficient).toBe(false);
      expect(result.tapeBreakdown[0].missingMeters).toBe(15);
      expect(result.tapeBreakdown[0].availableStockMeters).toBe(5);
    });
  });
});
