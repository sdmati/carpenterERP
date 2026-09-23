import { Test, TestingModule } from '@nestjs/testing';
import { TasksController } from './tasks.controller.js';
import { TasksService } from './tasks.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { Role, TaskStatus } from '@prisma/client';
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface.js';

describe('TasksController', () => {
  let controller: TasksController;
  let tasksService: Partial<Record<keyof TasksService, any>>;

  const mockUser: AuthenticatedUser = {
    id: 1,
    username: 'pilarz1',
    name: 'Jan Pilarz',
    role: Role.SAW_OPERATOR,
  };

  beforeEach(async () => {
    tasksService = {
      findAll: vitest.fn(),
      findOne: vitest.fn(),
      findByOrderId: vitest.fn(),
      findByBarcode: vitest.fn(),
      updateStatus: vitest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TasksController],
      providers: [
        { provide: TasksService, useValue: tasksService },
        { provide: PrismaService, useValue: {} },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<TasksController>(TasksController);
  });

  it('powinien być zdefiniowany', () => {
    expect(controller).toBeDefined();
  });

  it('updateStatus przekazuje zadanie i użytkownika do serwisu', async () => {
    tasksService.updateStatus.mockResolvedValue({ id: 1, status: TaskStatus.CUT });

    const result = await controller.updateStatus(1, { status: TaskStatus.CUT }, mockUser);

    expect(result).toEqual({ id: 1, status: TaskStatus.CUT });
    expect(tasksService.updateStatus).toHaveBeenCalledWith(1, TaskStatus.CUT, mockUser);
  });

  it('findByOrderId pobiera zadania dla zlecenia', async () => {
    tasksService.findByOrderId.mockResolvedValue([{ id: 10 }]);

    const result = await controller.findByOrderId(5);
    expect(result).toEqual([{ id: 10 }]);
    expect(tasksService.findByOrderId).toHaveBeenCalledWith(5);
  });

  it('findByBarcode pobiera zadanie po kodzie kreskowym', async () => {
    tasksService.findByBarcode.mockResolvedValue({ id: 10, barcode: 'ORD-1-PART-1' });

    const result = await controller.findByBarcode('ORD-1-PART-1');
    expect(result).toEqual({ id: 10, barcode: 'ORD-1-PART-1' });
    expect(tasksService.findByBarcode).toHaveBeenCalledWith('ORD-1-PART-1');
  });

  it('findAll filtruje po query params', async () => {
    tasksService.findAll.mockResolvedValue([{ id: 1 }]);

    const result = await controller.findAll('12', TaskStatus.CUT);
    expect(result).toEqual([{ id: 1 }]);
    expect(tasksService.findAll).toHaveBeenCalledWith(12, TaskStatus.CUT);
  });

  it('getCuttingList wywołuje tasksService.getCuttingList', async () => {
    tasksService.getCuttingList = vitest.fn().mockResolvedValue([{ groupKey: 'test' }]);

    const result = await controller.getCuttingList('5');
    expect(result).toEqual([{ groupKey: 'test' }]);
    expect(tasksService.getCuttingList).toHaveBeenCalledWith(5);
  });

  it('cutDimensionGroup przekazuje dto i użytkownika do serwisu', async () => {
    tasksService.cutDimensionGroup = vitest.fn().mockResolvedValue({ updatedCount: 2 });

    const dto = { orderId: 5, length: 720, width: 510 };
    const result = await controller.cutDimensionGroup(dto, mockUser);
    expect(result).toEqual({ updatedCount: 2 });
    expect(tasksService.cutDimensionGroup).toHaveBeenCalledWith(dto, mockUser);
  });

  it('getDrillingList przekazuje orderId i readyOnly do serwisu', async () => {
    tasksService.getDrillingList = vitest.fn().mockResolvedValue([{ taskId: 1 }]);

    const result = await controller.getDrillingList('5', 'true');
    expect(result).toEqual([{ taskId: 1 }]);
    expect(tasksService.getDrillingList).toHaveBeenCalledWith(5, true);
  });

  it('getDrillingSummary przekazuje orderId do serwisu', async () => {
    tasksService.getOrderDrillingSummary = vitest.fn().mockResolvedValue({ orderId: 5, totalParts: 10 });

    const result = await controller.getDrillingSummary(5);
    expect(result).toEqual({ orderId: 5, totalParts: 10 });
    expect(tasksService.getOrderDrillingSummary).toHaveBeenCalledWith(5);
  });

  it('drillBatch przekazuje dto i użytkownika do serwisu', async () => {
    tasksService.drillBatch = vitest.fn().mockResolvedValue({ updatedCount: 3 });

    const dto = { orderId: 5 };
    const result = await controller.drillBatch(dto, mockUser);
    expect(result).toEqual({ updatedCount: 3 });
    expect(tasksService.drillBatch).toHaveBeenCalledWith(dto, mockUser);
  });

  it('edgeBatch przekazuje dto i użytkownika do serwisu', async () => {
    tasksService.edgeBatch = vitest.fn().mockResolvedValue({ updatedCount: 2 });

    const dto = { orderId: 5 };
    const result = await controller.edgeBatch(dto, mockUser);
    expect(result).toEqual({ updatedCount: 2 });
    expect(tasksService.edgeBatch).toHaveBeenCalledWith(dto, mockUser);
  });

  it('getPackingList przekazuje orderId i readyOnly do serwisu', async () => {
    tasksService.getPackingList = vitest.fn().mockResolvedValue([{ taskId: 2 }]);

    const result = await controller.getPackingList('5', 'false');
    expect(result).toEqual([{ taskId: 2 }]);
    expect(tasksService.getPackingList).toHaveBeenCalledWith(5, false);
  });

  it('getPackingSummary przekazuje orderId do serwisu', async () => {
    tasksService.getOrderPackingSummary = vitest.fn().mockResolvedValue({ orderId: 5, packedParts: 4 });

    const result = await controller.getPackingSummary(5);
    expect(result).toEqual({ orderId: 5, packedParts: 4 });
    expect(tasksService.getOrderPackingSummary).toHaveBeenCalledWith(5);
  });

  it('packBatch przekazuje dto i użytkownika do serwisu', async () => {
    tasksService.packBatch = vitest.fn().mockResolvedValue({ updatedCount: 4 });

    const dto = { orderId: 5 };
    const result = await controller.packBatch(dto, mockUser);
    expect(result).toEqual({ updatedCount: 4 });
    expect(tasksService.packBatch).toHaveBeenCalledWith(dto, mockUser);
  });

  it('updateBatchStatus przekazuje dto i użytkownika do serwisu', async () => {
    tasksService.updateBatchStatus = vitest.fn().mockResolvedValue({ updatedCount: 2 });

    const dto = { status: TaskStatus.EDGED, orderId: 5 };
    const result = await controller.updateBatchStatus(dto, mockUser);
    expect(result).toEqual({ updatedCount: 2 });
    expect(tasksService.updateBatchStatus).toHaveBeenCalledWith(dto, mockUser);
  });
});
