import { Role } from '@prisma/client';

export interface AuthenticatedUser {
  id: number;
  username: string;
  name: string;
  role: Role;
  machineId?: number | null;
}
