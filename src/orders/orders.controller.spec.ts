import { Test, TestingModule } from '@nestjs/testing';
import { OrdersController } from './orders.controller.js';
import { OrdersService } from './orders.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { OrderStatus, Role } from '@prisma/client';
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface.js';

describe('OrdersController', () => {
  let controller: OrdersController;
  let ordersService: Partial<Record<keyof OrdersService, any>>;

  const mockUser: AuthenticatedUser = {
    id: 1,
    username: 'packer1',
    name: 'Adam Pakowacz',
    role: Role.PACKER,
  };

  beforeEach(async () => {
    ordersService = {
      findAll: vitest.fn(),
      findOne: vitest.fn(),
      create: vitest.fn(),
      update: vitest.fn(),
      remove: vitest.fn(),
      getTasks: vitest.fn(),
      updateStatus: vitest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrdersController],
      providers: [
        { provide: OrdersService, useValue: ordersService },
        { provide: PrismaService, useValue: {} },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<OrdersController>(OrdersController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('updateStatus wywołuje ordersService.updateStatus', async () => {
    ordersService.updateStatus.mockResolvedValue({ id: 1, status: OrderStatus.PACKED });

    const result = await controller.updateStatus(1, { status: OrderStatus.PACKED }, mockUser);
    expect(result).toEqual({ id: 1, status: OrderStatus.PACKED });
    expect(ordersService.updateStatus).toHaveBeenCalledWith(1, OrderStatus.PACKED, mockUser);
  });
});
