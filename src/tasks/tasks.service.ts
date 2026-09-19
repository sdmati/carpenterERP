import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { TaskStatus, OrderStatus } from '@prisma/client';

@Injectable()
export class TasksService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.productionTask.findMany({
      include: {
        partDefinition: true,
        order: true,
      },
    });
  }

  findOne(id: number) {
    return this.prisma.productionTask.findUnique({
      where: { id },
      include: {
        partDefinition: true,
      },
    });
  }

  // Główna metoda dla pracownika odhaczającego stan partii
  async updateStatus(id: number, status: TaskStatus) {
    const task = await this.prisma.productionTask.findUnique({
      where: { id },
    });

    if (!task) {
      throw new NotFoundException(`Nie znaleziono zadania o ID ${id}`);
    }

    // 1. Aktualizujemy status partii
    const updatedTask = await this.prisma.productionTask.update({
      where: { id },
      data: { status },
    });

    // 2. Automatyzacja: Sprawdzamy stan wszystkich partii w tym zamówieniu
    const orderTasks = await this.prisma.productionTask.findMany({
      where: { orderId: task.orderId },
    });

    const allCompleted = orderTasks.every(
      (t) => t.status === TaskStatus.COMPLETED,
    );

    // Jeśli każda partia jest już ukończona -> zamykamy/aktualizujemy zlecenie
    if (allCompleted) {
      await this.prisma.productionOrder.update({
        where: { id: task.orderId },
        data: { status: OrderStatus.COMPLETED },
      });
    } else {
      // Jeśli cokolwiek ruszyło z miejsca, zlecenie jest w toku
      await this.prisma.productionOrder.update({
        where: { id: task.orderId },
        data: { status: OrderStatus.IN_PROGRESS },
      });
    }

    return updatedTask;
  }
}
