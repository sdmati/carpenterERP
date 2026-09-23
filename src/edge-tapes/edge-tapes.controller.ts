import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { Color, Role } from '@prisma/client';
import { EdgeTapesService } from './edge-tapes.service.js';
import { CreateEdgeTapeDto } from './dto/create-edge-tape.dto.js';
import { UpdateEdgeTapeDto } from './dto/update-edge-tape.dto.js';
import { ConsumeEdgeTapeDto } from './dto/consume-edge-tape.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface.js';

@ApiTags('edge-tapes')
@Controller('edge-tapes')
export class EdgeTapesController {
  constructor(private readonly edgeTapesService: EdgeTapesService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Dodaj nową rolkę / rodzaj okleiny do magazynu (ADMIN)',
  })
  create(@Body() createEdgeTapeDto: CreateEdgeTapeDto) {
    return this.edgeTapesService.create(createEdgeTapeDto);
  }

  @Get()
  @ApiOperation({
    summary: 'Pobierz stany magazynowe oklein meblowych (opcjonalne filtrowanie po type i color)',
  })
  @ApiQuery({ name: 'type', required: false, description: 'Typ okleiny (np. ABS, Melamina)' })
  @ApiQuery({ name: 'color', required: false, enum: Color, description: 'Kolor okleiny' })
  findAll(
    @Query('type') type?: string,
    @Query('color') color?: Color,
  ) {
    return this.edgeTapesService.findAll(type, color);
  }

  @Get('check-availability')
  @ApiOperation({
    summary: 'Sprawdź czy stan magazynowy okleiny jest wystarczający dla danego zlecenia produkcyjnego',
    description:
      'Wylicza zapotrzebowanie na okleinę dla zlecenia i porównuje z aktualnymi stanami magazynowymi w mb.',
  })
  @ApiQuery({ name: 'orderId', required: true, type: Number, description: 'ID zlecenia produkcyjnego' })
  checkAvailability(@Query('orderId', ParseIntPipe) orderId: number) {
    return this.edgeTapesService.checkAvailability(orderId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Pobierz dane okleiny o podanym ID wraz ze stanem magazynowym' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.edgeTapesService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Zaktualizuj parametry lub stan magazynowy okleiny (ADMIN)' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateEdgeTapeDto: UpdateEdgeTapeDto,
  ) {
    return this.edgeTapesService.update(id, updateEdgeTapeDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Usuń okleinę z bazy danych (ADMIN)' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.edgeTapesService.remove(id);
  }

  @Post(':id/consume')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.EDGE_BANDER_OPERATOR)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Ręczne odliczenie ilości okleiny przez operatora okleiniarki (EDGE_BANDER_OPERATOR / ADMIN)',
    description:
      'Pozwala operatorowi okleiniarki ręcznie odliczyć określoną liczbę metrów bieżących (mb) okleiny z magazynu.',
  })
  consume(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ConsumeEdgeTapeDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.edgeTapesService.consume(id, dto.meters, dto.reason, dto.orderId, user);
  }
}
