import { Module } from '@nestjs/common';
import { PartsService } from './parts.service.js';
import { PartsController } from './parts.controller.js';
import { PrismaModule } from '../prisma/prisma.module.js';

@Module({
  imports: [PrismaModule],
  controllers: [PartsController],
  providers: [PartsService],
})
export class PartsModule {}
