import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller.js';
import { UsersService } from './users.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Role } from '@prisma/client';

describe('UsersController', () => {
  let controller: UsersController;
  let usersService: Partial<Record<keyof UsersService, any>>;

  beforeEach(async () => {
    usersService = {
      create: vitest.fn(),
      findAll: vitest.fn(),
      findOne: vitest.fn(),
      update: vitest.fn(),
      remove: vitest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: usersService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<UsersController>(UsersController);
  });

  it('powinien być zdefiniowany', () => {
    expect(controller).toBeDefined();
  });

  it('create wywołuje usersService.create', async () => {
    const dto = {
      username: 'pilarz',
      password: 'password',
      name: 'Piotr Pilarz',
      role: Role.SAW_OPERATOR,
    };
    usersService.create.mockResolvedValue({ id: 1, ...dto });

    const res = await controller.create(dto);
    expect(res).toEqual({ id: 1, ...dto });
    expect(usersService.create).toHaveBeenCalledWith(dto);
  });

  it('findAll wywołuje usersService.findAll', async () => {
    usersService.findAll.mockResolvedValue([{ id: 1, username: 'admin' }]);

    const res = await controller.findAll();
    expect(res).toEqual([{ id: 1, username: 'admin' }]);
    expect(usersService.findAll).toHaveBeenCalled();
  });
});
