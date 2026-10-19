import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';

import { CurrentUser, PARENT_ROLES, Roles, type AuthUser } from '../common/auth.js';
import { ExamsService } from '../exams/exams.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ProgressService } from './progress.service.js';

/** Parents: how each child is doing, from their own practice and Friday mocks. */
@Roles(...PARENT_ROLES)
@Controller('parent')
export class ProgressController {
  constructor(
    private readonly progress: ProgressService,
    private readonly exams: ExamsService,
    private readonly prisma: PrismaService,
  ) {}

  /** A card for every child on the account. */
  @Get('progress') async cards(@CurrentUser() u: AuthUser) {
    const links = await this.prisma.guardianship.findMany({ where: { parentId: u.id, confirmedAt: { not: null } }, orderBy: { createdAt: 'asc' }, select: { studentId: true } });
    return this.progress.cards(links.map((l) => l.studentId));
  }

  @Get('children/:id/progress') async detail(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    await this.exams.assertGuardian(u.id, id);
    return this.progress.detail(id);
  }
}
