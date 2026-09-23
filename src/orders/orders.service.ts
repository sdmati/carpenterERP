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
import { OrderStatus, TaskStatus, Role, Color } from '@prisma/client';
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface.js';
import { groupTasksIntoCuttingList } from '../tasks/utils/cutting-list.util.js';
import { calculateOrderEdgeBandingSummary } from '../tasks/utils/edge-banding.util.js';
import { OrderEdgeBandingSummaryDto } from '../tasks/dto/edge-banding-summary.dto.js';
import {
  buildDrillingList,
  buildOrderDrillingSummary,
} from '../tasks/utils/drilling-list.util.js';
import {
  buildPackingList,
  buildOrderPackingSummary,
} from '../tasks/utils/packing-list.util.js';
import {
  DrillingListItemDto,
  OrderDrillingSummaryDto,
} from '../tasks/dto/drilling-list-item.dto.js';
import {
  PackingListItemDto,
  OrderPackingSummaryDto,
} from '../tasks/dto/packing-list-item.dto.js';

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
        (t) =>
          t.status === TaskStatus.PENDING ||
          t.status === TaskStatus.CUT ||
          t.status === TaskStatus.EDGED,
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

    // Automatyczne odliczenie okleiny ze stanu magazynowego po zakończeniu serii mebli (PACKED / COMPLETED)
    if ((status === OrderStatus.PACKED || status === OrderStatus.COMPLETED) && !order.edgeTapeDeducted) {
      await this.deductOrderEdgeTape(id);
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

  async getCuttingList(id: number) {
    const order = await this.prisma.productionOrder.findUnique({
      where: { id },
    });

    if (!order) {
      throw new NotFoundException(`Nie znaleziono zlecenia o ID ${id}`);
    }

    const tasks = await this.prisma.productionTask.findMany({
      where: { orderId: id },
      include: {
        partDefinition: {
          include: {
            material: true,
          },
        },
      },
    });

    return groupTasksIntoCuttingList(tasks);
  }

  async getEdgeBandingSummary(id: number): Promise<OrderEdgeBandingSummaryDto> {
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

    const summary = calculateOrderEdgeBandingSummary(order);
    const allEdgeTapes = this.prisma.edgeTape?.findMany
      ? await this.prisma.edgeTape.findMany()
      : [];

    const enrichedTapeBreakdown = summary.tapeBreakdown.map((tape) => {
      const match = allEdgeTapes.find(
        (t) =>
          t.type.toLowerCase() === tape.tapeType.toLowerCase() &&
          t.color === tape.tapeColor &&
          Math.abs(t.thickness - tape.tapeThickness) < 0.05,
      );

      const availableStockMeters = match ? match.stockMeters : 0;
      const isSufficient = availableStockMeters >= tape.totalMeters;
      const missingMeters = isSufficient
        ? 0
        : Math.round((tape.totalMeters - availableStockMeters) * 100) / 100;

      return {
        ...tape,
        availableStockMeters,
        isSufficient,
        missingMeters,
      };
    });

    const isStockSufficient = enrichedTapeBreakdown.every((t) => t.isSufficient);

    return {
      ...summary,
      isStockSufficient,
      edgeTapeDeducted: order.edgeTapeDeducted,
      tapeBreakdown: enrichedTapeBreakdown,
    };
  }

  async checkEdgeTapeAvailability(id: number) {
    const summary = await this.getEdgeBandingSummary(id);
    return {
      orderId: summary.orderId,
      productName: summary.productName,
      orderQuantity: summary.orderQuantity,
      totalMeters: summary.totalMeters,
      isStockSufficient: summary.isStockSufficient,
      edgeTapeDeducted: summary.edgeTapeDeducted,
      tapeBreakdown: summary.tapeBreakdown,
    };
  }

  async getDrillingList(id: number, readyOnly = false): Promise<DrillingListItemDto[]> {
    const order = await this.prisma.productionOrder.findUnique({
      where: { id },
    });

    if (!order) {
      throw new NotFoundException(`Nie znaleziono zlecenia o ID ${id}`);
    }

    const tasks = await this.prisma.productionTask.findMany({
      where: { orderId: id },
      include: {
        partDefinition: {
          include: {
            material: true,
          },
        },
        order: {
          include: {
            product: true,
          },
        },
      },
    });

    const list = buildDrillingList(tasks);
    if (readyOnly) {
      return list.filter((t) => t.isReadyToDrill);
    }
    return list;
  }

  async getDrillingSummary(id: number): Promise<OrderDrillingSummaryDto> {
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

    return buildOrderDrillingSummary(order);
  }

  async getPackingList(id: number, readyOnly = false): Promise<PackingListItemDto[]> {
    const order = await this.prisma.productionOrder.findUnique({
      where: { id },
    });

    if (!order) {
      throw new NotFoundException(`Nie znaleziono zlecenia o ID ${id}`);
    }

    const tasks = await this.prisma.productionTask.findMany({
      where: { orderId: id },
      include: {
        partDefinition: true,
        order: {
          include: {
            product: true,
          },
        },
      },
    });

    const list = buildPackingList(tasks);
    if (readyOnly) {
      return list.filter((t) => t.isReadyToPack);
    }
    return list;
  }

  async getPackingSummary(id: number): Promise<OrderPackingSummaryDto> {
    const order = await this.prisma.productionOrder.findUnique({
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

    if (!order) {
      throw new NotFoundException(`Nie znaleziono zlecenia o ID ${id}`);
    }

    return buildOrderPackingSummary(order);
  }

  async deductOrderEdgeTape(id: number, user?: AuthenticatedUser) {
    if (user && user.role !== Role.EDGE_BANDER_OPERATOR && user.role !== Role.ADMIN) {
      throw new ForbiddenException(
        `Brak uprawnień. Tylko pracownik z rolą EDGE_BANDER_OPERATOR lub ADMIN może odliczyć okleinę. Twoja rola: ${user.role}.`,
      );
    }

    const order = await this.prisma.productionOrder.findUnique({
      where: { id },
      include: {
        tasks: {
          include: {
            partDefinition: true,
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException(`Nie znaleziono zlecenia o ID ${id}`);
    }

    if (order.edgeTapeDeducted) {
      return {
        message: `Okleina dla zlecenia #${id} została już wcześniej odliczona z magazynu.`,
        orderId: id,
        edgeTapeDeducted: true,
        deductions: [],
      };
    }

    const summary = await this.getEdgeBandingSummary(id);
    const deductions: any[] = [];

    if (this.prisma.edgeTape?.findFirst) {
      for (const item of summary.tapeBreakdown) {
        const edgeTape = await this.prisma.edgeTape.findFirst({
          where: {
            type: { equals: item.tapeType, mode: 'insensitive' },
            color: item.tapeColor as Color,
          },
        });

        if (edgeTape) {
          const newStock = Math.max(
            0,
            Math.round((edgeTape.stockMeters - item.totalMeters) * 100) / 100,
          );
          const updated = await this.prisma.edgeTape.update({
            where: { id: edgeTape.id },
            data: { stockMeters: newStock },
          });

          deductions.push({
            edgeTapeId: edgeTape.id,
            name: edgeTape.name,
            type: edgeTape.type,
            color: edgeTape.color,
            deductedMeters: item.totalMeters,
            previousStockMeters: edgeTape.stockMeters,
            remainingStockMeters: updated.stockMeters,
          });
        }
      }
    }

    if (this.prisma.productionOrder?.update) {
      await this.prisma.productionOrder.update({
        where: { id },
        data: { edgeTapeDeducted: true },
      });
    }

    return {
      message: `Pomyślnie odliczono okleinę dla zlecenia #${id} z magazynu.`,
      orderId: id,
      edgeTapeDeducted: true,
      deductions,
    };
  }

  async consumeSheets(
    id: number,
    sheetsCount: number,
    materialId?: number,
    user?: AuthenticatedUser,
  ) {
    if (user && user.role !== Role.SAW_OPERATOR && user.role !== Role.ADMIN) {
      throw new ForbiddenException(
        `Brak uprawnień. Tylko pracownik z rolą SAW_OPERATOR lub ADMIN może wpisywać zużycie arkuszy płyty. Twoja rola: ${user.role}.`,
      );
    }

    if (sheetsCount <= 0) {
      throw new BadRequestException('Liczba zużytych arkuszy musi być większa od zera.');
    }

    const order = await this.prisma.productionOrder.findUnique({
      where: { id },
      include: {
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

    const targetMaterialId =
      materialId ||
      order.tasks.find((t) => t.partDefinition?.materialId)?.partDefinition?.materialId;

    if (!targetMaterialId) {
      throw new BadRequestException(
        'Nie znaleziono materiału płyty przypisanego do formatek w tym zleceniu.',
      );
    }

    const material = await this.prisma.material.findUnique({
      where: { id: targetMaterialId },
    });

    if (!material) {
      throw new NotFoundException(`Nie znaleziono materiału o ID ${targetMaterialId}`);
    }

    if (material.stockQuantity < sheetsCount) {
      throw new BadRequestException(
        `Niewystarczający stan magazynowy płyty "${material.name}". Dostępnych arkuszy: ${material.stockQuantity}, wpisane zużycie: ${sheetsCount}.`,
      );
    }

    const newStockQuantity = material.stockQuantity - sheetsCount;
    const newStockArea =
      Math.round(((material.length * material.width * newStockQuantity) / 1_000_000) * 100) / 100;

    const [updatedMaterial, updatedOrder] = await this.prisma.$transaction([
      this.prisma.material.update({
        where: { id: targetMaterialId },
        data: {
          stockQuantity: newStockQuantity,
          stockArea: newStockArea,
        },
      }),
      this.prisma.productionOrder.update({
        where: { id },
        data: {
          sheetsUsed: { increment: sheetsCount },
        },
      }),
    ]);

    return {
      message: `Pomyślnie zarejestrowano zużycie ${sheetsCount} arkuszy płyty dla zlecenia #${id}.`,
      orderId: id,
      materialId: targetMaterialId,
      materialName: updatedMaterial.name,
      sheetsConsumed: sheetsCount,
      orderSheetsUsed: updatedOrder.sheetsUsed,
      materialRemainingStock: updatedMaterial.stockQuantity,
      materialRemainingStockArea: updatedMaterial.stockArea,
    };
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
