import { Test, TestingModule } from '@nestjs/testing';
import { MaterialsService } from './materials.service.js';

import { PrismaService } from '../prisma/prisma.service.js';

import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Color } from '@prisma/client';

describe('MaterialsService', () => {
  let service: MaterialsService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      material: {
        create: vi.fn(),
        findMany: vi.fn(),
        findUnique: vi.fn(),
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
        MaterialsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<MaterialsService>(MaterialsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('consume', () => {
    it('prawidłowo odejmuje liczbę arkuszy i przelicza m2', async () => {
      prisma.material.findUnique.mockResolvedValue({
        id: 1,
        name: 'Płyta laminowana Dąb Sonoma 18mm',
        length: 2800,
        width: 2070,
        thickness: 18,
        color: Color.SONOMA,
        stockQuantity: 50,
        stockArea: 289.8,
      });

      prisma.material.update.mockResolvedValue({
        id: 1,
        name: 'Płyta laminowana Dąb Sonoma 18mm',
        length: 2800,
        width: 2070,
        thickness: 18,
        color: Color.SONOMA,
        stockQuantity: 47,
        stockArea: 272.41,
      });

      const result = await service.consume(1, 3);

      expect(result.materialId).toBe(1);
      expect(result.sheetsConsumed).toBe(3);
      expect(result.previousStock).toBe(50);
      expect(result.currentStock).toBe(47);
      expect(prisma.material.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: {
          stockQuantity: 47,
          stockArea: 272.41,
        },
      });
    });

    it('zwiększa sheetsUsed w zleceniu jeśli przekazano orderId', async () => {
      prisma.material.findUnique.mockResolvedValue({
        id: 1,
        name: 'Płyta laminowana Dąb Sonoma 18mm',
        length: 2800,
        width: 2070,
        thickness: 18,
        stockQuantity: 20,
        stockArea: 115.92,
      });
      prisma.material.update.mockResolvedValue({
        id: 1,
        name: 'Płyta laminowana Dąb Sonoma 18mm',
        stockQuantity: 18,
        stockArea: 104.33,
      });
      prisma.productionOrder.findUnique.mockResolvedValue({ id: 5 });
      prisma.productionOrder.update.mockResolvedValue({ id: 5, sheetsUsed: 2 });

      const result = await service.consume(1, 2, 5);

      expect(result.orderId).toBe(5);
      expect(result.orderSheetsUsed).toBe(2);
      expect(prisma.productionOrder.update).toHaveBeenCalledWith({
        where: { id: 5 },
        data: { sheetsUsed: { increment: 2 } },
      });
    });

    it('wyrzuca BadRequestException gdy sheetsCount <= 0', async () => {
      await expect(service.consume(1, 0)).rejects.toThrow(BadRequestException);
      await expect(service.consume(1, -2)).rejects.toThrow(BadRequestException);
    });

    it('wyrzuca NotFoundException gdy materiał nie istnieje', async () => {
      prisma.material.findUnique.mockResolvedValue(null);
      await expect(service.consume(999, 1)).rejects.toThrow(NotFoundException);
    });

    it('wyrzuca BadRequestException gdy żądane zużycie przekracza stan magazynowy', async () => {
      prisma.material.findUnique.mockResolvedValue({
        id: 1,
        name: 'Płyta Sonoma',
        stockQuantity: 2,
      });

      await expect(service.consume(1, 5)).rejects.toThrow(BadRequestException);
    });
  });
});
