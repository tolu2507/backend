import { Controller, Get } from '@nestjs/common';

import { Public } from './common/auth.js';
import { PrismaService } from './prisma/prisma.service.js';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  async check() {
    await this.prisma.$queryRaw`SELECT 1`;
    return { ok: true, ai: !!process.env.GEMINI_API_KEY, payments: !!process.env.SQUAD_SECRET_KEY };
  }
}
