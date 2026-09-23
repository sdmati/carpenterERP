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
import { CutDimensionGroupDto } from './dto/cut-dimension-group.dto.js';
import { EdgeBatchDto } from './dto/edge-batch.dto.js';
import { DrillBatchDto } from './dto/drill-batch.dto.js';
import { PackBatchDto } from './dto/pack-batch.dto.js';
import { BatchTaskStatusDto } from './dto/batch-task-status.dto.js';

export class UpdateTaskStatusDto {
  @ApiProperty({
    enum: TaskStatus,
    description: 'Nowy status partii (SAW_OPERATOR: CUT, EDGE_BANDER_OPERATOR: EDGED, DRILL_OPERATOR: DRILLED, PACKER: COMPLETED, ADMIN: dowolny)',
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

  @Get('cutting-list')
  @ApiOperation({
    summary: 'Pobierz listę rozkroju dla pilarza (formatki pogrupowane wymiarami i materiałem)',
    description:
      'Grupuje części według wymiarów i materiału, sumując potrzebne ilości płyt niezależnie od późniejszych nawierceń CNC.',
  })
  @ApiQuery({ name: 'orderId', required: false, type: Number, description: 'ID konkretnego zlecenia (opcjonalne)' })
  getCuttingList(@Query('orderId') orderId?: string) {
    const parsedOrderId = orderId ? parseInt(orderId, 10) : undefined;
    return this.tasksService.getCuttingList(parsedOrderId);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('cutting-list/cut')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Oznacz jako CUT całą grupę wymiarową formatek za jednym razem',
    description:
      'Pozwala pilarzowi (SAW_OPERATOR) lub kierownikowi (ADMIN) oznaczyć wszystkie formatki o danych wymiarach w zleceniu jako CUT.',
  })
  cutDimensionGroup(
    @Body() dto: CutDimensionGroupDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.tasksService.cutDimensionGroup(dto, user);
  }

  @Get('edge-banding')
  @ApiOperation({
    summary: 'Pobierz listę zapotrzebowania na okleinowanie dla partii (dla operatora okleiniarki)',
    description:
      'Zwraca listę partii produkcyjnych z informacjami o oklejanych krawędziach, parametrach okleiny i wyliczonym zapotrzebowaniu w metrach bieżących (mb).',
  })
  @ApiQuery({ name: 'orderId', required: false, type: Number, description: 'ID konkretnego zlecenia (opcjonalne)' })
  getEdgeBandingList(@Query('orderId') orderId?: string) {
    const parsedOrderId = orderId ? parseInt(orderId, 10) : undefined;
    return this.tasksService.getEdgeBandingList(parsedOrderId);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('edge-banding/edge')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Oznacz partię lub całe zlecenie jako oklejone (EDGED) masowo',
    description:
      'Pozwala operatorowi okleiniarki (EDGE_BANDER_OPERATOR) lub administratorowi (ADMIN) oznaczyć partię/partie jako EDGED. Wymaga uprzedniego rozkroju (CUT).',
  })
  edgeBatch(
    @Body() dto: EdgeBatchDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.tasksService.edgeBatch(dto, user);
  }

  @Get('drilling-list')
  @ApiOperation({
    summary: 'Pobierz listę partii do nawiercenia na wiertarce CNC (dla operatora DRILL_OPERATOR)',
    description:
      'Zwraca listę partii z informacją o schemacie nawierceń, statusie gotowości technologicznej (czy formatka została już wycięta i ewentualnie oklejona) oraz kodzie wózka.',
  })
  @ApiQuery({ name: 'orderId', required: false, type: Number, description: 'ID konkretnego zlecenia (opcjonalne)' })
  @ApiQuery({ name: 'readyOnly', required: false, type: Boolean, description: 'Filtruj tylko formatki gotowe do nawiercenia (CUT/EDGED)' })
  getDrillingList(
    @Query('orderId') orderId?: string,
    @Query('readyOnly') readyOnly?: string,
  ) {
    const parsedOrderId = orderId ? parseInt(orderId, 10) : undefined;
    const isReadyOnly = readyOnly === 'true' || readyOnly === '1';
    return this.tasksService.getDrillingList(parsedOrderId, isReadyOnly);
  }

