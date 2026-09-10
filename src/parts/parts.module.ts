import { Module } from '@nestjs/common';
import { PartsService } from './parts.service.js';
import { PartsController } from './parts.controller.js';

@Module({
  controllers: [PartsController],
  providers: [PartsService],
})
export class PartsModule {}
