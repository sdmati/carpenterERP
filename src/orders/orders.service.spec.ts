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

  beforeEach(async () => {
    prisma = {
      product: {},
      productionOrder: {},
      productionTask: {},
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
});
