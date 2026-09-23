import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { TaskStatus, OrderStatus, Role, Color } from '@prisma/client';
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface.js';
import { CuttingListItemDto } from './dto/cutting-list-item.dto.js';
import { CutDimensionGroupDto } from './dto/cut-dimension-group.dto.js';
import { TaskEdgeBandingItemDto } from './dto/edge-banding-summary.dto.js';
import {
  DrillingListItemDto,
  OrderDrillingSummaryDto,
} from './dto/drilling-list-item.dto.js';
import {
  PackingListItemDto,
  OrderPackingSummaryDto,
} from './dto/packing-list-item.dto.js';
import { EdgeBatchDto } from './dto/edge-batch.dto.js';
import { DrillBatchDto } from './dto/drill-batch.dto.js';
import { PackBatchDto } from './dto/pack-batch.dto.js';
import { BatchTaskStatusDto } from './dto/batch-task-status.dto.js';
import { groupTasksIntoCuttingList } from './utils/cutting-list.util.js';
import {
  calculateTaskEdgeBanding,
  requiresEdgeBanding,
  calculateOrderEdgeBandingSummary,
} from './utils/edge-banding.util.js';
import {
  buildDrillingList,
  buildOrderDrillingSummary,
  isTaskReadyToDrill,
} from './utils/drilling-list.util.js';
import {
  buildPackingList,
  buildOrderPackingSummary,
  isTaskReadyToPack,
} from './utils/packing-list.util.js';

