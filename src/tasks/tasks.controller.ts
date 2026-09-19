import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  ParseIntPipe,
} from '@nestjs/common';
import { TasksService } from './tasks.service.js';
import { ApiTags, ApiOperation, ApiProperty } from '@nestjs/swagger';
import { TaskStatus } from '@prisma/client';
import { IsEnum } from 'class-validator';

class UpdateTaskStatusDto {
  @ApiProperty({
    enum: TaskStatus,
    description: 'Nowy status partii',
    example: TaskStatus.DRILLED,
  })
  @IsEnum(TaskStatus)
  status: TaskStatus;
}

@ApiTags('tasks')
@Controller('tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Get()
  findAll() {
    return this.tasksService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.tasksService.findOne(id);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Zmiana statusu partii przez pracownika hali' })
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTaskStatusDto,
  ) {
    return this.tasksService.updateStatus(id, dto.status);
  }
}
