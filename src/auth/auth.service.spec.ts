import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service.js';
import { UsersService } from '../users/users.service.js';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import { Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

describe('AuthService', () => {
  let service: AuthService;
  let usersService: Partial<Record<keyof UsersService, any>>;
  let jwtService: Partial<Record<keyof JwtService, any>>;

  beforeEach(async () => {
    usersService = {
      findByUsername: vitest.fn(),
      create: vitest.fn(),
      findOne: vitest.fn(),
    };

    jwtService = {
      signAsync: vitest.fn().mockResolvedValue('mock-jwt-token'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersService },
        { provide: JwtService, useValue: jwtService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('powinien być zdefiniowany', () => {
    expect(service).toBeDefined();
  });

  describe('validateUser', () => {
    it('zwraca użytkownika bez hasła przy poprawnych danych', async () => {
      const hashedPassword = await bcrypt.hash('haslo123', 10);
      usersService.findByUsername.mockResolvedValue({
        id: 1,
        username: 'jan',
        password: hashedPassword,
        name: 'Jan Kowalski',
        role: Role.SAW_OPERATOR,
        machineId: 1,
      });

      const result = await service.validateUser('jan', 'haslo123');
      expect(result).toBeDefined();
      expect(result.username).toBe('jan');
      expect((result as any).password).toBeUndefined();
    });

    it('zwraca null gdy użytkownik nie istnieje', async () => {
      usersService.findByUsername.mockResolvedValue(null);
      const result = await service.validateUser('nieistnieje', 'haslo123');
      expect(result).toBeNull();
    });

    it('zwraca null przy błędnym haśle', async () => {
      const hashedPassword = await bcrypt.hash('poprawnehaslo', 10);
      usersService.findByUsername.mockResolvedValue({
        id: 1,
        username: 'jan',
        password: hashedPassword,
        name: 'Jan Kowalski',
        role: Role.SAW_OPERATOR,
      });

      const result = await service.validateUser('jan', 'zlehaslo');
      expect(result).toBeNull();
    });
  });

  describe('login', () => {
    it('generuje token JWT przy poprawnym logowaniu', async () => {
      const hashedPassword = await bcrypt.hash('haslo123', 10);
      usersService.findByUsername.mockResolvedValue({
        id: 1,
        username: 'saw_user',
        password: hashedPassword,
        name: 'Operator Piły',
        role: Role.SAW_OPERATOR,
        machineId: 2,
      });

      const result = await service.login({
        username: 'saw_user',
        password: 'haslo123',
      });

      expect(result.accessToken).toBe('mock-jwt-token');
      expect(result.user.username).toBe('saw_user');
      expect(result.user.role).toBe(Role.SAW_OPERATOR);
      expect(jwtService.signAsync).toHaveBeenCalledWith({
        sub: 1,
        username: 'saw_user',
        name: 'Operator Piły',
        role: Role.SAW_OPERATOR,
        machineId: 2,
      });
    });

    it('rzuca UnauthorizedException przy błędnych danych logowania', async () => {
      usersService.findByUsername.mockResolvedValue(null);

      await expect(
        service.login({ username: 'zly_login', password: 'zle' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
