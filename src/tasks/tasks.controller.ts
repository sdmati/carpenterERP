import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  Query,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { TasksService } from './tasks.service.js';
import { ApiTags, ApiOperation, ApiProperty, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { TaskStatus } from '@prisma/client';
import { IsEnum } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface.js';

export class UpdateTaskStatusDto {
  @ApiProperty({
    enum: TaskStatus,
    description: 'Nowy status partii (SAW_OPERATOR: CUT, DRILL_OPERATOR: DRILLED, PACKER: COMPLETED, ADMIN: dowolny)',
    example: TaskStatus.CUT,
  })
  @IsEnum(TaskStatus)
  status: TaskStatus;
}

@ApiTags('tasks')
@Controller('tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Get()
  @ApiOperation({ summary: 'Pobierz listę partii/zadań (opcjonalnie filtruj po orderId lub statusie)' })
  @ApiQuery({ name: 'orderId', required: false, type: Number, description: 'ID zlecenia produkcyjnego' })
  @ApiQuery({ name: 'status', required: false, enum: TaskStatus, description: 'Status partii' })
  findAll(
    @Query('orderId') orderId?: string,
    @Query('status') status?: TaskStatus,
  ) {
    const parsedOrderId = orderId ? parseInt(orderId, 10) : undefined;
    return this.tasksService.findAll(parsedOrderId, status);
  }

  @Get('order/:orderId')
  @ApiOperation({ summary: 'Pobierz elementy/zadania dla konkretnego zamówienia na meble' })
  findByOrderId(@Param('orderId', ParseIntPipe) orderId: number) {
    return this.tasksService.findByOrderId(orderId);
  }

  @Get('barcode/:barcode')
  @ApiOperation({ summary: 'Pobierz zadanie po kodzie kreskowym na wózku/formatce' })
  findByBarcode(@Param('barcode') barcode: string) {
    return this.tasksService.findByBarcode(barcode);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Pobierz pojedyncze zadanie po ID' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.tasksService.findOne(id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/status')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Zmiana statusu partii przez uprawnionego zalogowanego pracownika',
    description:
      'Wymaga zalogowania (Bearer token). SAW_OPERATOR może oznaczyć CUT, DRILL_OPERATOR może oznaczyć DRILLED, PACKER może oznaczyć COMPLETED. ADMIN posiada pełne uprawnienia.',
  })
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTaskStatusDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.tasksService.updateStatus(id, dto.status, user);
  }
}
