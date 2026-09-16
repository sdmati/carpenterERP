import { Injectable } from '@nestjs/common';
import { CreatePartDto } from './dto/create-part.dto.js';
import { UpdatePartDto } from './dto/update-part.dto.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class PartsService {
  constructor(private prisma: PrismaService) {}

  create(createPartDto: CreatePartDto) {
    return this.prisma.partDefinition.create({
      data: createPartDto,
    });
  }

  findAll() {
    return this.prisma.partDefinition.findMany({
      include: {
        product: true,
        material: true,
      },
    });
  }

  findOne(id: number) {
    return this.prisma.partDefinition.findUnique({
      where: { id },
      include: {
        product: true,
        material: true,
      },
    });
  }

  update(id: number, updatePartDto: UpdatePartDto) {
    return this.prisma.partDefinition.update({
      where: { id },
      data: updatePartDto,
    });
  }

  remove(id: number) {
    return this.prisma.partDefinition.delete({
      where: { id },
    });
  }
}
