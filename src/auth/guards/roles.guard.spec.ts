import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { RolesGuard } from './roles.guard.js';
import { Role } from '@prisma/client';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RolesGuard,
        {
          provide: Reflector,
          useValue: {
            getAllAndOverride: vitest.fn(),
          },
        },
      ],
    }).compile();

    guard = module.get<RolesGuard>(RolesGuard);
    reflector = module.get<Reflector>(Reflector);
  });

  const createMockContext = (user?: any): ExecutionContext => {
    return {
      getHandler: vitest.fn(),
      getClass: vitest.fn(),
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    } as unknown as ExecutionContext;
  };

  it('przepuszcza gdy brak zdefiniowanych ról na endpoincie', () => {
    vitest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    const context = createMockContext();

    expect(guard.canActivate(context)).toBe(true);
  });

  it('ADMIN ma dostęp do wszystkiego niezależnie od wymaganej roli', () => {
    vitest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([Role.SAW_OPERATOR]);
    const context = createMockContext({
      id: 1,
      username: 'admin',
      role: Role.ADMIN,
    });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('przepuszcza pracownika o odpowiedniej roli', () => {
    vitest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([Role.SAW_OPERATOR]);
    const context = createMockContext({
      id: 2,
      username: 'pilarz',
      role: Role.SAW_OPERATOR,
    });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('rzuca ForbiddenException gdy pracownik ma inną rolę', () => {
    vitest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([Role.DRILL_OPERATOR]);
    const context = createMockContext({
      id: 2,
      username: 'pilarz',
      role: Role.SAW_OPERATOR,
    });

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('rzuca UnauthorizedException gdy brak zalogowanego użytkownika', () => {
    vitest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([Role.SAW_OPERATOR]);
    const context = createMockContext(undefined);

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });
});
