import { createParamDecorator, ExecutionContext, ForbiddenException } from '@nestjs/common';
import type { Role } from '@prisma/client';

import type { AuthUser } from '../common/auth.js';

export const TUCK_SHOP_ROLES: Role[] = ['TUCK_SHOP', 'SCHOOL_OWNER', 'SCHOOL_ADMIN'];

/** Who is selling, and for which school. Owners and admins can serve at the counter too. */
export type Seller = { userId: string; schoolId: string; isAdmin: boolean };

export const CurrentSeller = createParamDecorator((_: unknown, ctx: ExecutionContext): Seller => {
  const req = ctx.switchToHttp().getRequest();
  const user = req.user as AuthUser;
  const wanted = req.headers['x-school-id'] as string | undefined;
  const roles = user.roles.filter((r) => r.schoolId && TUCK_SHOP_ROLES.includes(r.role) && (!wanted || r.schoolId === wanted));
  if (!roles.length) throw new ForbiddenException('You are not on the tuck-shop staff of this school.');
  // Prefer the counter role, so someone who is both admin and tuck-shop staff sells as staff.
  const pick = roles.find((r) => r.role === 'TUCK_SHOP') ?? roles[0];
  return { userId: user.id, schoolId: pick.schoolId!, isAdmin: pick.role !== 'TUCK_SHOP' };
});
