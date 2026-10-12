import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

/**
 * The address the caller used to reach this API, e.g. http://192.168.1.20:3001 or an ngrok URL.
 * Payment checkouts send the phone back here, so it must be an address the phone can reach:
 * "localhost" on a phone means the phone itself. APP_PUBLIC_URL wins when set (production).
 */
export const RequestOrigin = createParamDecorator((_: unknown, ctx: ExecutionContext): string => {
  if (process.env.APP_PUBLIC_URL) return process.env.APP_PUBLIC_URL.replace(/\/+$/, '');
  const req = ctx.switchToHttp().getRequest<Request>();
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.split(',')[0].trim();
  const proto = first(req.headers['x-forwarded-proto']) ?? req.protocol;
  const host = first(req.headers['x-forwarded-host']) ?? req.headers.host ?? 'localhost:3001';
  return `${proto}://${host}`;
});
