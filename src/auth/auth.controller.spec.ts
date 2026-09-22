import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { Role } from '@prisma/client';
import { AuthenticatedUser } from './interfaces/authenticated-user.interface.js';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: Partial<Record<keyof AuthService, any>>;

  beforeEach(async () => {
    authService = {
      login: vitest.fn(),
      register: vitest.fn(),
      getProfile: vitest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: authService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('powinien być zdefiniowany', () => {
    expect(controller).toBeDefined();
  });

  it('login wywołuje authService.login', async () => {
    authService.login.mockResolvedValue({ accessToken: 'token123' });

    const dto = { username: 'test', password: 'password' };
    const res = await controller.login(dto);

    expect(res).toEqual({ accessToken: 'token123' });
    expect(authService.login).toHaveBeenCalledWith(dto);
  });

  it('getProfile zwraca dane zalogowanego użytkownika', async () => {
    const mockUser: AuthenticatedUser = {
      id: 1,
      username: 'user1',
      name: 'User One',
      role: Role.ADMIN,
    };
    authService.getProfile.mockResolvedValue(mockUser);

    const res = await controller.getProfile(mockUser);
    expect(res).toEqual(mockUser);
    expect(authService.getProfile).toHaveBeenCalledWith(1);
  });
});
