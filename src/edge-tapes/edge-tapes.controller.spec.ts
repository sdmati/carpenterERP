import { Test, TestingModule } from '@nestjs/testing';
import { EdgeTapesController } from './edge-tapes.controller.js';
import { EdgeTapesService } from './edge-tapes.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Role } from '@prisma/client';
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface.js';

describe('EdgeTapesController', () => {
  let controller: EdgeTapesController;
  let service: any;

  const mockUser: AuthenticatedUser = {
    id: 1,
    username: 'edge_operator',
    name: 'Marek Okleiniarz',
    role: Role.EDGE_BANDER_OPERATOR,
  };

  beforeEach(async () => {
    service = {
      findAll: vi.fn(),
      findOne: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
      consume: vi.fn(),
      checkAvailability: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [EdgeTapesController],
      providers: [
        { provide: EdgeTapesService, useValue: service },
        { provide: PrismaService, useValue: {} },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<EdgeTapesController>(EdgeTapesController);
  });

  it('powinien być zdefiniowany', () => {
    expect(controller).toBeDefined();
  });

  it('consume wywołuje service.consume z parametrami użytkownika', async () => {
    service.consume.mockResolvedValue({
      message: 'Pomyślnie odliczono 10 mb okleiny z magazynu.',
      edgeTapeId: 1,
      metersConsumed: 10,
    });

    const result = await controller.consume(
      1,
      { meters: 10, reason: 'Próba' },
      mockUser,
    );

    expect(service.consume).toHaveBeenCalledWith(1, 10, 'Próba', undefined, mockUser);
    expect(result.metersConsumed).toBe(10);
  });

  it('checkAvailability wywołuje service.checkAvailability', async () => {
    service.checkAvailability.mockResolvedValue({
      orderId: 1,
      isStockSufficient: true,
    });

    const result = await controller.checkAvailability(1);

    expect(service.checkAvailability).toHaveBeenCalledWith(1);
    expect(result.isStockSufficient).toBe(true);
  });
});
