import { Test, TestingModule } from '@nestjs/testing';
import { TasksService } from './tasks.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { TaskStatus, OrderStatus, Role } from '@prisma/client';
import {
  ForbiddenException,
  BadRequestException,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface.js';

describe('TasksService', () => {
  let service: TasksService;
  let prisma: {
    productionTask: {
      findMany: any;
      findUnique: any;
      update: any;
    };
    productionOrder: {
      update: any;
    };
  };

  const sawOperator: AuthenticatedUser = {
    id: 10,
    username: 'pilarz',
    name: 'Jan Pilarz',
    role: Role.SAW_OPERATOR,
  };

  const drillOperator: AuthenticatedUser = {
    id: 20,
    username: 'wiertacz',
    name: 'Piotr Wiertacz',
    role: Role.DRILL_OPERATOR,
  };

  const packer: AuthenticatedUser = {
    id: 30,
    username: 'pakowacz',
    name: 'Adam Pakowacz',
    role: Role.PACKER,
  };

  const admin: AuthenticatedUser = {
    id: 99,
    username: 'szef',
    name: 'Kierownik Produkcji',
    role: Role.ADMIN,
  };

  beforeEach(async () => {
    prisma = {
      productionTask: {
        findMany: vitest.fn(),
        findUnique: vitest.fn(),
        update: vitest.fn(),
      },
      productionOrder: {
        update: vitest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TasksService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<TasksService>(TasksService);
  });

  it('powinien być zdefiniowany', () => {
    expect(service).toBeDefined();
  });

  describe('updateStatus - uprawnienia i reguły ról', () => {
    it('wymaga zalogowanego użytkownika (UnauthorizedException)', async () => {
      await expect(
        service.updateStatus(1, TaskStatus.CUT, undefined),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('rzuca NotFoundException gdy zadanie nie istnieje', async () => {
      prisma.productionTask.findUnique.mockResolvedValue(null);

      await expect(
        service.updateStatus(999, TaskStatus.CUT, sawOperator),
      ).rejects.toThrow(NotFoundException);
    });

    describe('SAW_OPERATOR', () => {
      it('może oznaczyć formatkę ze statusem PENDING jako CUT', async () => {
        prisma.productionTask.findUnique.mockResolvedValue({
          id: 1,
          status: TaskStatus.PENDING,
          orderId: 100,
        });
        prisma.productionTask.update.mockResolvedValue({
          id: 1,
          status: TaskStatus.CUT,
          orderId: 100,
        });
        prisma.productionTask.findMany.mockResolvedValue([
          { id: 1, status: TaskStatus.CUT, orderId: 100 },
          { id: 2, status: TaskStatus.PENDING, orderId: 100 },
        ]);

        const result = await service.updateStatus(1, TaskStatus.CUT, sawOperator);

        expect(result.status).toBe(TaskStatus.CUT);
        expect(prisma.productionOrder.update).toHaveBeenCalledWith({
          where: { id: 100 },
          data: { status: OrderStatus.IN_PROGRESS },
        });
      });

      it('NIE może oznaczyć jako DRILLED (ForbiddenException)', async () => {
        prisma.productionTask.findUnique.mockResolvedValue({
          id: 1,
          status: TaskStatus.CUT,
          orderId: 100,
        });

        await expect(
          service.updateStatus(1, TaskStatus.DRILLED, sawOperator),
        ).rejects.toThrow(ForbiddenException);
      });

      it('NIE może oznaczyć jako COMPLETED (ForbiddenException)', async () => {
        prisma.productionTask.findUnique.mockResolvedValue({
          id: 1,
          status: TaskStatus.CUT,
          orderId: 100,
        });

        await expect(
          service.updateStatus(1, TaskStatus.COMPLETED, sawOperator),
        ).rejects.toThrow(ForbiddenException);
      });
    });

    describe('DRILL_OPERATOR', () => {
      it('może oznaczyć wyciętą formatkę (CUT) jako DRILLED', async () => {
        prisma.productionTask.findUnique.mockResolvedValue({
          id: 1,
          status: TaskStatus.CUT,
          orderId: 100,
        });
        prisma.productionTask.update.mockResolvedValue({
          id: 1,
          status: TaskStatus.DRILLED,
          orderId: 100,
        });
        prisma.productionTask.findMany.mockResolvedValue([
          { id: 1, status: TaskStatus.DRILLED, orderId: 100 },
        ]);

        const result = await service.updateStatus(1, TaskStatus.DRILLED, drillOperator);

        expect(result.status).toBe(TaskStatus.DRILLED);
        expect(prisma.productionTask.update).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { id: 1 },
            data: { status: TaskStatus.DRILLED },
          }),
        );
      });

      it('NIE może oznaczyć niewyciętej formatki (PENDING) jako DRILLED (BadRequestException)', async () => {
        prisma.productionTask.findUnique.mockResolvedValue({
          id: 1,
          status: TaskStatus.PENDING,
          orderId: 100,
        });

        await expect(
          service.updateStatus(1, TaskStatus.DRILLED, drillOperator),
        ).rejects.toThrow(BadRequestException);
      });

      it('NIE może oznaczyć formatki jako CUT (ForbiddenException)', async () => {
        prisma.productionTask.findUnique.mockResolvedValue({
          id: 1,
          status: TaskStatus.PENDING,
          orderId: 100,
        });

        await expect(
          service.updateStatus(1, TaskStatus.CUT, drillOperator),
        ).rejects.toThrow(ForbiddenException);
      });

      it('NIE może oznaczyć formatki jako COMPLETED (ForbiddenException)', async () => {
        prisma.productionTask.findUnique.mockResolvedValue({
          id: 1,
          status: TaskStatus.DRILLED,
          orderId: 100,
        });

        await expect(
          service.updateStatus(1, TaskStatus.COMPLETED, drillOperator),
        ).rejects.toThrow(ForbiddenException);
      });
    });

    describe('PACKER', () => {
      it('może oznaczyć nawierconą formatkę (DRILLED) jako COMPLETED', async () => {
        prisma.productionTask.findUnique.mockResolvedValue({
          id: 1,
          status: TaskStatus.DRILLED,
          orderId: 100,
        });
        prisma.productionTask.update.mockResolvedValue({
          id: 1,
          status: TaskStatus.COMPLETED,
          orderId: 100,
        });
        prisma.productionTask.findMany.mockResolvedValue([
          { id: 1, status: TaskStatus.COMPLETED, orderId: 100 },
        ]);

        const result = await service.updateStatus(1, TaskStatus.COMPLETED, packer);

        expect(result.status).toBe(TaskStatus.COMPLETED);
        // Gdy wszystkie zadania są COMPLETED, zamówienie staje się COMPLETED
        expect(prisma.productionOrder.update).toHaveBeenCalledWith({
          where: { id: 100 },
          data: { status: OrderStatus.COMPLETED },
        });
      });

      it('NIE może oznaczyć formatki ze statusem CUT jako COMPLETED (BadRequestException)', async () => {
        prisma.productionTask.findUnique.mockResolvedValue({
          id: 1,
          status: TaskStatus.CUT,
          orderId: 100,
        });

        await expect(
          service.updateStatus(1, TaskStatus.COMPLETED, packer),
        ).rejects.toThrow(BadRequestException);
      });

      it('NIE może oznaczyć jako CUT ani DRILLED (ForbiddenException)', async () => {
        prisma.productionTask.findUnique.mockResolvedValue({
          id: 1,
          status: TaskStatus.PENDING,
          orderId: 100,
        });

        await expect(
          service.updateStatus(1, TaskStatus.CUT, packer),
        ).rejects.toThrow(ForbiddenException);

        await expect(
          service.updateStatus(1, TaskStatus.DRILLED, packer),
        ).rejects.toThrow(ForbiddenException);
      });
    });

    describe('ADMIN - pełne uprawnienia', () => {
      it('może zmienić status na dowolny: CUT', async () => {
        prisma.productionTask.findUnique.mockResolvedValue({
          id: 1,
          status: TaskStatus.PENDING,
          orderId: 100,
        });
        prisma.productionTask.update.mockResolvedValue({
          id: 1,
          status: TaskStatus.CUT,
        });
        prisma.productionTask.findMany.mockResolvedValue([
          { id: 1, status: TaskStatus.CUT },
        ]);

        const res = await service.updateStatus(1, TaskStatus.CUT, admin);
        expect(res.status).toBe(TaskStatus.CUT);
      });

      it('może zmienić status na DRILLED (nawet pomijając restrykcje sekwencji)', async () => {
        prisma.productionTask.findUnique.mockResolvedValue({
          id: 1,
          status: TaskStatus.PENDING,
          orderId: 100,
        });
        prisma.productionTask.update.mockResolvedValue({
          id: 1,
          status: TaskStatus.DRILLED,
        });
        prisma.productionTask.findMany.mockResolvedValue([
          { id: 1, status: TaskStatus.DRILLED },
        ]);

        const res = await service.updateStatus(1, TaskStatus.DRILLED, admin);
        expect(res.status).toBe(TaskStatus.DRILLED);
      });

      it('może zresetować status do PENDING', async () => {
        prisma.productionTask.findUnique.mockResolvedValue({
          id: 1,
          status: TaskStatus.CUT,
          orderId: 100,
        });
        prisma.productionTask.update.mockResolvedValue({
          id: 1,
          status: TaskStatus.PENDING,
        });
        prisma.productionTask.findMany.mockResolvedValue([
          { id: 1, status: TaskStatus.PENDING },
        ]);

        const res = await service.updateStatus(1, TaskStatus.PENDING, admin);
        expect(res.status).toBe(TaskStatus.PENDING);
        expect(prisma.productionOrder.update).toHaveBeenCalledWith({
          where: { id: 100 },
          data: { status: OrderStatus.PENDING },
        });
      });
    });
  });

  describe('findByOrderId oraz findByBarcode', () => {
    it('pobiera elementy dla konkretnego zamówienia', async () => {
      const mockTasks = [
        { id: 1, orderId: 5, partDefId: 1 },
        { id: 2, orderId: 5, partDefId: 2 },
      ];
      prisma.productionTask.findMany.mockResolvedValue(mockTasks);

      const result = await service.findByOrderId(5);
      expect(result).toEqual(mockTasks);
      expect(prisma.productionTask.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { orderId: 5 },
        }),
      );
    });

    it('pobiera zadanie po kodzie kreskowym', async () => {
      const mockTask = { id: 1, barcode: 'ORD-1234-PART-1' };
      prisma.productionTask.findUnique.mockResolvedValue(mockTask);

      const result = await service.findByBarcode('ORD-1234-PART-1');
      expect(result).toEqual(mockTask);
    });

    it('rzuca NotFoundException gdy kod kreskowy nie istnieje', async () => {
      prisma.productionTask.findUnique.mockResolvedValue(null);

      await expect(service.findByBarcode('NIEZNANY')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
