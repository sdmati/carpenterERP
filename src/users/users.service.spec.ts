import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';

describe('UsersService', () => {
  let service: UsersService;
  let prisma: {
    user: {
      findUnique: any;
      findMany: any;
      create: any;
      update: any;
      delete: any;
    };
  };

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: vitest.fn(),
        findMany: vitest.fn(),
        create: vitest.fn(),
        update: vitest.fn(),
        delete: vitest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('powinien być zdefiniowany', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('tworzy nowego użytkownika z hashowanym hasłem', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockImplementation(({ data }) =>
        Promise.resolve({
          id: 1,
          ...data,
        }),
      );

      const result = await service.create({
        username: 'nowy_pracownik',
        password: 'haslo',
        name: 'Adam Nowak',
        role: Role.SAW_OPERATOR,
      });

      expect(result.id).toBe(1);
      expect(result.username).toBe('nowy_pracownik');
      expect((result as any).password).toBeUndefined();
    });

    it('rzuca ConflictException gdy login jest zajęty', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 1, username: 'istniejacy' });

      await expect(
        service.create({
          username: 'istniejacy',
          password: 'haslo',
          name: 'Adam Nowak',
          role: Role.SAW_OPERATOR,
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('findOne', () => {
    it('zwraca użytkownika bez hasła', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 1,
        username: 'jan',
        password: 'hashed_password',
        name: 'Jan',
        role: Role.DRILL_OPERATOR,
      });

      const user = await service.findOne(1);
      expect(user.id).toBe(1);
      expect((user as any).password).toBeUndefined();
    });

    it('rzuca NotFoundException gdy brak użytkownika', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });
});
