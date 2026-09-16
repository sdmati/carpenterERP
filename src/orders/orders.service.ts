import { Injectable } from '@nestjs/common';
import { CreateOrderDto } from './dto/create-order.dto.js';
import { UpdateOrderDto } from './dto/update-order.dto.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class OrdersService {
  constructor(private prisma: PrismaService) {}

  create(createOrderDto: CreateOrderDto) {
    return this.prisma.productionOrder.create({
      data: createOrderDto,
    });
  }

  findAll() {
    return this.prisma.productionOrder.findMany({
      include: {
        product: true,
        tasks: true,
      },
    });
  }

  findOne(id: number) {
    return this.prisma.productionOrder.findUnique({
      where: { id },
      include: {
        product: true,
        tasks: true,
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
