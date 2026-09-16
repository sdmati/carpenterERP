import { Injectable } from '@nestjs/common';
import { CreateTaskDto } from './dto/create-task.dto.js';
import { UpdateTaskDto } from './dto/update-task.dto.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class TasksService {
  constructor(private prisma: PrismaService) {}

  create(createTaskDto: CreateTaskDto) {
    return this.prisma.productionTask.create({
      data: createTaskDto,
    });
  }

  findAll() {
    return this.prisma.productionTask.findMany({
      include: {
        order: true,
        partDefinition: true,
        machine: true,
      },
    });
  }

  findOne(id: number) {
    return this.prisma.productionTask.findUnique({
      where: { id },
      include: {
        order: true,
        partDefinition: true,
        machine: true,
      },
    });
  }

  update(id: number, updateTaskDto: UpdateTaskDto) {
    return this.prisma.productionTask.update({
      where: { id },
      data: updateTaskDto,
    });
  }

  remove(id: number) {
    return this.prisma.productionTask.delete({
      where: { id },
    });
  }
}
