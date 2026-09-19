import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { CreateOrderDto } from './dto/create-order.dto.js';
import { UpdateOrderDto } from './dto/update-order.dto.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class OrdersService {
  constructor(private prisma: PrismaService) {}

  async create(createOrderDto: CreateOrderDto) {
    const { productId, quantity, color } = createOrderDto;

    // 1. Pobieramy definicję mebla i jego składowe
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: { parts: true },
    });

    if (!product) {
      throw new NotFoundException('Nie znaleziono takiego mebla.');
    }
    if (product.parts.length === 0) {
      throw new BadRequestException(
        'Mebel nie ma przypisanych żadnych formatek w technologii.',
      );
    }

    // 2. Tworzymy zamówienie i od razu generujemy pule zadań na halę
    return this.prisma.productionOrder.create({
      data: {
        productId,
        quantity,
        color,
        tasks: {
          create: product.parts.map((part) => ({
            partDefId: part.id,
            quantity: part.quantity * quantity, // np. 2 boki * 50 szaf = partia 100 sztuk
            barcode: `ORD-${Date.now().toString().slice(-4)}-PART-${part.id}`, // unikalny kod na wózek
          })),
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
  }

  findAll() {
    return this.prisma.productionOrder.findMany({
      include: {
        product: true,
        tasks: {
          include: {
            partDefinition: true,
          },
        },
      },
    });
  }

  findOne(id: number) {
    return this.prisma.productionOrder.findUnique({
      where: { id },
      include: {
        product: true,
        tasks: {
          include: {
            partDefinition: true,
          },
        },
      },
    });
  }

  update(id: number, updateOrderDto: UpdateOrderDto) {
    return this.prisma.productionOrder.update({
      where: { id },
      data: updateOrderDto,
    });
  }

  remove(id: number) {
    return this.prisma.productionOrder.delete({
      where: { id },
    });
  }
}
