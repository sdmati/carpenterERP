import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TaskStatus } from '@prisma/client';
import { IsArray, IsEnum, IsInt, IsOptional, IsPositive } from 'class-validator';

export class BatchTaskStatusDto {
  @ApiProperty({
    enum: TaskStatus,
    description: 'Docelowy status partii (CUT, EDGED, DRILLED, COMPLETED)',
    example: TaskStatus.EDGED,
  })
  @IsEnum(TaskStatus)
  status: TaskStatus;

  @ApiPropertyOptional({
    description: 'Opcjonalne ID zlecenia produkcyjnego (wszystkie pasujące partie w zleceniu)',
    example: 1,
  })
  @IsOptional()
  @IsInt()
  @IsPositive()
  orderId?: number;

  @ApiPropertyOptional({
    description: 'Opcjonalna lista identyfikatorów partii produkcyjnych',
    example: [1, 2, 3],
  })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  taskIds?: number[];
}
