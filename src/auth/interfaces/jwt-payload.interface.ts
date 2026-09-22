import { Role } from '@prisma/client';

export interface JwtPayload {
  sub: number;
  username: string;
  name: string;
  role: Role;
  machineId?: number | null;
}
