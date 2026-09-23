import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateMaterialDto } from './dto/create-material.dto.js';
import { UpdateMaterialDto } from './dto/update-material.dto.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface.js';

@Injectable()
export class MaterialsService {
  constructor(private prisma: PrismaService) {}

  create(createMaterialDto: CreateMaterialDto) {
    return this.prisma.material.create({
      data: createMaterialDto,
    });
  }

  findAll() {
    return this.prisma.material.findMany();
  }

  findOne(id: number) {
    return this.prisma.material.findUnique({ where: { id } });
  }

  update(id: number, updateMaterialDto: UpdateMaterialDto) {
    return this.prisma.material.update({
      where: { id },
      data: updateMaterialDto,
    });
  }

  remove(id: number) {
    return this.prisma.material.delete({ where: { id } });
  }

  async consume(id: number, sheetsCount: number, orderId?: number, _user?: AuthenticatedUser) {
    if (sheetsCount <= 0) {
      throw new BadRequestException('Liczba zużytych arkuszy musi być większa od zera.');
    }

    const material = await this.prisma.material.findUnique({ where: { id } });
    if (!material) {
      throw new NotFoundException(`Nie znaleziono materiału o ID ${id}`);
    }

    if (material.stockQuantity < sheetsCount) {
      throw new BadRequestException(
        `Niewystarczający stan magazynowy płyty "${material.name}". Dostępnych arkuszy: ${material.stockQuantity}, wpisane zużycie: ${sheetsCount}.`,
      );
    }

    const newStockQuantity = material.stockQuantity - sheetsCount;
    const newStockArea =
      Math.round(((material.length * material.width * newStockQuantity) / 1_000_000) * 100) / 100;

    const updatedMaterial = await this.prisma.material.update({
      where: { id },
      data: {
        stockQuantity: newStockQuantity,
        stockArea: newStockArea,
      },
    });

    let updatedOrder: any = null;
    if (orderId) {
      const order = await this.prisma.productionOrder.findUnique({ where: { id: orderId } });
      if (order) {
        updatedOrder = await this.prisma.productionOrder.update({
          where: { id: orderId },
          data: {
            sheetsUsed: { increment: sheetsCount },
          },
        });
      }
    }

    return {
      message: `Pomyślnie zarejestrowano zużycie ${sheetsCount} arkuszy płyty "${material.name}".`,
      materialId: material.id,
      materialName: material.name,
      sheetsConsumed: sheetsCount,
      previousStock: material.stockQuantity,
      currentStock: updatedMaterial.stockQuantity,
      currentStockArea: updatedMaterial.stockArea,
      orderId: updatedOrder?.id,
      orderSheetsUsed: updatedOrder?.sheetsUsed,
    };
  }
}
