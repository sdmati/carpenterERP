import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateEdgeTapeDto } from './dto/create-edge-tape.dto.js';
import { UpdateEdgeTapeDto } from './dto/update-edge-tape.dto.js';
import { Color } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface.js';
import { calculateOrderEdgeBandingSummary } from '../tasks/utils/edge-banding.util.js';

@Injectable()
export class EdgeTapesService {
  constructor(private prisma: PrismaService) {}

  create(createEdgeTapeDto: CreateEdgeTapeDto) {
    return this.prisma.edgeTape.create({
      data: createEdgeTapeDto,
    });
  }

  findAll(type?: string, color?: Color) {
    const where: any = {};
    if (type) where.type = type;
    if (color) where.color = color;

    return this.prisma.edgeTape.findMany({ where });
  }

  async findOne(id: number) {
    const edgeTape = await this.prisma.edgeTape.findUnique({
      where: { id },
    });
    if (!edgeTape) {
      throw new NotFoundException(`Nie znaleziono okleiny o ID ${id}`);
    }
    return edgeTape;
  }

  update(id: number, updateEdgeTapeDto: UpdateEdgeTapeDto) {
    return this.prisma.edgeTape.update({
      where: { id },
      data: updateEdgeTapeDto,
    });
  }

  remove(id: number) {
    return this.prisma.edgeTape.delete({
      where: { id },
    });
  }

  async consume(
    id: number,
    meters: number,
    reason?: string,
    orderId?: number,
    _user?: AuthenticatedUser,
  ) {
    if (meters <= 0) {
      throw new BadRequestException('Liczba zużytych metrów okleiny musi być większa od zera.');
    }

    const edgeTape = await this.prisma.edgeTape.findUnique({ where: { id } });
    if (!edgeTape) {
      throw new NotFoundException(`Nie znaleziono okleiny o ID ${id}`);
    }

    if (edgeTape.stockMeters < meters) {
      throw new BadRequestException(
        `Niewystarczający stan magazynowy okleiny "${edgeTape.name}". Dostępne: ${edgeTape.stockMeters} mb, wpisane zużycie: ${meters} mb.`,
      );
    }

    const newStockMeters = Math.round((edgeTape.stockMeters - meters) * 100) / 100;

    const updatedEdgeTape = await this.prisma.edgeTape.update({
      where: { id },
      data: {
        stockMeters: newStockMeters,
      },
    });

    return {
      message: `Pomyślnie odliczono ${meters} mb okleiny "${edgeTape.name}" z magazynu.`,
      edgeTapeId: edgeTape.id,
      edgeTapeName: edgeTape.name,
      type: edgeTape.type,
      color: edgeTape.color,
      thickness: edgeTape.thickness,
      metersConsumed: meters,
      previousStockMeters: edgeTape.stockMeters,
      currentStockMeters: updatedEdgeTape.stockMeters,
      reason: reason || null,
      orderId: orderId || null,
    };
  }

  async checkAvailability(orderId: number) {
    const order = await this.prisma.productionOrder.findUnique({
      where: { id: orderId },
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
      throw new NotFoundException(`Nie znaleziono zlecenia o ID ${orderId}`);
    }

    const summary = calculateOrderEdgeBandingSummary(order);
    const allEdgeTapes = await this.prisma.edgeTape.findMany();

    const enrichedTapeBreakdown = summary.tapeBreakdown.map((tape) => {
      const match = allEdgeTapes.find(
        (t) =>
          t.type.toLowerCase() === tape.tapeType.toLowerCase() &&
          t.color === tape.tapeColor &&
          Math.abs(t.thickness - tape.tapeThickness) < 0.01,
      );

      const availableStockMeters = match ? match.stockMeters : 0;
      const isSufficient = availableStockMeters >= tape.totalMeters;
      const missingMeters = isSufficient
        ? 0
        : Math.round((tape.totalMeters - availableStockMeters) * 100) / 100;

      return {
        ...tape,
        edgeTapeId: match?.id ?? null,
        availableStockMeters,
        isSufficient,
        missingMeters,
      };
    });

    const isStockSufficient = enrichedTapeBreakdown.every((t) => t.isSufficient);

    return {
      orderId: order.id,
      productName: order.product?.name,
      orderQuantity: order.quantity,
      totalMeters: summary.totalMeters,
      isStockSufficient,
      edgeTapeDeducted: order.edgeTapeDeducted,
      tapeBreakdown: enrichedTapeBreakdown,
    };
  }
}
