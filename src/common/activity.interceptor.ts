import { Injectable, type CallHandler, type ExecutionContext, type NestInterceptor } from '@nestjs/common';
import { tap } from 'rxjs';

import { PrismaService } from '../prisma/prisma.service.js';
import type { AuthUser } from './auth.js';

const CHANGES = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
// These write their own, more specific audit entries (or, for auth, would only add noise).
const SKIP = new Set(['AdminController', 'OverwatchInsightsController', 'AuthController']);

/**
 * The activity log behind Overwatch: every change a signed-in person makes, in which school,
 * and whether it worked. Only the route is stored, never the request body (PINs, passwords).
 */
@Injectable()
export class ActivityLogInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}

  intercept(ctx: ExecutionContext, next: CallHandler) {
    if (ctx.getType() !== 'http') return next.handle();
    const req = ctx.switchToHttp().getRequest();
    const controller = ctx.getClass().name;
    if (!CHANGES.has(req.method) || SKIP.has(controller)) return next.handle();

    const write = (status: number) => {
      const user = req.user as AuthUser | undefined;
      if (!user) return;
      const wanted = req.headers['x-school-id'] as string | undefined;
      const schools = [...new Set(user.roles.map((r) => r.schoolId).filter(Boolean))] as string[];
      const schoolId = wanted && schools.includes(wanted) ? wanted : schools.length === 1 ? schools[0] : null;
      const entityType = controller.replace(/Controller$/, '');
      const params = (req.params ?? {}) as Record<string, string>;
      this.prisma.auditLog
        .create({
          data: {
            actorId: user.id,
            action: `${entityType.toLowerCase()}.${ctx.getHandler().name}`,
            entityType,
            entityId: params.id ?? Object.values(params)[0] ?? '-',
            schoolId,
            ip: req.ip,
            meta: { method: req.method, path: req.route?.path ?? req.path, status },
          },
        })
        .catch(() => undefined); // logging must never break the request
    };

    return next.handle().pipe(
      tap({
        next: () => write(ctx.switchToHttp().getResponse().statusCode),
        error: (e: { status?: number }) => write(e?.status ?? 500),
      }),
    );
  }
}