  @Get('drilling-summary')
  @ApiOperation({
    summary: 'Pobierz podsumowanie nawierceń CNC dla wskazanego zlecenia produkcyjnego',
    description:
      'Zwraca status nawierceń, liczbę partii gotowych do nawiercenia, już nawierconych oraz oczekujących na wcześniejsze etapy.',
  })
  @ApiQuery({ name: 'orderId', required: true, type: Number, description: 'ID zlecenia produkcyjnego' })
  getDrillingSummary(@Query('orderId', ParseIntPipe) orderId: number) {
    return this.tasksService.getOrderDrillingSummary(orderId);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('drilling-list/drill')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Oznacz partię lub całe zlecenie jako nawiercone (DRILLED) masowo',
    description:
      'Pozwala operatorowi wiertarki (DRILL_OPERATOR) lub administratorowi (ADMIN) oznaczyć partię/partie jako DRILLED. Przestrzega sekwencji technologicznej.',
  })
  drillBatch(
    @Body() dto: DrillBatchDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.tasksService.drillBatch(dto, user);
  }

  @Get('packing-list')
  @ApiOperation({
    summary: 'Pobierz listę partii do spakowania (dla pracownika pakowni PACKER)',
    description:
      'Zwraca listę partii pod kątem pakowni wraz ze statusem gotowości (czy wszystkie formatki przeszły etap wiercenia DRILLED).',
  })
  @ApiQuery({ name: 'orderId', required: false, type: Number, description: 'ID konkretnego zlecenia (opcjonalne)' })
  @ApiQuery({ name: 'readyOnly', required: false, type: Boolean, description: 'Filtruj tylko formatki gotowe do spakowania (DRILLED)' })
  getPackingList(
    @Query('orderId') orderId?: string,
    @Query('readyOnly') readyOnly?: string,
  ) {
    const parsedOrderId = orderId ? parseInt(orderId, 10) : undefined;
    const isReadyOnly = readyOnly === 'true' || readyOnly === '1';
    return this.tasksService.getPackingList(parsedOrderId, isReadyOnly);
  }

  @Get('packing-summary')
  @ApiOperation({
    summary: 'Pobierz podsumowanie pakowania dla wskazanego zlecenia produkcyjnego',
    description:
      'Zwraca liczbę formatek spakowanych (COMPLETED), gotowych do spakowania (DRILLED) oraz oczekujących na produkcję.',
  })
  @ApiQuery({ name: 'orderId', required: true, type: Number, description: 'ID zlecenia produkcyjnego' })
  getPackingSummary(@Query('orderId', ParseIntPipe) orderId: number) {
    return this.tasksService.getOrderPackingSummary(orderId);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('packing-list/pack')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Oznacz partię lub całe zlecenie jako spakowane (COMPLETED) masowo',
    description:
      'Pozwala pracownikowi pakowni (PACKER) lub administratorowi (ADMIN) oznaczyć partię/partie jako COMPLETED. Kwalifikują się formatki po wierceniu (DRILLED).',
  })
  packBatch(
    @Body() dto: PackBatchDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.tasksService.packBatch(dto, user);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('batch-status')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Masowa zmiana statusu partii zadań (CUT, EDGED, DRILLED, COMPLETED) z zachowaniem uprawnień ról',
    description:
      'Pozwala na hurtowe przestawienie statusu partii w zleceniu lub po liście taskIds. SAW_OPERATOR: CUT, EDGE_BANDER_OPERATOR: EDGED, DRILL_OPERATOR: DRILLED, PACKER: COMPLETED, ADMIN: dowolny.',
  })
  updateBatchStatus(
    @Body() dto: BatchTaskStatusDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.tasksService.updateBatchStatus(dto, user);
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

  @Get(':id/edge-banding')
  @ApiOperation({
    summary: 'Pobierz zapotrzebowanie na okleinę dla pojedynczej partii produkcyjnej',
    description: 'Wylicza metry bieżące okleiny na 1 sztukę oraz na całą partię dla danego zadania.',
  })
  getTaskEdgeBanding(@Param('id', ParseIntPipe) id: number) {
    return this.tasksService.getTaskEdgeBanding(id);
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
      'Wymaga zalogowania (Bearer token). SAW_OPERATOR może oznaczyć CUT, EDGE_BANDER_OPERATOR może oznaczyć EDGED, DRILL_OPERATOR może oznaczyć DRILLED, PACKER może oznaczyć COMPLETED. ADMIN posiada pełne uprawnienia.',
  })
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTaskStatusDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.tasksService.updateStatus(id, dto.status, user);
  }
}
