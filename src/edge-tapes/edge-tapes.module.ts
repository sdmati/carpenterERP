import { Module } from '@nestjs/common';
import { EdgeTapesService } from './edge-tapes.service.js';
import { EdgeTapesController } from './edge-tapes.controller.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [EdgeTapesController],
  providers: [EdgeTapesService],
  exports: [EdgeTapesService],
})
export class EdgeTapesModule {}
