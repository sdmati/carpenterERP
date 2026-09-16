import { Test, TestingModule } from '@nestjs/testing';
import { PartsController } from './parts.controller.js';
import { PartsService } from './parts.service.js';

import { PrismaService } from '../prisma/prisma.service.js';

describe('PartsController', () => {
  let controller: PartsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PartsController],
      providers: [
        PartsService,
        { provide: PrismaService, useValue: {} },
      ],
    }).compile();

    controller = module.get<PartsController>(PartsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
