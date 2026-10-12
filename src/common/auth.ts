import {
  CanActivate,
  createParamDecorator,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Role } from '@prisma/client';

export type AccessClaims = { sub: string; roles: { role: Role; schoolId: string | null }[] };
export type AuthUser = { id: string; roles: AccessClaims['roles'] };

const IS_PUBLIC = 'isPublic';
const ROLES = 'roles';

/** Route needs no login (login, signup, payment return page, webhooks). */
export const Public = () => SetMetadata(IS_PUBLIC, true);

/** Route needs one of these roles. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES, roles);

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthUser => {
  return ctx.switchToHttp().getRequest().user;
});

/** Global guard: every route requires a valid access token unless marked @Public(). */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext) {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, targets)) return true;

    const req = context.switchToHttp().getRequest();
    const [type, token] = (req.headers.authorization ?? '').split(' ');
    if (type !== 'Bearer' || !token) throw new UnauthorizedException('Please sign in.');

    let claims: AccessClaims;
    try {
      claims = await this.jwt.verifyAsync<AccessClaims>(token);
    } catch {
      throw new UnauthorizedException('Your session has expired. Please sign in again.');
    }
    req.user = { id: claims.sub, roles: claims.roles } satisfies AuthUser;

    const needed = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES, targets);
    if (needed?.length && !claims.roles.some((r) => needed.includes(r.role))) {
      throw new ForbiddenException("Your account can't do that.");
    }
    return true;
  }
}
