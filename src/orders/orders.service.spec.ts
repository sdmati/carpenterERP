import { Test, TestingModule } from '@nestjs/testing';
import { OrdersService } from './orders.service.js';
import { Color } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';

describe('OrdersService', () => {
  let service: OrdersService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {};
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

  it('should throw NotFoundException if product is not found', async () => {
    prisma.product = { findUnique: vi.fn().mockResolvedValue(null) };

    await expect(
      service.create({ productId: 999, quantity: 1, color: Color.SONOMA }),
    ).rejects.toThrow('Nie znaleziono takiego mebla.');
  });

  it('should throw BadRequestException if product has no parts', async () => {
    prisma.product = {
      findUnique: vi.fn().mockResolvedValue({ id: 1, name: 'Pusta szafka', parts: [] }),
    };

    await expect(
      service.create({ productId: 1, quantity: 1, color: Color.SONOMA }),
    ).rejects.toThrow('Mebel nie ma przypisanych żadnych formatek w technologii.');
  });

  it('should create order and tasks', async () => {
    prisma.product = {
      findUnique: vi.fn().mockResolvedValue({
        id: 1,
        name: 'Szafka',
        parts: [
          { id: 10, name: 'Bok', length: 720, width: 560, quantity: 2, materialId: 5 },
        ],
      }),
    };
    const expectedOrder = {
      id: 1,
      productId: 1,
      quantity: 1,
      color: Color.SONOMA,
      tasks: [{ id: 101, partDefId: 10, quantity: 2 }],
    };
    prisma.productionOrder = {
      create: vi.fn().mockResolvedValue(expectedOrder),
    };

    const result = await service.create({
      productId: 1,
      quantity: 1,
      color: Color.SONOMA,
    });
    expect(result).toEqual(expectedOrder);
    expect(prisma.productionOrder.create).toHaveBeenCalledWith({
      data: {
        productId: 1,
        quantity: 1,
        color: Color.SONOMA,
        tasks: {
          create: [
            {
              partDefId: 10,
              quantity: 2,
              barcode: expect.stringMatching(/^ORD-\d{4}-PART-10$/),
            },
          ],
        },
      },
      include: {
        tasks: {
          include: {
            partDefinition: true,
          },
        },
      },
    });
  });
});
