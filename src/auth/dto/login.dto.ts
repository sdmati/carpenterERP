import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'saw_worker1', description: 'Nazwa użytkownika (login)' })
  @IsString()
  @IsNotEmpty()
  username: string;

  @ApiProperty({ example: 'tajnehaslo123', description: 'Hasło użytkownika' })
  @IsString()
  @IsNotEmpty()
  password: string;
}
