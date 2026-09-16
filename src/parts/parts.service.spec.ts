import { Test, TestingModule } from '@nestjs/testing';
import { PartsService } from './parts.service.js';

import { PrismaService } from '../prisma/prisma.service.js';

describe('PartsService', () => {
  let service: PartsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PartsService,
        { provide: PrismaService, useValue: {} },
      ],
    }).compile();

    service = module.get<PartsService>(PartsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
