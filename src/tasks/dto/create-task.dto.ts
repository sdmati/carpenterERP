import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsPositive } from 'class-validator';
import { TaskStatus } from '@prisma/client';

export class CreateTaskDto {
  @ApiProperty({
    description: 'Ilość formatek w danej partii produkcyjnej / na palecie',
    example: 100,
  })
  @IsInt()
  @IsPositive()
  quantity: number;

  @ApiProperty({
    description: 'Identyfikator powiązanego zlecenia produkcyjnego',
    example: 10,
  })
  @IsInt()
  @IsPositive()
  orderId: number;

  @ApiProperty({
    description: 'Identyfikator definicji elementu (formatki) podlegającego obróbce',
    example: 4,
  })
  @IsInt()
  @IsPositive()
  partDefId: number;

  @ApiPropertyOptional({
    description: 'Status etapu technologicznego danej partii produkcyjnej',
    enum: TaskStatus,
    default: TaskStatus.PENDING,
    example: TaskStatus.PENDING,
  })
  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @ApiPropertyOptional({
    description: 'Identyfikator maszyny przypisanej do wykonania zadania (np. piła panelowa, centrum obróbcze CNC)',
    example: 2,
  })
  @IsOptional()
  @IsInt()
  @IsPositive()
  machineId?: number;
}
