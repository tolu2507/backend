import { createParamDecorator, ExecutionContext, ForbiddenException } from '@nestjs/common';
import type { Role } from '@prisma/client';

import type { AuthUser } from '../common/auth.js';

export const SCHOOL_ROLES: Role[] = ['SCHOOL_OWNER', 'SCHOOL_ADMIN', 'TEACHER'];

/** Who is acting, in which school, and whether they run it (owner/admin) or teach in it. */
export type SchoolActor = { userId: string; schoolId: string; role: Role; isAdmin: boolean };

/**
 * Resolves the school from the user's memberships. Someone in two schools picks one with the
 * `x-school-id` header (the web app sends it once a school is chosen).
 */
export const Actor = createParamDecorator((_: unknown, ctx: ExecutionContext): SchoolActor => {
  const req = ctx.switchToHttp().getRequest();
  const user = req.user as AuthUser;
  const wanted = req.headers['x-school-id'] as string | undefined;
  const roles = user.roles.filter((r) => r.schoolId && SCHOOL_ROLES.includes(r.role) && (!wanted || r.schoolId === wanted));
  if (!roles.length) throw new ForbiddenException('You are not a member of this school.');
  // Highest role wins when someone is both admin and teacher in the same school.
  const rank = (r: Role) => SCHOOL_ROLES.indexOf(r);
  const best = [...roles].sort((a, b) => rank(a.role) - rank(b.role))[0];
  return { userId: user.id, schoolId: best.schoolId!, role: best.role, isAdmin: best.role !== 'TEACHER' };
});

export function requireAdmin(a: SchoolActor) {
  if (!a.isAdmin) throw new ForbiddenException('Only the school owner or an administrator can do that.');
}
