import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';
import { Role } from '@prisma/client';

export class RegisterDto {
  @ApiProperty({ example: 'saw_worker1', description: 'Unikalny login' })
  @IsString()
  @IsNotEmpty()
  username: string;

  @ApiProperty({ example: 'tajnehaslo123', description: 'Hasło (min. 4 znaki)' })
  @IsString()
  @MinLength(4)
  password: string;

  @ApiProperty({ example: 'Jan Kowalski', description: 'Imię i nazwisko' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ enum: Role, example: Role.SAW_OPERATOR, description: 'Rola w stolarni' })
  @IsEnum(Role)
  role: Role;

  @ApiPropertyOptional({ example: 1, description: 'Opcjonalne ID przypisanej maszyny' })
  @IsOptional()
  @IsInt()
  machineId?: number;
}
