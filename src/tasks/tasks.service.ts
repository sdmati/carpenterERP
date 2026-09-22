import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { TaskStatus, OrderStatus, Role } from '@prisma/client';
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface.js';
import { CuttingListItemDto } from './dto/cutting-list-item.dto.js';
import { CutDimensionGroupDto } from './dto/cut-dimension-group.dto.js';
import { groupTasksIntoCuttingList } from './utils/cutting-list.util.js';

export const ROLE_ALLOWED_STATUS: Record<Role, TaskStatus[]> = {
  [Role.SAW_OPERATOR]: [TaskStatus.CUT],
  [Role.DRILL_OPERATOR]: [TaskStatus.DRILLED],
  [Role.PACKER]: [TaskStatus.COMPLETED],
  [Role.ADMIN]: [
    TaskStatus.PENDING,
    TaskStatus.CUT,
    TaskStatus.DRILLED,
    TaskStatus.COMPLETED,
  ],
};

@Injectable()
export class TasksService {
  constructor(private prisma: PrismaService) {}

  findAll(orderId?: number, status?: TaskStatus) {
    const where: any = {};
    if (orderId) {
      where.orderId = orderId;
    }
    if (status) {
      where.status = status;
    }

    return this.prisma.productionTask.findMany({
      where,
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
  }

  findByOrderId(orderId: number) {
    return this.prisma.productionTask.findMany({
      where: { orderId },
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
  }

  async findByBarcode(barcode: string) {
    const task = await this.prisma.productionTask.findUnique({
      where: { barcode },
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

    if (!task) {
      throw new NotFoundException(`Nie znaleziono zadania o kodzie kreskowym ${barcode}`);
    }

    return task;
  }

  async findOne(id: number) {
    const task = await this.prisma.productionTask.findUnique({
      where: { id },
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

    if (!task) {
      throw new NotFoundException(`Nie znaleziono zadania o ID ${id}`);
    }

    return task;
  }

  // Główna metoda dla pracownika odhaczającego stan partii z weryfikacją uprawnień
  async updateStatus(id: number, status: TaskStatus, user?: AuthenticatedUser) {
    if (!user) {
      throw new UnauthorizedException('Wymagane jest zalogowanie, aby zmienić status zadania.');
    }

    const task = await this.prisma.productionTask.findUnique({
      where: { id },
    });

    if (!task) {
      throw new NotFoundException(`Nie znaleziono zadania o ID ${id}`);
    }

    // 1. Weryfikacja uprawnień roli
    const allowedStatuses = ROLE_ALLOWED_STATUS[user.role];
    if (!allowedStatuses || !allowedStatuses.includes(status)) {
      throw new ForbiddenException(
        `Brak uprawnień. Pracownik z rolą '${user.role}' nie może ustawić statusu '${status}'. Dozwolone statusy dla tej roli: ${allowedStatuses?.join(', ') || 'brak'}.`,
      );
    }

    // 2. Walidacja sekwencji procesu technologicznego (dla pracowników; ADMIN może wymusić dowolny stan)
    if (user.role !== Role.ADMIN) {
      if (status === TaskStatus.CUT) {
        if (task.status === TaskStatus.DRILLED || task.status === TaskStatus.COMPLETED) {
          throw new BadRequestException(
            `Formatka została już przetworzona w kolejnych etapach (aktualny status: ${task.status}). Nie można cofnąć do CUT.`,
          );
        }
      } else if (status === TaskStatus.DRILLED) {
        if (task.status === TaskStatus.PENDING) {
          throw new BadRequestException(
            'Formatka nie została jeszcze wycięta (oczekiwany status CUT). Wiercenie jest możliwe dopiero po rozkroju.',
          );
        }
        if (task.status === TaskStatus.COMPLETED) {
          throw new BadRequestException(
            'Formatka została już spakowana (COMPLETED). Nie można jej ponownie nawiercać.',
          );
        }
      } else if (status === TaskStatus.COMPLETED) {
        if (task.status !== TaskStatus.DRILLED) {
          throw new BadRequestException(
            `Formatka musi najpierw zostać nawiercona (oczekiwany status DRILLED) przed spakowaniem. Aktualny status to: ${task.status}.`,
          );
        }
      }
    }

    // 3. Aktualizujemy status partii
    const updatedTask = await this.prisma.productionTask.update({
      where: { id },
      data: { status },
      include: {
        partDefinition: true,
        order: true,
      },
    });

    // 4. Automatyzacja: Sprawdzamy stan wszystkich partii w tym zamówieniu
    const orderTasks = await this.prisma.productionTask.findMany({
      where: { orderId: task.orderId },
    });

    const allCompleted = orderTasks.every(
      (t) => t.status === TaskStatus.COMPLETED,
    );

    const anyStarted = orderTasks.some(
      (t) => t.status !== TaskStatus.PENDING,
    );

    // Jeśli każda partia jest już ukończona -> zamykamy/aktualizujemy zlecenie na COMPLETED
    if (allCompleted) {
      await this.prisma.productionOrder.update({
        where: { id: task.orderId },
        data: { status: OrderStatus.COMPLETED },
      });
    } else if (anyStarted) {
      // Jeśli cokolwiek ruszyło z miejsca, zlecenie jest w toku
      await this.prisma.productionOrder.update({
        where: { id: task.orderId },
        data: { status: OrderStatus.IN_PROGRESS },
      });
    } else {
      // Wszystkie są PENDING
      await this.prisma.productionOrder.update({
        where: { id: task.orderId },
        data: { status: OrderStatus.PENDING },
      });
    }

    return updatedTask;
  }

  async getCuttingList(orderId?: number): Promise<CuttingListItemDto[]> {
    const tasks = await this.prisma.productionTask.findMany({
      where: orderId ? { orderId } : {},
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

    return groupTasksIntoCuttingList(tasks);
  }

  async cutDimensionGroup(dto: CutDimensionGroupDto, user?: AuthenticatedUser) {
    if (!user) {
      throw new UnauthorizedException('Wymagane jest zalogowanie, aby dokonać rozkroju grupy.');
    }

    if (user.role !== Role.SAW_OPERATOR && user.role !== Role.ADMIN) {
      throw new ForbiddenException(
        `Brak uprawnień. Tylko pracownik z rolą SAW_OPERATOR lub ADMIN może oznaczać grupy jako CUT. Twoja rola: ${user.role}.`,
      );
    }

    const where: any = {
      orderId: dto.orderId,
      partDefinition: {
        length: dto.length,
        width: dto.width,
      },
    };

    if (dto.materialId) {
      where.partDefinition.materialId = dto.materialId;
    }

    const tasks = await this.prisma.productionTask.findMany({
      where,
      include: {
        partDefinition: true,
      },
    });

    if (tasks.length === 0) {
      throw new NotFoundException(
        `Nie znaleziono formatek o wymiarach ${dto.length} x ${dto.width} mm w zleceniu #${dto.orderId}.`,
      );
    }

    const pendingTasks = tasks.filter((t) => t.status === TaskStatus.PENDING);
    if (pendingTasks.length === 0) {
      return {
        message: `Wszystkie formatki o wymiarach ${dto.length} x ${dto.width} mm w zleceniu #${dto.orderId} zostały już wcześniej wycięte.`,
        updatedCount: 0,
        tasks,
      };
    }

    const updatedTasks = [];
    let totalCutQuantity = 0;

    for (const t of pendingTasks) {
      const updated = await this.updateStatus(t.id, TaskStatus.CUT, user);
      updatedTasks.push(updated);
      totalCutQuantity += t.quantity;
    }

    return {
      message: `Pomyślnie oznaczono jako CUT formatki o wymiarach ${dto.length} x ${dto.width} mm (łącznie ${totalCutQuantity} szt. w ${updatedTasks.length} zadaniach).`,
      updatedCount: updatedTasks.length,
      totalCutQuantity,
      tasks: updatedTasks,
    };
  }
}
