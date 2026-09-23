import { Test, TestingModule } from '@nestjs/testing';
import { OrdersService } from './orders.service.js';
import { Color, OrderStatus, Role, TaskStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface.js';

describe('OrdersService', () => {
  let service: OrdersService;
  let prisma: any;

  const packer: AuthenticatedUser = {
    id: 1,
    username: 'pakowacz',
    name: 'Adam Pakowacz',
    role: Role.PACKER,
  };

  const sawOperator: AuthenticatedUser = {
    id: 2,
    username: 'pilarz',
    name: 'Jan Pilarz',
    role: Role.SAW_OPERATOR,
  };

  const admin: AuthenticatedUser = {
    id: 99,
    username: 'admin',
    name: 'Administrator',
    role: Role.ADMIN,
  };

  const edgeOperator: AuthenticatedUser = {
    id: 3,
    username: 'okleiniarz',
    name: 'Marek Okleiniarz',
    role: Role.EDGE_BANDER_OPERATOR,
  };

  const drillOperator: AuthenticatedUser = {
    id: 4,
    username: 'wiertacz',
    name: 'Piotr Wiertacz',
    role: Role.DRILL_OPERATOR,
  };

  beforeEach(async () => {
    prisma = {
      product: {},
      productionOrder: {},
      productionTask: {},
      material: {},
      edgeTape: {},
      $transaction: vi.fn((promises) => Promise.all(promises)),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should throw NotFoundException if product is not found', async () => {
      prisma.product.findUnique = vi.fn().mockResolvedValue(null);

      await expect(
        service.create({ productId: 999, quantity: 1, color: Color.SONOMA }),
      ).rejects.toThrow('Nie znaleziono takiego mebla.');
    });

    it('should throw BadRequestException if product has no parts', async () => {
      prisma.product.findUnique = vi.fn().mockResolvedValue({ id: 1, name: 'Pusta szafka', parts: [] });

      await expect(
        service.create({ productId: 1, quantity: 1, color: Color.SONOMA }),
      ).rejects.toThrow('Mebel nie ma przypisanych żadnych formatek w technologii.');
    });

    it('should create order and tasks', async () => {
      prisma.product.findUnique = vi.fn().mockResolvedValue({
        id: 1,
        name: 'Szafka',
        parts: [
          { id: 10, name: 'Bok', length: 720, width: 560, quantity: 2, materialId: 5 },
        ],
      });
      const expectedOrder = {
        id: 1,
        productId: 1,
        quantity: 1,
        color: Color.SONOMA,
        tasks: [{ id: 101, partDefId: 10, quantity: 2 }],
      };
      prisma.productionOrder.create = vi.fn().mockResolvedValue(expectedOrder);

      const result = await service.create({
        productId: 1,
        quantity: 1,
        color: Color.SONOMA,
      });
      expect(result).toEqual(expectedOrder);
    });
  });

  describe('updateStatus - status PACKED dla całego zlecenia', () => {
    it('wymaga zalogowania (UnauthorizedException)', async () => {
      await expect(
        service.updateStatus(1, OrderStatus.PACKED, undefined),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('rzuca NotFoundException gdy zlecenie nie istnieje', async () => {
      prisma.productionOrder.findUnique = vi.fn().mockResolvedValue(null);

      await expect(
        service.updateStatus(999, OrderStatus.PACKED, packer),
      ).rejects.toThrow(NotFoundException);
    });

    it('PACKER może oznaczyć zlecenie jako PACKED gdy wszystkie części są DRILLED', async () => {
      prisma.productionOrder.findUnique = vi.fn().mockResolvedValue({
        id: 1,
        tasks: [
          { id: 101, status: TaskStatus.DRILLED },
          { id: 102, status: TaskStatus.DRILLED },
        ],
      });
      prisma.productionTask.updateMany = vi.fn().mockResolvedValue({ count: 2 });
      prisma.productionOrder.update = vi.fn().mockResolvedValue({
        id: 1,
        status: OrderStatus.PACKED,
      });

      const result = await service.updateStatus(1, OrderStatus.PACKED, packer);

      expect(result.status).toBe(OrderStatus.PACKED);
      expect(prisma.productionTask.updateMany).toHaveBeenCalledWith({
        where: { orderId: 1 },
        data: { status: TaskStatus.COMPLETED },
      });
      expect(prisma.productionOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 1 },
          data: { status: OrderStatus.PACKED },
        }),
      );
    });

    it('PACKER NIE MOŻE oznaczyć jako PACKED gdy części są tylko CUT a nie DRILLED', async () => {
      prisma.productionOrder.findUnique = vi.fn().mockResolvedValue({
        id: 1,
        tasks: [
          { id: 101, status: TaskStatus.CUT },
          { id: 102, status: TaskStatus.CUT },
        ],
      });

      await expect(
        service.updateStatus(1, OrderStatus.PACKED, packer),
      ).rejects.toThrow(BadRequestException);
    });

    it('PACKER NIE MOŻE oznaczyć jako PACKED gdy chociaż jedna część jest PENDING', async () => {
      prisma.productionOrder.findUnique = vi.fn().mockResolvedValue({
        id: 1,
        tasks: [
          { id: 101, status: TaskStatus.DRILLED },
          { id: 102, status: TaskStatus.PENDING },
        ],
      });

      await expect(
        service.updateStatus(1, OrderStatus.PACKED, packer),
      ).rejects.toThrow(BadRequestException);
    });

    it('PACKER NIE MOŻE oznaczyć jako PACKED gdy części są tylko EDGED a nie DRILLED', async () => {
      prisma.productionOrder.findUnique = vi.fn().mockResolvedValue({
        id: 1,
        tasks: [
          { id: 101, status: TaskStatus.EDGED },
          { id: 102, status: TaskStatus.EDGED },
        ],
      });

      await expect(
        service.updateStatus(1, OrderStatus.PACKED, packer),
      ).rejects.toThrow(BadRequestException);
    });

    it('SAW_OPERATOR NIE MOŻE oznaczyć zlecenia jako PACKED (ForbiddenException)', async () => {
      prisma.productionOrder.findUnique = vi.fn().mockResolvedValue({
        id: 1,
        tasks: [{ id: 101, status: TaskStatus.DRILLED }],
      });

      await expect(
        service.updateStatus(1, OrderStatus.PACKED, sawOperator),
      ).rejects.toThrow(ForbiddenException);
    });

    it('ADMIN może oznaczyć zlecenie jako PACKED gdy części są DRILLED', async () => {
      prisma.productionOrder.findUnique = vi.fn().mockResolvedValue({
        id: 1,
        tasks: [{ id: 101, status: TaskStatus.DRILLED }],
      });
      prisma.productionTask.updateMany = vi.fn().mockResolvedValue({ count: 1 });
      prisma.productionOrder.update = vi.fn().mockResolvedValue({
        id: 1,
        status: OrderStatus.PACKED,
      });

      const result = await service.updateStatus(1, OrderStatus.PACKED, admin);
      expect(result.status).toBe(OrderStatus.PACKED);
    });
  });

  describe('getCuttingList', () => {
    it('zwraca pogrupowaną listę rozkroju dla zlecenia', async () => {
      prisma.productionOrder.findUnique = vi.fn().mockResolvedValue({ id: 1 });
      prisma.productionTask.findMany = vi.fn().mockResolvedValue([
        {
          id: 1,
          quantity: 2,
          status: TaskStatus.PENDING,
          barcode: 'B1',
          partDefinition: {
            id: 1,
            name: 'Część 1',
            length: 500,
            width: 300,
            thickness: 18,
            material: { id: 1, name: 'Dąb', color: Color.SONOMA, thickness: 18 },
          },
        },
      ]);

      const result = await service.getCuttingList(1);
      expect(result).toHaveLength(1);
      expect(result[0].totalQuantity).toBe(2);
      expect(result[0].dimensions.formatted).toBe('500 x 300 x 18 mm');
    });

    it('rzuca NotFoundException gdy zlecenie nie istnieje', async () => {
      prisma.productionOrder.findUnique = vi.fn().mockResolvedValue(null);

      await expect(service.getCuttingList(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('getEdgeBandingSummary', () => {
    it('zwraca podsumowanie okleinowania dla zlecenia', async () => {
      prisma.productionOrder.findUnique = vi.fn().mockResolvedValue({
        id: 1,
        quantity: 2,
        color: Color.SONOMA,
        product: { name: 'Szafka' },
        tasks: [
          {
            id: 1,
            quantity: 4,
            status: TaskStatus.PENDING,
            barcode: 'B1',
            partDefinition: {
              id: 10,
              name: 'Bok',
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

      const res = await service.getEdgeBandingSummary(1);
      expect(res.orderId).toBe(1);
      expect(res.totalMeters).toBe(4.92);
      expect(res.tapeBreakdown).toHaveLength(1);
      expect(res.tapeBreakdown[0].tapeType).toBe('ABS');
      expect(res.tapeBreakdown[0].totalPieces).toBe(4);
    });

    it('rzuca NotFoundException gdy zlecenie nie istnieje', async () => {
      prisma.productionOrder.findUnique = vi.fn().mockResolvedValue(null);

      await expect(service.getEdgeBandingSummary(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('consumeSheets (ręczne wpisanie zużycia arkuszy płyty dla zlecenia)', () => {
    it('SAW_OPERATOR może wpisać zużycie arkuszy płyty, co aktualizuje order.sheetsUsed i magazyn', async () => {
      prisma.productionOrder.findUnique = vi.fn().mockResolvedValue({
        id: 1,
        tasks: [
          {
            id: 10,
            partDefinition: {
              materialId: 5,
            },
          },
        ],
      });
      prisma.material.findUnique = vi.fn().mockResolvedValue({
        id: 5,
        name: 'Płyta laminowana Dąb Sonoma 18mm',
        length: 2800,
        width: 2070,
        thickness: 18,
        stockQuantity: 20,
        stockArea: 115.92,
      });
      prisma.material.update = vi.fn().mockResolvedValue({
        id: 5,
        name: 'Płyta laminowana Dąb Sonoma 18mm',
        stockQuantity: 17,
        stockArea: 98.53,
      });
      prisma.productionOrder.update = vi.fn().mockResolvedValue({
        id: 1,
        sheetsUsed: 3,
      });

      const res = await service.consumeSheets(1, 3, undefined, sawOperator);

      expect(res.orderId).toBe(1);
      expect(res.materialId).toBe(5);
      expect(res.sheetsConsumed).toBe(3);
      expect(res.orderSheetsUsed).toBe(3);
      expect(res.materialRemainingStock).toBe(17);
    });

    it('DRILL_OPERATOR NIE MOŻE wpisywać zużycia arkuszy płyty (403 Forbidden)', async () => {
      await expect(service.consumeSheets(1, 2, undefined, drillOperator)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('EDGE_BANDER_OPERATOR NIE MOŻE wpisywać zużycia arkuszy płyty (403 Forbidden)', async () => {
      await expect(service.consumeSheets(1, 2, undefined, edgeOperator)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('wyrzuca BadRequestException gdy sheetsCount <= 0', async () => {
      await expect(service.consumeSheets(1, 0, undefined, sawOperator)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('wyrzuca BadRequestException gdy brak wystarczającej liczby arkuszy w magazynie', async () => {
      prisma.productionOrder.findUnique = vi.fn().mockResolvedValue({
        id: 1,
        tasks: [{ partDefinition: { materialId: 5 } }],
      });
      prisma.material.findUnique = vi.fn().mockResolvedValue({
        id: 5,
        name: 'Płyta Sonoma',
        stockQuantity: 2,
      });

      await expect(service.consumeSheets(1, 5, undefined, sawOperator)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('deductOrderEdgeTape (odliczenie okleiny ze stanu magazynowego)', () => {
    it('EDGE_BANDER_OPERATOR może ręcznie odliczyć okleinę dla zlecenia', async () => {
      prisma.productionOrder.findUnique = vi.fn().mockResolvedValue({
        id: 1,
        quantity: 2,
        color: Color.SONOMA,
        edgeTapeDeducted: false,
        tasks: [
          {
            id: 101,
            quantity: 2,
            status: TaskStatus.EDGED,
            partDefinition: {
              id: 1,
              name: 'Bok',
              length: 1000,
              width: 500,
              thickness: 18,
              edgeLength1: true,
              edgeTapeType: 'ABS',
              edgeTapeColor: Color.SONOMA,
              edgeTapeThickness: 1.0,
            },
          },
        ],
      });

      prisma.edgeTape.findMany = vi.fn().mockResolvedValue([
        {
          id: 1,
          name: 'Okleina ABS Sonoma',
          type: 'ABS',
          color: Color.SONOMA,
          thickness: 1.0,
          stockMeters: 50,
        },
      ]);
      prisma.edgeTape.findFirst = vi.fn().mockResolvedValue({
        id: 1,
        name: 'Okleina ABS Sonoma',
        type: 'ABS',
        color: Color.SONOMA,
        thickness: 1.0,
        stockMeters: 50,
      });
      prisma.edgeTape.update = vi.fn().mockResolvedValue({
        id: 1,
        stockMeters: 48,
      });
      prisma.productionOrder.update = vi.fn().mockResolvedValue({
        id: 1,
        edgeTapeDeducted: true,
      });

      const res = await service.deductOrderEdgeTape(1, edgeOperator);

      expect(res.orderId).toBe(1);
      expect(res.edgeTapeDeducted).toBe(true);
      expect(res.deductions).toHaveLength(1);
      expect(res.deductions[0].deductedMeters).toBe(2);
      expect(prisma.edgeTape.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { stockMeters: 48 },
      });
      expect(prisma.productionOrder.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { edgeTapeDeducted: true },
      });
    });

    it('nie odejmuje ponownie jeśli zlecenie ma już edgeTapeDeducted = true', async () => {
      prisma.productionOrder.findUnique = vi.fn().mockResolvedValue({
        id: 1,
        edgeTapeDeducted: true,
        tasks: [],
      });

      const res = await service.deductOrderEdgeTape(1, edgeOperator);

      expect(res.edgeTapeDeducted).toBe(true);
      expect(res.deductions).toHaveLength(0);
      expect(res.message).toContain('została już wcześniej odliczona');
    });

    it('SAW_OPERATOR NIE MOŻE ręcznie odliczać okleiny (403 Forbidden)', async () => {
      await expect(service.deductOrderEdgeTape(1, sawOperator)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('checkEdgeTapeAvailability', () => {
    it('zwraca poprawny stan magazynowy i flagę dostępności', async () => {
      prisma.productionOrder.findUnique = vi.fn().mockResolvedValue({
        id: 1,
        quantity: 1,
        color: Color.SONOMA,
        edgeTapeDeducted: false,
        tasks: [
          {
            id: 101,
            quantity: 1,
            status: TaskStatus.PENDING,
            partDefinition: {
              id: 1,
              name: 'Półka',
              length: 500,
              width: 300,
              edgeLength1: true,
              edgeTapeType: 'Melamina',
              edgeTapeColor: Color.SONOMA,
              edgeTapeThickness: 0.8,
            },
          },
        ],
      });

      prisma.edgeTape.findMany = vi.fn().mockResolvedValue([
        {
          id: 2,
          name: 'Melamina Sonoma',
          type: 'Melamina',
          color: Color.SONOMA,
          thickness: 0.8,
          stockMeters: 10,
        },
      ]);

      const res = await service.checkEdgeTapeAvailability(1);

      expect(res.orderId).toBe(1);
      expect(res.isStockSufficient).toBe(true);
      expect(res.tapeBreakdown[0].availableStockMeters).toBe(10);
      expect(res.tapeBreakdown[0].isSufficient).toBe(true);
      expect(res.tapeBreakdown[0].missingMeters).toBe(0);
    });
  });
});
