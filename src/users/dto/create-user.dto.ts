import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';
import { Role } from '@prisma/client';

export class CreateUserDto {
  @ApiProperty({ example: 'saw_worker1', description: 'Unikalny login pracownika' })
  @IsString()
  @IsNotEmpty()
  username: string;

  @ApiProperty({ example: 'tajnehaslo123', description: 'Hasło pracownika (min. 4 znaki)' })
  @IsString()
  @MinLength(4)
  password: string;

  @ApiProperty({ example: 'Jan Kowalski', description: 'Imię i nazwisko pracownika' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ enum: Role, example: Role.SAW_OPERATOR, description: 'Rola w systemie' })
  @IsEnum(Role)
  role: Role;

  @ApiPropertyOptional({ example: 1, description: 'Opcjonalne ID przypisanej maszyny' })
  @IsOptional()
  @IsInt()
  machineId?: number;
}
