import { Module } from '@nestjs/common';
import { MaterialsService } from './materials.service.js';
import { MaterialsController } from './materials.controller.js';
import { PrismaModule } from '../prisma/prisma.module.js';

@Module({
  imports: [PrismaModule],
  controllers: [MaterialsController],
  providers: [MaterialsService],
})
export class MaterialsModule {}
