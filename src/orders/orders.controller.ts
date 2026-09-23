import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseIntPipe,
  UseGuards,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { OrdersService } from './orders.service.js';
import { CreateOrderDto } from './dto/create-order.dto.js';
import { UpdateOrderDto } from './dto/update-order.dto.js';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto.js';
import { ConsumeMaterialDto } from '../materials/dto/consume-material.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface.js';

@ApiTags('orders')
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @ApiOperation({ summary: 'Utwórz nowe zlecenie produkcyjne (automatycznie tworzy partie na halę)' })
  create(@Body() createOrderDto: CreateOrderDto) {
    return this.ordersService.create(createOrderDto);
  }

  @Get()
  @ApiOperation({ summary: 'Pobierz listę wszystkich zleceń' })
  findAll() {
    return this.ordersService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Pobierz zlecenie produkcyjne wraz z partiami/zadaniami' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.ordersService.findOne(id);
  }

  @Get(':id/tasks')
  @ApiOperation({ summary: 'Pobierz elementy/partie potrzebne do wykonania konkretnego zamówienia' })
  getTasks(@Param('id', ParseIntPipe) id: number) {
    return this.ordersService.getTasks(id);
  }

  @Get(':id/cutting-list')
  @ApiOperation({
    summary: 'Pobierz listę rozkroju dla konkretnego zlecenia (formatki pogrupowane po wymiarach dla pilarza)',
    description:
      'Zwraca listę formatek potrzebnych do wykonania zlecenia pogrupowaną po wymiarach (długość x szerokość x grubość) i materiale, sumując ilości do wycięcia.',
  })
  getCuttingList(@Param('id', ParseIntPipe) id: number) {
    return this.ordersService.getCuttingList(id);
  }

  @Get(':id/edge-banding')
  @ApiOperation({
    summary: 'Pobierz zapotrzebowanie na okleinowanie dla zlecenia (przeliczenie metrów okleiny dla całej partii)',
    description:
      'Zwraca szczegółowe zestawienie oklejania krawędzi dla całego zlecenia: sumaryczne metry bieżące, rozbicie na typy i kolory taśm okleinowych oraz wyliczenia dla każdej partii.',
  })
  getEdgeBandingSummary(@Param('id', ParseIntPipe) id: number) {
    return this.ordersService.getEdgeBandingSummary(id);
  }

  @Get(':id/edge-tape-check')
  @ApiOperation({
    summary: 'Sprawdź stan magazynowy i dostępność okleiny dla danego zlecenia produkcyjnego',
    description:
      'Zwraca analizę dostępności poszczególnych rodzajów okleiny w magazynie pod kątem zlecenia (czy wystarcza metrów, ile brakuje).',
  })
  checkEdgeTapeAvailability(@Param('id', ParseIntPipe) id: number) {
    return this.ordersService.checkEdgeTapeAvailability(id);
  }

  @Get(':id/drilling-list')
  @ApiOperation({
    summary: 'Pobierz listę nawierceń dla zlecenia (dla wiertarki CNC)',
    description:
      'Zwraca listę formatek w zleceniu z wymiarami, schematem otworów i statusem gotowości technologicznej do wiercenia.',
  })
  @ApiQuery({ name: 'readyOnly', required: false, type: Boolean, description: 'Filtruj tylko formatki gotowe do wiercenia' })
  getDrillingList(
    @Param('id', ParseIntPipe) id: number,
    @Query('readyOnly') readyOnly?: string,
  ) {
    const isReadyOnly = readyOnly === 'true' || readyOnly === '1';
    return this.ordersService.getDrillingList(id, isReadyOnly);
  }

  @Get(':id/drilling-summary')
  @ApiOperation({
    summary: 'Pobierz podsumowanie nawierceń dla konkretnego zlecenia produkcyjnego',
    description:
      'Zwraca zagregowane dane o stopniu zaawansowania nawierceń w danym zleceniu.',
  })
  getDrillingSummary(@Param('id', ParseIntPipe) id: number) {
    return this.ordersService.getDrillingSummary(id);
  }

  @Get(':id/packing-list')
  @ApiOperation({
    summary: 'Pobierz listę partii do spakowania dla konkretnego zlecenia (dla pakowni)',
    description:
      'Zwraca listę formatek w zleceniu z informacją czy zostały już nawiercone i są gotowe do spakowania.',
  })
  @ApiQuery({ name: 'readyOnly', required: false, type: Boolean, description: 'Filtruj tylko formatki gotowe do spakowania' })
  getPackingList(
    @Param('id', ParseIntPipe) id: number,
    @Query('readyOnly') readyOnly?: string,
  ) {
    const isReadyOnly = readyOnly === 'true' || readyOnly === '1';
    return this.ordersService.getPackingList(id, isReadyOnly);
  }

  @Get(':id/packing-summary')
  @ApiOperation({
    summary: 'Pobierz podsumowanie pakowania dla konkretnego zlecenia produkcyjnego',
    description:
      'Zwraca liczbę formatek spakowanych, gotowych do spakowania oraz oczekujących na wcześniejsze etapy.',
  })
  getPackingSummary(@Param('id', ParseIntPipe) id: number) {
    return this.ordersService.getPackingSummary(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.EDGE_BANDER_OPERATOR)
  @ApiBearerAuth()
  @Post(':id/deduct-edge-tape')
  @ApiOperation({
    summary: 'Ręczne odliczenie okleiny dla zlecenia przez operatora okleiniarki (EDGE_BANDER_OPERATOR / ADMIN)',
    description:
      'Odejmuje metry bieżące okleiny wymagane dla tego zlecenia ze stanu magazynowego i oznacza zlecenie jako odliczone.',
  })
  deductEdgeTape(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.ordersService.deductOrderEdgeTape(id, user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SAW_OPERATOR)
  @ApiBearerAuth()
  @Post(':id/consume-sheets')
  @ApiOperation({
    summary: 'Ręczne wpisanie liczby zużytych arkuszy płyty dla zlecenia przez pilarza (SAW_OPERATOR / ADMIN)',
    description:
      'Odejmuje wskazaną liczbę całych arkuszy płyty z magazynu materiałów i przypisuje zużycie do zlecenia (order.sheetsUsed).',
  })
  consumeSheets(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ConsumeMaterialDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.ordersService.consumeSheets(id, dto.sheetsCount, dto.materialId, user);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/status')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Zmiana statusu zlecenia produkcyjnego (np. PACKED przez PACKER/ADMIN)',
    description:
      'Status PACKED może zostać ustawiony dla całego zlecenia przez pracownika z rolą PACKER lub ADMIN, jeśli wszystkie części w zleceniu zostały nawiercone (DRILLED).',
  })
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateOrderStatusDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.ordersService.updateStatus(id, dto.status, user);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Zaktualizuj zlecenie produkcyjne' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateOrderDto: UpdateOrderDto,
  ) {
    return this.ordersService.update(id, updateOrderDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Usuń zlecenie produkcyjne' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.ordersService.remove(id);
  }
}
