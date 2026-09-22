import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { CreateOrderDto } from './dto/create-order.dto.js';
import { UpdateOrderDto } from './dto/update-order.dto.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { OrderStatus, TaskStatus, Role } from '@prisma/client';
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface.js';

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

  async getTasks(id: number) {
    const order = await this.prisma.productionOrder.findUnique({
      where: { id },
      include: {
        product: true,
        tasks: {
          include: {
            partDefinition: {
              include: {
                material: true,
              },
            },
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException(`Nie znaleziono zlecenia o ID ${id}`);
    }

    return order.tasks;
  }

  async updateStatus(id: number, status: OrderStatus, user?: AuthenticatedUser) {
    if (!user) {
      throw new UnauthorizedException('Wymagane jest zalogowanie, aby zmienić status zlecenia.');
    }

    const order = await this.prisma.productionOrder.findUnique({
      where: { id },
      include: { tasks: true },
    });

    if (!order) {
      throw new NotFoundException(`Nie znaleziono zlecenia o ID ${id}`);
    }

    if (status === OrderStatus.PACKED) {
      // 1. Uprawnienia: Tylko PACKER lub ADMIN
      if (user.role !== Role.PACKER && user.role !== Role.ADMIN) {
        throw new ForbiddenException(
          `Brak uprawnień. Tylko pracownik z rolą PACKER lub ADMIN może oznaczyć zlecenie jako PACKED. Twoja rola: ${user.role}.`,
        );
      }

      // 2. Walidacja: Wszystkie części muszą zostać nawiercone (status DRILLED)
      if (order.tasks.length === 0) {
        throw new BadRequestException('Zlecenie nie zawiera żadnych części/zadań do spakowania.');
      }

      const undrilledTasks = order.tasks.filter(
        (t) => t.status === TaskStatus.PENDING || t.status === TaskStatus.CUT,
      );
      if (undrilledTasks.length > 0) {
        throw new BadRequestException(
          `Nie można oznaczyć zlecenia jako PACKED. Wszystkie części muszą zostać najpierw nawiercone (status DRILLED). Liczba nienawierconych części: ${undrilledTasks.length}.`,
        );
      }

      // Po spakowaniu całego zlecenia oznaczamy formatki jako ukończone/spakowane (COMPLETED)
      await this.prisma.productionTask.updateMany({
        where: { orderId: id },
        data: { status: TaskStatus.COMPLETED },
      });
    } else {
      // Inne manualne zmiany statusu zlecenia wymagają roli ADMIN
      if (user.role !== Role.ADMIN) {
        throw new ForbiddenException(
          `Tylko administrator może ręcznie zmienić status zlecenia na ${status}.`,
        );
      }
    }

    return this.prisma.productionOrder.update({
      where: { id },
      data: { status },
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
