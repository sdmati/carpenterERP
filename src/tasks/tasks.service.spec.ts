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
      findUnique: any;
    };
    edgeTape: {
      findFirst: any;
      update: any;
    };
  };

  const sawOperator: AuthenticatedUser = {
    id: 10,
    username: 'pilarz',
    name: 'Jan Pilarz',
    role: Role.SAW_OPERATOR,
  };

  const edgeOperator: AuthenticatedUser = {
    id: 15,
    username: 'okleiniarz',
    name: 'Marek Okleiniarz',
    role: Role.EDGE_BANDER_OPERATOR,
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
        findUnique: vitest.fn(),
      },
      edgeTape: {
        findFirst: vitest.fn(),
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

    describe('EDGE_BANDER_OPERATOR', () => {
      it('może oznaczyć wyciętą formatkę (CUT) jako EDGED', async () => {
        prisma.productionTask.findUnique.mockResolvedValue({
          id: 1,
          status: TaskStatus.CUT,
          orderId: 100,
          partDefinition: {
            edgeLength1: true,
            length: 720,
            width: 510,
          },
        });
        prisma.productionTask.update.mockResolvedValue({
          id: 1,
          status: TaskStatus.EDGED,
          orderId: 100,
        });
        prisma.productionTask.findMany.mockResolvedValue([
          { id: 1, status: TaskStatus.EDGED, orderId: 100 },
        ]);

        const result = await service.updateStatus(1, TaskStatus.EDGED, edgeOperator);
        expect(result.status).toBe(TaskStatus.EDGED);
      });

      it('NIE może oznaczyć formatki o statusie PENDING jako EDGED (BadRequestException)', async () => {
        prisma.productionTask.findUnique.mockResolvedValue({
          id: 1,
          status: TaskStatus.PENDING,
          orderId: 100,
        });

        await expect(
          service.updateStatus(1, TaskStatus.EDGED, edgeOperator),
        ).rejects.toThrow(BadRequestException);
      });

      it('NIE może cofnąć formatki z DRILLED do EDGED (BadRequestException)', async () => {
        prisma.productionTask.findUnique.mockResolvedValue({
          id: 1,
          status: TaskStatus.DRILLED,
          orderId: 100,
        });

        await expect(
          service.updateStatus(1, TaskStatus.EDGED, edgeOperator),
        ).rejects.toThrow(BadRequestException);
      });

      it('NIE może oznaczyć jako CUT (ForbiddenException)', async () => {
        prisma.productionTask.findUnique.mockResolvedValue({
          id: 1,
          status: TaskStatus.PENDING,
          orderId: 100,
        });

        await expect(
          service.updateStatus(1, TaskStatus.CUT, edgeOperator),
        ).rejects.toThrow(ForbiddenException);
      });

      it('NIE może oznaczyć jako DRILLED (ForbiddenException)', async () => {
        prisma.productionTask.findUnique.mockResolvedValue({
          id: 1,
          status: TaskStatus.EDGED,
          orderId: 100,
        });

        await expect(
          service.updateStatus(1, TaskStatus.DRILLED, edgeOperator),
        ).rejects.toThrow(ForbiddenException);
      });
    });

    describe('DRILL_OPERATOR', () => {
      it('może oznaczyć wyciętą formatkę (CUT) jako DRILLED gdy formatka nie wymaga oklejenia', async () => {
        prisma.productionTask.findUnique.mockResolvedValue({
          id: 1,
          status: TaskStatus.CUT,
          orderId: 100,
          partDefinition: {
            edgeLength1: false,
            edgeLength2: false,
            edgeWidth1: false,
            edgeWidth2: false,
          },
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

      it('może oznaczyć formatkę jako DRILLED gdy jest już EDGED dla części wymagającej oklejenia', async () => {
        prisma.productionTask.findUnique.mockResolvedValue({
          id: 1,
          status: TaskStatus.EDGED,
          orderId: 100,
          partDefinition: {
            edgeLength1: true,
            length: 720,
            width: 510,
          },
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
      });

      it('NIE może oznaczyć formatki (CUT) jako DRILLED jeśli część wymaga oklejenia (BadRequestException)', async () => {
        prisma.productionTask.findUnique.mockResolvedValue({
          id: 1,
          status: TaskStatus.CUT,
          orderId: 100,
          partDefinition: {
            edgeLength1: true,
            length: 720,
            width: 510,
          },
        });

        await expect(
          service.updateStatus(1, TaskStatus.DRILLED, drillOperator),
        ).rejects.toThrow(BadRequestException);
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

  describe('getCuttingList i cutDimensionGroup', () => {
    it('getCuttingList zwraca pogrupowaną listę rozkroju', async () => {
      const mockTasks = [
        {
          id: 1,
          quantity: 3,
          status: TaskStatus.PENDING,
          barcode: 'B1',
          partDefinition: {
            id: 10,
            name: 'Bok lewy',
            length: 720,
            width: 510,
            thickness: 18,
            material: { id: 1, name: 'Sonoma', color: 'SONOMA', thickness: 18 },
          },
        },
        {
          id: 2,
          quantity: 3,
          status: TaskStatus.PENDING,
          barcode: 'B2',
          partDefinition: {
            id: 11,
            name: 'Bok prawy',
            length: 720,
            width: 510,
            thickness: 18,
            material: { id: 1, name: 'Sonoma', color: 'SONOMA', thickness: 18 },
          },
        },
      ];
      prisma.productionTask.findMany.mockResolvedValue(mockTasks);

      const list = await service.getCuttingList(1);
      expect(list).toHaveLength(1);
      expect(list[0].dimensions.formatted).toBe('720 x 510 x 18 mm');
      expect(list[0].totalQuantity).toBe(6);
      expect(list[0].parts).toHaveLength(2);
    });

    it('cutDimensionGroup oznacza wszystkie pasujące formatki w zleceniu jako CUT dla SAW_OPERATOR', async () => {
      const mockPendingTasks = [
        {
          id: 1,
          quantity: 5,
          status: TaskStatus.PENDING,
          orderId: 10,
          partDefinition: { id: 10, length: 720, width: 510, materialId: 1 },
        },
        {
          id: 2,
          quantity: 5,
          status: TaskStatus.PENDING,
          orderId: 10,
          partDefinition: { id: 11, length: 720, width: 510, materialId: 1 },
        },
      ];

      prisma.productionTask.findMany.mockResolvedValue(mockPendingTasks);

      prisma.productionTask.findUnique
        .mockResolvedValueOnce({ id: 1, status: TaskStatus.PENDING, orderId: 10 })
        .mockResolvedValueOnce({ id: 2, status: TaskStatus.PENDING, orderId: 10 });

      prisma.productionTask.update
        .mockResolvedValueOnce({ id: 1, status: TaskStatus.CUT })
        .mockResolvedValueOnce({ id: 2, status: TaskStatus.CUT });

      const res = await service.cutDimensionGroup(
        { orderId: 10, length: 720, width: 510, materialId: 1 },
        sawOperator,
      );

      expect(res.updatedCount).toBe(2);
      expect(res.totalCutQuantity).toBe(10);
    });

    it('cutDimensionGroup rzuca ForbiddenException dla DRILL_OPERATOR', async () => {
      await expect(
        service.cutDimensionGroup(
          { orderId: 10, length: 720, width: 510 },
          drillOperator,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('cutDimensionGroup rzuca NotFoundException gdy brak formatek o tych wymiarach', async () => {
      prisma.productionTask.findMany.mockResolvedValue([]);

      await expect(
        service.cutDimensionGroup(
          { orderId: 10, length: 999, width: 999 },
          sawOperator,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getEdgeBandingList i getTaskEdgeBanding', () => {
    it('getEdgeBandingList zwraca listę z wyliczonymi metrami okleiny', async () => {
      prisma.productionTask.findMany.mockResolvedValue([
        {
          id: 1,
          quantity: 5,
          status: TaskStatus.PENDING,
          barcode: 'BAR-1',
          partDefId: 10,
          partDefinition: {
            id: 10,
            name: 'Bok lewy',
            length: 720,
            width: 510,
            thickness: 18,
            edgeLength1: true,
            edgeLength2: false,
            edgeWidth1: true,
            edgeWidth2: false,
            edgeTapeType: 'ABS',
            edgeTapeColor: 'SONOMA',
            edgeTapeThickness: 1.0,
          },
        },
      ]);

      const res = await service.getEdgeBandingList(1);
      expect(res).toHaveLength(1);
      expect(res[0].taskId).toBe(1);
      expect(res[0].metersPerPiece).toBe(1.23);
      expect(res[0].totalMeters).toBe(6.15);
    });

    it('getTaskEdgeBanding zwraca wyliczenia dla pojedynczej partii', async () => {
      prisma.productionTask.findUnique.mockResolvedValue({
        id: 1,
        quantity: 2,
        status: TaskStatus.PENDING,
        barcode: 'BAR-1',
        partDefId: 10,
        partDefinition: {
          id: 10,
          name: 'Półka',
          length: 564,
          width: 490,
          thickness: 18,
          edgeLength1: true,
          edgeLength2: false,
          edgeWidth1: false,
          edgeWidth2: false,
        },
      });

      const res = await service.getTaskEdgeBanding(1);
      expect(res.taskId).toBe(1);
      expect(res.metersPerPiece).toBe(0.564);
      expect(res.totalMeters).toBe(1.13);
    });

    it('getTaskEdgeBanding rzuca NotFoundException gdy zadanie nie istnieje', async () => {
      prisma.productionTask.findUnique.mockResolvedValue(null);

      await expect(service.getTaskEdgeBanding(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('getDrillingList i getOrderDrillingSummary', () => {
    const mockTasks = [
      {
        id: 1,
        quantity: 2,
        status: TaskStatus.EDGED,
        barcode: 'BAR-1',
        orderId: 10,
        order: { product: { name: 'Szafa' } },
        partDefinition: {
          id: 10,
          name: 'Bok lewy',
          length: 720,
          width: 510,
          thickness: 18,
          drillingPattern: 'CONFIRMAT_32MM',
          edgeLength1: true,
          edgeLength2: false,
          edgeWidth1: false,
          edgeWidth2: false,
          material: { name: 'Dąb' },
        },
      },
      {
        id: 2,
        quantity: 2,
        status: TaskStatus.PENDING,
        barcode: 'BAR-2',
        orderId: 10,
        order: { product: { name: 'Szafa' } },
        partDefinition: {
          id: 11,
          name: 'Półka',
          length: 500,
          width: 400,
          thickness: 18,
          drillingPattern: 'SHELF_PIN_5MM',
          edgeLength1: false,
          edgeLength2: false,
          edgeWidth1: false,
          edgeWidth2: false,
          material: { name: 'Dąb' },
        },
      },
    ];

    it('getDrillingList zwraca listę partii do nawiercenia', async () => {
      prisma.productionTask.findMany.mockResolvedValue(mockTasks);

      const list = await service.getDrillingList(10);
      expect(list).toHaveLength(2);
      expect(list[0].isReadyToDrill).toBe(true);
      expect(list[1].isReadyToDrill).toBe(false);
    });

    it('getDrillingList z readyOnly=true filtruje tylko gotowe do wiercenia', async () => {
      prisma.productionTask.findMany.mockResolvedValue(mockTasks);

      const list = await service.getDrillingList(10, true);
      expect(list).toHaveLength(1);
      expect(list[0].taskId).toBe(1);
    });

    it('getOrderDrillingSummary zwraca podsumowanie dla zlecenia', async () => {
      prisma.productionOrder.findUnique.mockResolvedValue({
        id: 10,
        product: { name: 'Szafa' },
        tasks: mockTasks,
      });

      const summary = await service.getOrderDrillingSummary(10);
      expect(summary.orderId).toBe(10);
      expect(summary.totalTasksCount).toBe(2);
      expect(summary.readyTasksCount).toBe(1);
      expect(summary.drilledTasksCount).toBe(0);
    });

    it('getOrderDrillingSummary rzuca NotFoundException gdy zlecenie nie istnieje', async () => {
      prisma.productionOrder.findUnique.mockResolvedValue(null);

      await expect(service.getOrderDrillingSummary(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('getPackingList i getOrderPackingSummary', () => {
    const mockTasks = [
      {
        id: 1,
        quantity: 2,
        status: TaskStatus.DRILLED,
        barcode: 'BAR-1',
        orderId: 10,
        order: { product: { name: 'Szafa' } },
        partDefinition: {
          id: 10,
          name: 'Bok lewy',
          length: 720,
          width: 510,
          thickness: 18,
        },
      },
      {
        id: 2,
        quantity: 2,
        status: TaskStatus.CUT,
        barcode: 'BAR-2',
        orderId: 10,
        order: { product: { name: 'Szafa' } },
        partDefinition: {
          id: 11,
          name: 'Półka',
          length: 500,
          width: 400,
          thickness: 18,
        },
      },
    ];

    it('getPackingList zwraca listę partii pod kątem pakowania', async () => {
      prisma.productionTask.findMany.mockResolvedValue(mockTasks);

      const list = await service.getPackingList(10);
      expect(list).toHaveLength(2);
      expect(list[0].isReadyToPack).toBe(true);
      expect(list[1].isReadyToPack).toBe(false);
    });

    it('getPackingList z readyOnly=true filtruje tylko gotowe do pakowania (DRILLED)', async () => {
      prisma.productionTask.findMany.mockResolvedValue(mockTasks);

      const list = await service.getPackingList(10, true);
      expect(list).toHaveLength(1);
      expect(list[0].taskId).toBe(1);
    });

    it('getOrderPackingSummary zwraca statystyki pakowania', async () => {
      prisma.productionOrder.findUnique.mockResolvedValue({
        id: 10,
        product: { name: 'Szafa' },
        tasks: mockTasks,
      });

      const summary = await service.getOrderPackingSummary(10);
      expect(summary.orderId).toBe(10);
      expect(summary.totalTasksCount).toBe(2);
      expect(summary.readyTasksCount).toBe(1);
      expect(summary.packedTasksCount).toBe(0);
    });

    it('getOrderPackingSummary rzuca NotFoundException gdy zlecenie nie istnieje', async () => {
      prisma.productionOrder.findUnique.mockResolvedValue(null);

      await expect(service.getOrderPackingSummary(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('edgeBatch', () => {
    it('rzuca UnauthorizedException gdy brak zalogowanego użytkownika', async () => {
      await expect(service.edgeBatch({ orderId: 10 }, undefined)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('rzuca ForbiddenException dla roli SAW_OPERATOR', async () => {
      await expect(service.edgeBatch({ orderId: 10 }, sawOperator)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('rzuca BadRequestException gdy brak orderId oraz taskIds', async () => {
      await expect(service.edgeBatch({}, edgeOperator)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rzuca NotFoundException gdy nie znaleziono żadnych partii', async () => {
      prisma.productionTask.findMany.mockResolvedValue([]);

      await expect(service.edgeBatch({ orderId: 999 }, edgeOperator)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('oznacza kwalifikujące się formatki (CUT i wymagające oklejenia) jako EDGED', async () => {
      const task = {
        id: 1,
        status: TaskStatus.CUT,
        orderId: 10,
        quantity: 4,
        partDefinition: {
          edgeLength1: true,
          length: 720,
          width: 510,
        },
      };

      prisma.productionTask.findMany
        .mockResolvedValueOnce([task]) // findMany in edgeBatch
        .mockResolvedValueOnce([{ id: 1, status: TaskStatus.EDGED, orderId: 10 }]); // findMany in updateStatus order check

      prisma.productionTask.findUnique.mockResolvedValue(task);
      prisma.productionTask.update.mockResolvedValue({ ...task, status: TaskStatus.EDGED });

      const result = await service.edgeBatch({ orderId: 10 }, edgeOperator);
      expect(result.updatedCount).toBe(1);
      expect(result.totalQuantity).toBe(4);
      expect(result.tasks[0].status).toBe(TaskStatus.EDGED);
    });
  });

  describe('drillBatch', () => {
    it('rzuca ForbiddenException dla roli SAW_OPERATOR', async () => {
      await expect(service.drillBatch({ orderId: 10 }, sawOperator)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('oznacza gotowe formatki jako DRILLED dla DRILL_OPERATOR', async () => {
      const task = {
        id: 2,
        status: TaskStatus.EDGED,
        orderId: 10,
        quantity: 3,
        partDefinition: {
          edgeLength1: true,
          length: 720,
          width: 510,
        },
      };

      prisma.productionTask.findMany
        .mockResolvedValueOnce([task])
        .mockResolvedValueOnce([{ id: 2, status: TaskStatus.DRILLED, orderId: 10 }]);

      prisma.productionTask.findUnique.mockResolvedValue(task);
      prisma.productionTask.update.mockResolvedValue({ ...task, status: TaskStatus.DRILLED });

      const result = await service.drillBatch({ orderId: 10 }, drillOperator);
      expect(result.updatedCount).toBe(1);
      expect(result.totalQuantity).toBe(3);
      expect(result.tasks[0].status).toBe(TaskStatus.DRILLED);
    });
  });

  describe('packBatch', () => {
    it('rzuca ForbiddenException dla roli DRILL_OPERATOR', async () => {
      await expect(service.packBatch({ orderId: 10 }, drillOperator)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('oznacza nawiercone formatki (DRILLED) jako COMPLETED dla PACKER', async () => {
      const task = {
        id: 3,
        status: TaskStatus.DRILLED,
        orderId: 10,
        quantity: 5,
        partDefinition: {
          length: 720,
          width: 510,
        },
      };

      prisma.productionTask.findMany
        .mockResolvedValueOnce([task])
        .mockResolvedValueOnce([{ id: 3, status: TaskStatus.COMPLETED, orderId: 10 }]);

      prisma.productionTask.findUnique.mockResolvedValue(task);
      prisma.productionTask.update.mockResolvedValue({ ...task, status: TaskStatus.COMPLETED });

      const result = await service.packBatch({ orderId: 10 }, packer);
      expect(result.updatedCount).toBe(1);
      expect(result.totalQuantity).toBe(5);
      expect(result.tasks[0].status).toBe(TaskStatus.COMPLETED);
    });
  });

  describe('updateBatchStatus', () => {
    it('rzuca ForbiddenException gdy rola nie ma uprawnień do danego statusu', async () => {
      await expect(
        service.updateBatchStatus(
          { status: TaskStatus.COMPLETED, orderId: 10 },
          sawOperator,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('aktualizuje status partii dla uprawnionej roli', async () => {
      const task = {
        id: 1,
        status: TaskStatus.PENDING,
        orderId: 10,
        quantity: 2,
        partDefinition: {
          length: 720,
          width: 510,
        },
      };

      prisma.productionTask.findMany
        .mockResolvedValueOnce([task])
        .mockResolvedValueOnce([{ id: 1, status: TaskStatus.CUT, orderId: 10 }]);

      prisma.productionTask.findUnique.mockResolvedValue(task);
      prisma.productionTask.update.mockResolvedValue({ ...task, status: TaskStatus.CUT });

      const result = await service.updateBatchStatus(
        { status: TaskStatus.CUT, orderId: 10 },
        sawOperator,
      );

      expect(result.updatedCount).toBe(1);
      expect(result.totalQuantity).toBe(2);
      expect(result.tasks[0].status).toBe(TaskStatus.CUT);
    });
  });
});