export const ROLE_ALLOWED_STATUS: Record<Role, TaskStatus[]> = {
  [Role.SAW_OPERATOR]: [TaskStatus.CUT],
  [Role.EDGE_BANDER_OPERATOR]: [TaskStatus.EDGED],
  [Role.DRILL_OPERATOR]: [TaskStatus.DRILLED],
  [Role.PACKER]: [TaskStatus.COMPLETED],
  [Role.ADMIN]: [
    TaskStatus.PENDING,
    TaskStatus.CUT,
    TaskStatus.EDGED,
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
      include: {
        partDefinition: true,
      },
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
        if (
          task.status === TaskStatus.EDGED ||
          task.status === TaskStatus.DRILLED ||
          task.status === TaskStatus.COMPLETED
        ) {
          throw new BadRequestException(
            `Formatka została już przetworzona w kolejnych etapach (aktualny status: ${task.status}). Nie można cofnąć do CUT.`,
          );
        }
      } else if (status === TaskStatus.EDGED) {
        if (task.status === TaskStatus.PENDING) {
          throw new BadRequestException(
            'Formatka nie została jeszcze wycięta (oczekiwany status CUT). Okleinowanie jest możliwe dopiero po rozkroju.',
          );
        }
        if (
          task.status === TaskStatus.DRILLED ||
          task.status === TaskStatus.COMPLETED
        ) {
          throw new BadRequestException(
            `Formatka została już przetworzona w kolejnych etapach (aktualny status: ${task.status}). Nie można cofnąć do EDGED.`,
          );
        }
      } else if (status === TaskStatus.DRILLED) {
        const needsEdging = requiresEdgeBanding(task.partDefinition);

        if (needsEdging) {
          if (task.status === TaskStatus.PENDING) {
            throw new BadRequestException(
              'Formatka nie została jeszcze wycięta (oczekiwany status CUT, a następnie EDGED). Wiercenie jest możliwe dopiero po rozkroju i oklejeniu.',
            );
          }
          if (task.status === TaskStatus.CUT) {
            throw new BadRequestException(
              'Formatka wymaga oklejenia krawędzi (oczekiwany status EDGED). Wiercenie jest możliwe dopiero po oklejeniu krawędzi.',
            );
          }
          if (task.status === TaskStatus.COMPLETED) {
            throw new BadRequestException(
              'Formatka została już spakowana (COMPLETED). Nie można jej ponownie nawiercać.',
            );
          }
        } else {
          // Formatka bez oklejenia może przejść do DRILLED bezpośrednio po CUT
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
      await this.deductOrderEdgeTape(task.orderId);
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

    let materialConsumption: any = null;
    if (dto.sheetsUsed && dto.sheetsUsed > 0) {
      const matId = dto.materialId || tasks[0]?.partDefinition?.materialId;
      if (matId) {
        const material = await this.prisma.material.findUnique({ where: { id: matId } });
        if (material) {
          if (material.stockQuantity < dto.sheetsUsed) {
            throw new BadRequestException(
              `Niewystarczający stan magazynowy płyty "${material.name}". Dostępnych arkuszy: ${material.stockQuantity}, wpisane zużycie: ${dto.sheetsUsed}.`,
            );
          }
          const newStock = material.stockQuantity - dto.sheetsUsed;
          const newArea =
            Math.round(((material.length * material.width * newStock) / 1_000_000) * 100) / 100;

          await this.prisma.material.update({
            where: { id: matId },
            data: { stockQuantity: newStock, stockArea: newArea },
          });

          await this.prisma.productionOrder.update({
            where: { id: dto.orderId },
            data: { sheetsUsed: { increment: dto.sheetsUsed } },
          });

          materialConsumption = {
            materialId: matId,
            materialName: material.name,
            sheetsConsumed: dto.sheetsUsed,
            remainingStock: newStock,
          };
        }
      }
    }

    return {
      message: `Pomyślnie oznaczono jako CUT formatki o wymiarach ${dto.length} x ${dto.width} mm (łącznie ${totalCutQuantity} szt. w ${updatedTasks.length} zadaniach).`,
      updatedCount: updatedTasks.length,
      totalCutQuantity,
      materialConsumption,
      tasks: updatedTasks,
    };
  }

  async getEdgeBandingList(orderId?: number): Promise<TaskEdgeBandingItemDto[]> {
    const tasks = await this.prisma.productionTask.findMany({
      where: orderId ? { orderId } : {},
      include: {
        partDefinition: true,
      },
    });

    return tasks.map((task) => calculateTaskEdgeBanding(task));
  }

  async getTaskEdgeBanding(id: number): Promise<TaskEdgeBandingItemDto> {
    const task = await this.prisma.productionTask.findUnique({
      where: { id },
      include: {
        partDefinition: true,
      },
    });

    if (!task) {
      throw new NotFoundException(`Nie znaleziono zadania o ID ${id}`);
    }

    return calculateTaskEdgeBanding(task);
  }

  private async deductOrderEdgeTape(orderId: number) {
    if (!this.prisma.productionOrder?.findUnique) {
      return;
    }

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

    if (!order || order.edgeTapeDeducted) {
      return;
    }

    const summary = calculateOrderEdgeBandingSummary(order);
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
        await this.prisma.edgeTape.update({
          where: { id: edgeTape.id },
          data: { stockMeters: newStock },
        });
      }
    }

    await this.prisma.productionOrder.update({
      where: { id: orderId },
      data: { edgeTapeDeducted: true },
    });
  }

  async getDrillingList(orderId?: number, readyOnly = false): Promise<DrillingListItemDto[]> {
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

    const list = buildDrillingList(tasks);
    if (readyOnly) {
      return list.filter((t) => t.isReadyToDrill);
    }
    return list;
  }

  async getOrderDrillingSummary(orderId: number): Promise<OrderDrillingSummaryDto> {
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

    return buildOrderDrillingSummary(order);
  }

  async getPackingList(orderId?: number, readyOnly = false): Promise<PackingListItemDto[]> {
    const tasks = await this.prisma.productionTask.findMany({
      where: orderId ? { orderId } : {},
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

  async getOrderPackingSummary(orderId: number): Promise<OrderPackingSummaryDto> {
    const order = await this.prisma.productionOrder.findUnique({
      where: { id: orderId },
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
      throw new NotFoundException(`Nie znaleziono zlecenia o ID ${orderId}`);
    }

    return buildOrderPackingSummary(order);
  }

  async edgeBatch(dto: EdgeBatchDto, user?: AuthenticatedUser) {
    if (!user) {
      throw new UnauthorizedException('Wymagane jest zalogowanie, aby oznaczyć partie jako EDGED.');
    }
    if (user.role !== Role.EDGE_BANDER_OPERATOR && user.role !== Role.ADMIN) {
      throw new ForbiddenException(
        `Brak uprawnień. Tylko pracownik z rolą EDGE_BANDER_OPERATOR lub ADMIN może oznaczać partie jako EDGED. Twoja rola: ${user.role}.`,
      );
    }

    if (!dto.orderId && (!dto.taskIds || dto.taskIds.length === 0)) {
      throw new BadRequestException('Należy podać orderId lub taskIds do wykonania oklejania partii.');
    }

    const where: any = {};
    if (dto.orderId) where.orderId = dto.orderId;
    if (dto.taskIds && dto.taskIds.length > 0) where.id = { in: dto.taskIds };

    const tasks = await this.prisma.productionTask.findMany({
      where,
      include: { partDefinition: true },
    });

    if (tasks.length === 0) {
      throw new NotFoundException('Nie znaleziono partii produkcyjnych dla podanych kryteriów.');
    }

    // Filtrujemy partie gotowe do oklejenia (status CUT oraz wymagające oklejenia)
    let eligibleTasks = tasks.filter(
      (t) => t.status === TaskStatus.CUT && requiresEdgeBanding(t.partDefinition),
    );

    if (dto.edgeTapeType) {
      eligibleTasks = eligibleTasks.filter(
        (t) => t.partDefinition.edgeTapeType?.toLowerCase() === dto.edgeTapeType!.toLowerCase(),
      );
    }
    if (dto.edgeTapeColor) {
      eligibleTasks = eligibleTasks.filter(
        (t) => t.partDefinition.edgeTapeColor === dto.edgeTapeColor,
      );
    }
    if (dto.edgeTapeThickness !== undefined) {
      eligibleTasks = eligibleTasks.filter(
        (t) =>
          t.partDefinition.edgeTapeThickness !== null &&
          Math.abs(t.partDefinition.edgeTapeThickness - dto.edgeTapeThickness!) < 0.05,
      );
    }

    if (eligibleTasks.length === 0) {
      const alreadyEdged = tasks.filter((t) => t.status === TaskStatus.EDGED).length;
      return {
        message: `Brak partii oczekujących na oklejenie (znaleziono ${tasks.length} partii, w tym ${alreadyEdged} już oklejonych lub niewyciętych).`,
        updatedCount: 0,
        totalQuantity: 0,
        tasks: [],
      };
    }

    const updatedTasks = [];
    let totalQuantity = 0;

    for (const t of eligibleTasks) {
      const updated = await this.updateStatus(t.id, TaskStatus.EDGED, user);
      updatedTasks.push(updated);
      totalQuantity += t.quantity;
    }

    return {
      message: `Pomyślnie oznaczono jako EDGED ${updatedTasks.length} partii (łącznie ${totalQuantity} szt. formatek).`,
      updatedCount: updatedTasks.length,
      totalQuantity,
      tasks: updatedTasks,
    };
  }

  async drillBatch(dto: DrillBatchDto, user?: AuthenticatedUser) {
    if (!user) {
      throw new UnauthorizedException('Wymagane jest zalogowanie, aby oznaczyć partie jako DRILLED.');
    }
    if (user.role !== Role.DRILL_OPERATOR && user.role !== Role.ADMIN) {
      throw new ForbiddenException(
        `Brak uprawnień. Tylko pracownik z rolą DRILL_OPERATOR lub ADMIN może oznaczać partie jako DRILLED. Twoja rola: ${user.role}.`,
      );
    }

    if (!dto.orderId && (!dto.taskIds || dto.taskIds.length === 0)) {
      throw new BadRequestException('Należy podać orderId lub taskIds do wykonania nawiercania partii.');
    }

    const where: any = {};
    if (dto.orderId) where.orderId = dto.orderId;
    if (dto.taskIds && dto.taskIds.length > 0) where.id = { in: dto.taskIds };

    const tasks = await this.prisma.productionTask.findMany({
      where,
      include: { partDefinition: true },
    });

    if (tasks.length === 0) {
      throw new NotFoundException('Nie znaleziono partii produkcyjnych dla podanych kryteriów.');
    }

    // Formatki gotowe do wiercenia: EDGED jeśli wymagały oklejenia, lub CUT jeśli nie wymagały
    const eligibleTasks = tasks.filter((t) => isTaskReadyToDrill(t));

    if (eligibleTasks.length === 0) {
      const alreadyDrilled = tasks.filter(
        (t) => t.status === TaskStatus.DRILLED || t.status === TaskStatus.COMPLETED,
      ).length;
      return {
        message: `Brak partii gotowych do wiercenia (znaleziono ${tasks.length} partii, w tym ${alreadyDrilled} już nawierconych; pozostałe oczekują na rozkrój lub oklejenie).`,
        updatedCount: 0,
        totalQuantity: 0,
        tasks: [],
      };
    }

    const updatedTasks = [];
    let totalQuantity = 0;

    for (const t of eligibleTasks) {
      const updated = await this.updateStatus(t.id, TaskStatus.DRILLED, user);
      updatedTasks.push(updated);
      totalQuantity += t.quantity;
    }

    return {
      message: `Pomyślnie oznaczono jako DRILLED ${updatedTasks.length} partii (łącznie ${totalQuantity} szt. formatek).`,
      updatedCount: updatedTasks.length,
      totalQuantity,
      tasks: updatedTasks,
    };
  }

  async packBatch(dto: PackBatchDto, user?: AuthenticatedUser) {
    if (!user) {
      throw new UnauthorizedException('Wymagane jest zalogowanie, aby oznaczyć partie jako spakowane.');
    }
    if (user.role !== Role.PACKER && user.role !== Role.ADMIN) {
      throw new ForbiddenException(
        `Brak uprawnień. Tylko pracownik z rolą PACKER lub ADMIN może oznaczać partie jako spakowane (COMPLETED). Twoja rola: ${user.role}.`,
      );
    }

    if (!dto.orderId && (!dto.taskIds || dto.taskIds.length === 0)) {
      throw new BadRequestException('Należy podać orderId lub taskIds do spakowania partii.');
    }

    const where: any = {};
    if (dto.orderId) where.orderId = dto.orderId;
    if (dto.taskIds && dto.taskIds.length > 0) where.id = { in: dto.taskIds };

    const tasks = await this.prisma.productionTask.findMany({
      where,
      include: { partDefinition: true },
    });

    if (tasks.length === 0) {
      throw new NotFoundException('Nie znaleziono partii produkcyjnych dla podanych kryteriów.');
    }

    // Do spakowania kwalifikują się partie o statusie DRILLED
    const eligibleTasks = tasks.filter((t) => isTaskReadyToPack(t));

    if (eligibleTasks.length === 0) {
      const alreadyPacked = tasks.filter((t) => t.status === TaskStatus.COMPLETED).length;
      return {
        message: `Brak partii gotowych do spakowania (znaleziono ${tasks.length} partii, w tym ${alreadyPacked} już spakowanych; pozostałe wymagają wcześniejszego nawiercenia DRILLED).`,
        updatedCount: 0,
        totalQuantity: 0,
        tasks: [],
      };
    }

    const updatedTasks = [];
    let totalQuantity = 0;

    for (const t of eligibleTasks) {
      const updated = await this.updateStatus(t.id, TaskStatus.COMPLETED, user);
      updatedTasks.push(updated);
      totalQuantity += t.quantity;
    }

    return {
      message: `Pomyślnie spakowano (COMPLETED) ${updatedTasks.length} partii (łącznie ${totalQuantity} szt. formatek).`,
      updatedCount: updatedTasks.length,
      totalQuantity,
      tasks: updatedTasks,
    };
  }

  async updateBatchStatus(dto: BatchTaskStatusDto, user?: AuthenticatedUser) {
    if (!user) {
      throw new UnauthorizedException('Wymagane jest zalogowanie, aby zmienić status partii.');
    }

    const allowedStatuses = ROLE_ALLOWED_STATUS[user.role];
    if (!allowedStatuses || !allowedStatuses.includes(dto.status)) {
      throw new ForbiddenException(
        `Brak uprawnień. Pracownik z rolą '${user.role}' nie może masowo ustawić statusu '${dto.status}'. Dozwolone dla tej roli: ${allowedStatuses?.join(', ') || 'brak'}.`,
      );
    }

    if (!dto.orderId && (!dto.taskIds || dto.taskIds.length === 0)) {
      throw new BadRequestException('Należy podać orderId lub taskIds do zmiany statusu.');
    }

    const where: any = {};
    if (dto.orderId) where.orderId = dto.orderId;
    if (dto.taskIds && dto.taskIds.length > 0) where.id = { in: dto.taskIds };

    const tasks = await this.prisma.productionTask.findMany({
      where,
      include: { partDefinition: true },
    });

    if (tasks.length === 0) {
      throw new NotFoundException('Nie znaleziono partii produkcyjnych dla podanych kryteriów.');
    }

    const updatedTasks = [];
    let totalQuantity = 0;

    for (const t of tasks) {
      if (t.status === dto.status) {
        continue;
      }
      const updated = await this.updateStatus(t.id, dto.status, user);
      updatedTasks.push(updated);
      totalQuantity += t.quantity;
    }

    return {
      message: `Pomyślnie zaktualizowano status na '${dto.status}' dla ${updatedTasks.length} partii (łącznie ${totalQuantity} szt. formatek).`,
      updatedCount: updatedTasks.length,
      totalQuantity,
      tasks: updatedTasks,
    };
  }
}
